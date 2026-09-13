/**
 * @file worktree-switcher.ts
 *
 * Vite dev-server plugin that lets the developer switch between git
 * worktrees from inside the running application.
 *
 * Architecture
 * ------------
 * The plugin is installed in every worktree's `vite.config.ts`. At
 * startup it decides which role to play based on `config.mode`:
 *
 *   - **Bootstrap** (the worktree Vite was started from, default
 *     `mode: 'development'`): discovers all sibling worktrees
 *     and the main checkout, spawns a child Vite for each on a
 *     random local port, and registers a proxy that forwards
 *     `<base>/worktrees/<slug>/` to the child. A JSON data island
 *     is injected into `index.html` so the `<WorktreeSwitcher />`
 *     component can render the dropdown without a server
 *     roundtrip.
 *
 *   - **Child** (spawned by the bootstrap with
 *     `mode: 'worktree-child'`): does nothing. The bootstrap owns
 *     the proxy and the data island.
 *
 * URL model
 * ---------
 *   `<base>/`                                  -> bootstrap's own app
 *   `<base>/worktrees/main/`                   -> main checkout (if not bootstrap)
 *   `<base>/worktrees/<name>/`                 -> flat sibling worktree `<name>`
 *   `<base>/worktrees/<tag>/<name>/`           -> nested sibling worktree `<tag>/<name>`
 *
 * The browser-facing `<slug>` is `<tag>/<name>` for nested worktrees
 * and just `<name>` for flat ones, so two worktrees with the same
 * leaf name in different tags never collide on the proxy URL.
 *
 * HMR works for every worktree independently because each child
 * has its own chokidar watcher. The browser's HMR WebSocket is
 * forwarded by the proxy (`ws: true`).
 *
 * This plugin does NOT mutate the filesystem at runtime — no
 * junctions, no symlinks, no `src.main/` backups. All worktrees
 * stay in their normal layout; switching is just a URL change.
 */
import { createServer, type Plugin, type ViteDevServer } from 'vite'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

/** Vite mode used when the bootstrap spawns a child server. */
const CHILD_MODE = 'worktree-child'

/** Information about a single worktree exposed via the data island. */
export interface WorktreeInfo {
  /**
   * Leaf directory name (the worktree folder). For a nested
   * worktree at `.worktrees/fix/invoice-logic-bug/` this is
   * `invoice-logic-bug`. For a flat worktree it is the single
   * directory name under `.worktrees/`.
   */
  name: string
  /**
   * Tag subdirectory for nested worktrees (e.g. `fix`). Absent for
   * flat worktrees, the main checkout, and the bootstrap.
   */
  tag?: string
  /** Absolute path to the worktree directory. */
  path: string
  /** Resolved branch name, or `null` if detached HEAD. */
  branch: string | null
  /** Whether the worktree has its own `vite.config.ts`. */
  hasViteConfig: boolean
}

/** Data island injected into the bootstrap's `index.html`. */
export interface WorktreeData {
  /** Name of the bootstrap worktree. */
  bootstrap: string
  /**
   * Tag of the bootstrap worktree when it is itself nested
   * (e.g. `fix`). Absent when the bootstrap is the main checkout
   * or a flat worktree. The component uses it to resolve the
   * bootstrap's own proxy URL.
   */
  bootstrapTag?: string
  /** All reachable worktrees. */
  worktrees: WorktreeInfo[]
}

/** Internal: a spawned child Vite + the port it listens on. */
interface ChildHandle {
  wt: WorktreeInfo
  port: number
  server: ViteDevServer
  /** The `base` we passed to the child — also the proxy prefix. */
  base: string
}

/**
 * Whether `p` contains a `.worktrees` path segment (i.e. the
 * path is inside a worktree, not the main checkout). Each
 * worktree has its own `.worktrees/` directory (which may be
 * empty), so a naive `fs.existsSync('.worktrees')` check would
 * mistake a worktree for the main checkout.
 */
function isInsideWorktrees(p: string): boolean {
  return p.split(/[\\/]+/).includes('.worktrees')
}

/**
 * Walk up from `cwd` to find the parent of `.worktrees/` that
 * is itself NOT inside any `.worktrees/` directory. That is the
 * main checkout. Returns `cwd` itself if no such parent exists
 * (i.e. we are not in a worktree setup at all).
 *
 * @param cwd - Directory to start the search from.
 * @returns Absolute path to the main checkout.
 */
function findMainCheckout(cwd: string): string {
  let dir = path.resolve(cwd)
  for (let i = 0; i < 8; i += 1) {
    const wt = path.join(dir, '.worktrees')
    if (fs.existsSync(wt) && !isInsideWorktrees(dir)) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(cwd)
}

/**
 * Whether `dir` is itself a git worktree (has a `.git` file or
 * directory). Used to distinguish a worktree from a tag folder
 * during recursive discovery.
 */
function isWorktreeDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, '.git'))
}

/**
 * Read the branch from a worktree's `.git` text file. The text
 * file contains a `gitdir:` pointer; we follow it to read HEAD
 * directly. Avoids spawning `git` (which sometimes mis-resolves
 * mixed Windows/WSL paths).
 *
 * @param worktreePath - Absolute path to the worktree directory.
 * @returns Branch name, or `null` if unavailable / detached HEAD.
 */
function readBranch(worktreePath: string): string | null {
  const gitEntry = path.join(worktreePath, '.git')
  if (!fs.existsSync(gitEntry)) return null
  let gitDir: string
  try {
    const stat = fs.lstatSync(gitEntry)
    if (stat.isDirectory()) {
      gitDir = gitEntry
    } else if (stat.isFile()) {
      const raw = fs.readFileSync(gitEntry, 'utf-8').trim()
      if (!raw.startsWith('gitdir:')) return null
      gitDir = raw.slice(7).trim()
    } else {
      return null
    }
  } catch {
    return null
  }
  try {
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf-8').trim()
    const m = head.match(/^ref:\s*refs\/heads\/(.+)$/)
    return m ? (m[1] ?? null) : head.slice(0, 7)
  } catch {
    return null
  }
}

/**
 * Build a `WorktreeInfo` from an on-disk worktree directory.
 */
function makeWorktreeInfo(
  name: string,
  fullPath: string,
  tag?: string,
): WorktreeInfo {
  return {
    name,
    tag,
    path: fullPath,
    branch: readBranch(fullPath),
    hasViteConfig: fs.existsSync(path.join(fullPath, 'vite.config.ts')),
  }
}

/**
 * Discover sibling worktrees under `<main>/.worktrees/`.
 *
 * Two layouts are supported:
 *   - **Flat** — `.worktrees/<name>/` (legacy, the entry is itself
 *     a worktree, identified by having a `.git` file).
 *   - **Nested** — `.worktrees/<tag>/<name>/` (the entry is a tag
 *     folder; the children are the worktrees).
 *
 * Mixed layouts are tolerated: a directory is treated as a tag
 * folder only if it does NOT have its own `.git`. This means a
 * flat worktree is never misread as a tag, and a tag folder is
 * never misread as a worktree.
 *
 * @param mainPath - Absolute path to the main checkout.
 * @returns Array of worktree descriptors, sorted by tag then name.
 */
function discoverAll(mainPath: string): WorktreeInfo[] {
  const dir = path.join(mainPath, '.worktrees')
  if (!fs.existsSync(dir)) return []
  const out: WorktreeInfo[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const entryPath = path.join(dir, entry.name)
    if (isWorktreeDir(entryPath)) {
      // Flat layout: the directory itself is a worktree.
      out.push(makeWorktreeInfo(entry.name, entryPath))
      continue
    }
    // Tag folder: recurse one level and pick up the worktrees.
    for (const child of fs.readdirSync(entryPath, { withFileTypes: true })) {
      if (!child.isDirectory()) continue
      const childPath = path.join(entryPath, child.name)
      if (!isWorktreeDir(childPath)) continue
      out.push(makeWorktreeInfo(child.name, childPath, entry.name))
    }
  }
  return out.sort((a, b) => {
    const ka = a.tag ? `${a.tag}/${a.name}` : a.name
    const kb = b.tag ? `${b.tag}/${b.name}` : b.name
    return ka.localeCompare(kb)
  })
}

/**
 * Determine the bootstrap worktree's identity from its on-disk
 * location. Returns `name = 'main'` (no tag) when `cwd` is the
 * main checkout. Otherwise `name` is the leaf directory and
 * `tag` is set only when `cwd` is `<main>/.worktrees/<tag>/<name>/`.
 *
 * @param cwd - Absolute path Vite was started from.
 * @param mainPath - Absolute path to the main checkout.
 */
function parseBootstrapLocation(
  cwd: string,
  mainPath: string,
): { name: string; tag?: string; isMain: boolean } {
  const resolvedCwd = path.resolve(cwd)
  const resolvedMain = path.resolve(mainPath)
  if (resolvedCwd === resolvedMain) {
    return { name: 'main', isMain: true }
  }
  const parent = path.dirname(resolvedCwd)
  const grandParent = path.dirname(parent)
  const tagDir = path.join(resolvedMain, '.worktrees')
  if (grandParent === tagDir) {
    return {
      name: path.basename(resolvedCwd),
      tag: path.basename(parent),
      isMain: false,
    }
  }
  return { name: path.basename(resolvedCwd), isMain: false }
}

/**
 * Browser-facing slug for a worktree. Nested worktrees use
 * `<tag>/<name>` so the proxy URL stays unique across tags; flat
 * worktrees and the main checkout use just the name.
 */
function worktreeSlug(wt: WorktreeInfo): string {
  return wt.tag ? `${wt.tag}/${wt.name}` : wt.name
}

/**
 * Find a free TCP port on 127.0.0.1 by binding to port 0. The
 * race window between the close and the consumer's `listen()` is
 * microseconds, so a coincidental collision is extremely unlikely.
 *
 * @returns A port number that is currently free.
 */
async function findFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        srv.close(() => resolve(port))
      } else {
        reject(new Error('Could not determine bound port'))
      }
    })
  })
}

/**
 * Normalize a Vite `base` value to a string with no trailing
 * slash. `undefined` / `'/'` both collapse to empty string.
 */
function normalizeBase(raw: string | undefined): string {
  let base = raw ?? '/'
  while (base.length > 1 && base.endsWith('/')) {
    base = base.slice(0, -1)
  }
  return base
}

/**
 * Vite plugin factory. Call once in `vite.config.ts`.
 *
 * @returns The configured Vite plugin.
 */
export function worktreeSwitcher(): Plugin {
  /** Whether this server instance is a child of another worktree-switcher. */
  let isChild = false
  /** Name of the bootstrap worktree (set in the bootstrap; unused in children). */
  let bootstrapName = 'main'
  /** Tag of the bootstrap worktree when it is nested; undefined otherwise. */
  let bootstrapTag: string | undefined
  /** All reachable worktrees (set in the bootstrap; unused in children). */
  let worktrees: WorktreeInfo[] = []
  /** Spawned child Vite servers, keyed by worktree slug (not name). */
  const children = new Map<string, ChildHandle>()

  return {
    name: 'worktree-switcher',
    apply: 'serve',

    /**
     * Discover worktrees and spawn child Vite servers before the
     * bootstrap server starts. The `config` hook runs once at
     * startup, before any server is created.
     */
    async config(config, { command }) {
      if (command !== 'serve') return config
      isChild = config.mode === CHILD_MODE

      const cwd = path.resolve(config.root ?? process.cwd())
      const mainPath = findMainCheckout(cwd)
      const loc = parseBootstrapLocation(cwd, mainPath)
      bootstrapName = loc.name
      bootstrapTag = loc.tag

      // Build the registry: bootstrap + main (if not bootstrap) + siblings
      const registry: WorktreeInfo[] = [
        {
          name: bootstrapName,
          tag: bootstrapTag,
          path: cwd,
          branch: readBranch(cwd),
          hasViteConfig: true,
        },
      ]
      if (!loc.isMain) {
        registry.push({
          name: 'main',
          path: mainPath,
          branch: readBranch(mainPath),
          hasViteConfig: fs.existsSync(path.join(mainPath, 'vite.config.ts')),
        })
      }
      for (const sibling of discoverAll(mainPath)) {
        if (path.resolve(sibling.path) === path.resolve(cwd)) continue
        registry.push(sibling)
      }

      worktrees = registry

      if (isChild) return config

      // Spawn a child Vite for every non-bootstrap entry
      for (const wt of registry) {
        const slug = worktreeSlug(wt)
        if (wt.name === bootstrapName && wt.tag === bootstrapTag) continue
        if (!wt.hasViteConfig) {
          console.warn(
            `[worktree-switcher] ${slug}: no vite.config.ts, skipping`,
          )
          continue
        }
        const port = await findFreePort()
        // Override the child's `base` so that URLs in the served
        // index.html point to the proxied path
        // (`/elszamolos/worktrees/<tag>/<name>/...` for nested or
        // `/elszamolos/worktrees/<name>/...` for flat). Without this
        // override, the child emits absolute `/elszamolos/...`
        // asset URLs that the browser resolves against the
        // document origin, bypassing the proxy and hitting the
        // bootstrap's own files.
        const childBase = `${normalizeBase(config.base)}/worktrees/${slug}/`
        const childServer = await createServer({
          root: wt.path,
          configFile: path.join(wt.path, 'vite.config.ts'),
          mode: CHILD_MODE,
          base: childBase,
          server: { port, host: '127.0.0.1', strictPort: true },
          clearScreen: false,
          logLevel: 'warn',
        })
        await childServer.listen()
        children.set(slug, { wt, port, server: childServer, base: childBase })
        console.log(
          `[worktree-switcher] child ${slug} -> http://127.0.0.1:${port}/ (base=${childBase})`,
        )
      }

      // Register proxy entries. The proxy forwards the FULL URL
      // (no rewrite) so the child's `base` can strip the proxied
      // prefix and serve the right file. `ws: true` forwards
      // HMR WebSocket upgrades too.
      config.server = config.server ?? {}
      config.server.proxy = config.server.proxy ?? {}
      for (const [slug, handle] of children) {
        const prefix = handle.base.replace(/\/$/, '')
        config.server.proxy[prefix] = {
          target: `http://127.0.0.1:${handle.port}`,
          changeOrigin: true,
          ws: true,
        }
        console.log(
          `[worktree-switcher] proxy [${slug}] ${prefix} -> http://127.0.0.1:${handle.port}/`,
        )
      }

      console.log(
        `[worktree-switcher] bootstrap=${worktreeSlug({ name: bootstrapName, tag: bootstrapTag, path: cwd, branch: null, hasViteConfig: true })} (${worktrees.length} worktrees)`,
      )

      return config
    },

    /**
     * Inject the worktree data island into `index.html` so the
     * React component can render the dropdown without a server
     * roundtrip. Skipped in child servers (they have no
     * dropdown — the bootstrap's component lives in the shell).
     */
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const data: WorktreeData = {
          bootstrap: bootstrapName,
          bootstrapTag,
          worktrees,
        }
        // Escape characters that would break the inline JSON
        const safe = JSON.stringify(data)
          .replace(/</g, '\\u003c')
          .replace(/>/g, '\\u003e')
          .replace(/&/g, '\\u0026')
        const script = `<script id="worktree-data" type="application/json">${safe}</script>`
        return html.replace('</head>', `${script}</head>`)
      },
    },

    /**
     * Tear down child servers when the bootstrap exits. The OS
     * reaps the children when the parent process dies anyway,
     * but closing them gracefully is cleaner (frees ports,
     * kills background work in the child).
     */
    configureServer() {
      if (isChild) return
      const cleanup = (): void => {
        for (const [, handle] of children) {
          handle.server.close().catch(() => {
            // best-effort
          })
        }
      }
      process.once('SIGINT', () => {
        cleanup()
        process.exit(0)
      })
      process.once('SIGTERM', () => {
        cleanup()
        process.exit(0)
      })
      process.once('exit', cleanup)
    },
  }
}
