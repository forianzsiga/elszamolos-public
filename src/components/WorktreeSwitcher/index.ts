/**
 * @file WorktreeSwitcher barrel module.
 * Aggregates and re-exports the public API of the WorktreeSwitcher component.
 */

/**
 * WorktreeSwitcher component.
 *
 * Dev-only dropdown that lets the developer switch between git
 * worktrees from inside the running application. See
 * `WorktreeSwitcher.tsx` for the implementation and
 * `tools/vite-plugins/worktree-switcher.ts` for the Vite plugin
 * that powers the switch.
 */
export { WorktreeSwitcher } from './WorktreeSwitcher'
export type {
  WorktreeInfo,
  WorktreeData,
  WorktreeSwitcherProps,
} from './types'
