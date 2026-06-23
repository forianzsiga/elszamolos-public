/**
 * @file WorktreeSwitcher.tsx
 *
 * A dropdown that lets the developer switch between git worktrees
 * from inside the running application. Worktrees are discovered
 * by the `worktree-switcher` Vite plugin (see
 * `tools/vite-plugins/worktree-switcher.ts`) at startup and
 * exposed as a JSON data island in `index.html`; switching is
 * just a navigation to a different URL path — no in-process Vite
 * restart, no filesystem mutation.
 *
 * The component is dev-only — it short-circuits to `null` in
 * production builds OR in a child worktree (no data island
 * because the plugin skips injection in children).
 *
 * URL model
 * ----------
 * The plugin sets `tag` on nested worktree entries (under
 * `.worktrees/<tag>/<name>/`) and leaves it undefined on flat
 * entries and the main checkout. The proxy URL mirrors that:
 *
 *   flat:    `<base>/worktrees/<name>/`
 *   nested:  `<base>/worktrees/<tag>/<name>/`
 *
 * The dropdown displays the leaf folder name on the LEFT and the
 * full branch on the RIGHT (e.g. `invoice-logic-bug` /
 * `fix/invoice-logic-bug`).
 */
import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { ResponsiveTooltip } from '../ResponsiveTooltip'
import type { WorktreeData, WorktreeInfo, WorktreeSwitcherProps } from './types'
import i11n from './WorktreeSwitcher-i11n.json'
import './WorktreeSwitcher.css'

/** `id` of the `<script type="application/json">` data island. */
const DATA_ISLAND_ID = 'worktree-data'

/** Strip Vite's `BASE_URL` trailing slash and any worktree prefix. */
const getBaseUrl = (): string => {
  const rawBase = import.meta.env.BASE_URL
  const base = rawBase.endsWith('/') && rawBase !== '/' ? rawBase.slice(0, -1) : rawBase
  const worktreeIdx = base.indexOf('/worktrees/')
  return worktreeIdx !== -1 ? base.substring(0, worktreeIdx) : base
}
const BASE = getBaseUrl()

/**
 * Build the browser-facing URL for a worktree. Nested worktrees
 * use `<tag>/<name>` so the proxy URL stays unique across tags.
 * Flat worktrees and the main checkout use just `<name>`.
 */
function worktreeHref(wt: WorktreeInfo): string {
  return wt.tag
    ? `${BASE}/worktrees/${wt.tag}/${wt.name}/`
    : `${BASE}/worktrees/${wt.name}/`
}

/**
 * URL prefix (no trailing slash) used to match the current path
 * against a worktree entry. Mirrors {@link worktreeHref}.
 */
function worktreePrefix(wt: WorktreeInfo): string {
  return worktreeHref(wt).replace(/\/$/, '')
}

/**
 * Read the worktree data island from `index.html`. Returns
 * `null` when the island is missing (production build, or this
 * page is being served by a child Vite).
 */
function readDataIsland(): WorktreeData | null {
  if (typeof document === 'undefined') return null
  const el = document.getElementById(DATA_ISLAND_ID)
  if (!el?.textContent) return null
  try {
    return JSON.parse(el.textContent) as WorktreeData
  } catch {
    return null
  }
}

/**
 * Determine which worktree is "active" by inspecting the current
 * URL. The active worktree is identified by its on-disk `path`
 * (always unique). Falls back to the bootstrap's entry.
 */
function activePath(data: WorktreeData): string {
  const path = window.location.pathname
  for (const wt of data.worktrees) {
    const prefix = worktreePrefix(wt)
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return wt.path
    }
  }
  const bootstrap = data.worktrees.find(
    (w) => w.name === data.bootstrap && w.tag === data.bootstrapTag,
  )
  return bootstrap?.path ?? ''
}

/**
 * The dropdown UI. Renders the active worktree's branch as a
 * button; when open, shows a menu of all worktrees as `<a>`
 * links to the corresponding proxy URL. Navigation is handled by
 * the browser — the bootstrap Vite's proxy routes the request to
 * the correct child server.
 *
 * @param props           Component props.
 * @param props.className Optional class name appended to the root.
 * @returns The dropdown element, or `null` when no data island is present.
 */
export const WorktreeSwitcher: React.FC<WorktreeSwitcherProps> = ({
  className,
}) => {
  const { language } = useLanguage()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Data island is read once on first render. The plugin injects
  // it at startup; the user must restart Vite to add/remove a
  // worktree, so the data is stable for the lifetime of the page.
  const data = readDataIsland()

  // Close the menu when a click lands outside the component.
  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (event: MouseEvent): void => {
      const node = containerRef.current
      if (
        node &&
        event.target instanceof Node &&
        !node.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [open])

  if (!import.meta.env.DEV || !data) {
    return null
  }

  const lang: 'en' | 'hu' = language === 'hu' ? 'hu' : 'en'
  const bundle = i11n as Record<'en' | 'hu', Record<string, string>>
  const t = (key: string): string => bundle[lang]?.[key] ?? key

  const active = activePath(data)
  const activeEntry = data.worktrees.find((w) => w.path === active)
  const triggerLabel = activeEntry?.branch ?? activeEntry?.name ?? active

  return (
    <div
      className={`worktree-switcher ${className ?? ''}`.trim()}
      ref={containerRef}
    >
      <ResponsiveTooltip title={t('tooltip.open')}>
        <button
          type="button"
          className="worktree-switcher__trigger"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="worktree-switcher__branch">{triggerLabel}</span>
          <span className="worktree-switcher__caret" aria-hidden="true">
            ▾
          </span>
        </button>
      </ResponsiveTooltip>
      {open && (
        <ul className="worktree-switcher__menu" role="listbox">
          <li className="worktree-switcher__header" role="presentation">
            {t('menu.header')}
          </li>
          {data.worktrees.map((w) => {
            const isActive = w.path === active
            return (
              <li
                key={w.path}
                role="option"
                aria-selected={isActive}
                className={`worktree-switcher__item${
                  isActive ? ' worktree-switcher__item--active' : ''
                }`}
              >
                <ResponsiveTooltip title={t('tooltip.select')}>
                  <a
                    href={worktreeHref(w)}
                    onClick={() => setOpen(false)}
                    title={w.path}
                  >
                    <span className="worktree-switcher__item-name">
                      {w.name}
                    </span>
                    {w.branch && (
                      <span className="worktree-switcher__item-branch">
                        {w.branch}
                      </span>
                    )}
                    {isActive && (
                      <span
                        className="worktree-switcher__item-check"
                        aria-hidden="true"
                      >
                        ●
                      </span>
                    )}
                  </a>
                </ResponsiveTooltip>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
