/**
 * @file WorktreeSwitcher types.
 *
 * Re-exports the public types used by the WorktreeSwitcher React
 * component. The shapes mirror the data island injected by the
 * `worktree-switcher` Vite plugin (see
 * `tools/vite-plugins/worktree-switcher.ts`).
 *
 * Worktree layout
 * ---------------
 * The Vite plugin discovers worktrees under `<repo>/.worktrees/` in
 * two layouts:
 *
 *   - **Flat** (legacy):     `.worktrees/<name>/`
 *   - **Nested** (current):  `.worktrees/<tag>/<name>/`
 *
 * The plugin sets `tag` on nested entries and leaves it undefined on
 * flat ones. The component uses `tag` to construct the correct proxy
 * URL (`/worktrees/<tag>/<name>/` vs `/worktrees/<name>/`).
 */

/** Information about a single worktree. */
export interface WorktreeInfo {
  /**
   * Leaf directory name — the worktree folder. For a nested worktree
   * at `.worktrees/fix/invoice-logic-bug/` this is `invoice-logic-bug`.
   * Rendered on the LEFT side of the dropdown row.
   */
  name: string
  /**
   * Tag subdirectory under `.worktrees/` for nested worktrees
   * (e.g. `fix`). Undefined for flat worktrees, the main checkout,
   * and any non-nested bootstrap. Used to build the proxy URL.
   */
  tag?: string
  /** Absolute path to the worktree directory. */
  path: string
  /** Resolved branch name, or `null` if detached HEAD. */
  branch: string | null
  /** Whether the worktree has its own `vite.config.ts`. */
  hasViteConfig: boolean
}

/** Data island shape (injected by the plugin into `index.html`). */
export interface WorktreeData {
  /** Name of the bootstrap worktree. */
  bootstrap: string
  /**
   * Tag of the bootstrap worktree when it is itself nested
   * (e.g. `fix`). Undefined when the bootstrap is the main checkout
   * or a flat worktree. The component uses it to resolve the
   * bootstrap's own URL.
   */
  bootstrapTag?: string
  /** All reachable worktrees (in display order). */
  worktrees: WorktreeInfo[]
}

/** Properties for the {@link WorktreeSwitcher} component. */
export interface WorktreeSwitcherProps {
  /** Optional class name appended to the root element. */
  className?: string
}
