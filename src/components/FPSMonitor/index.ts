/**
 * @file index.ts
 *
 * Barrel / re-export module for the {@link FPSMonitor} component.
 *
 * This file aggregates and re-exports all public API surface from the
 * `FPSMonitor` submodule so consumers can import from the shorter path
 * `'@/components/FPSMonitor'` rather than reaching into the implementation
 * file directly.
 */

/**
 * Re-export all public exports from the {@link FPSMonitor} component module.
 *
 * Currently the module exposes the following named export:
 *
 * | Export        | Kind       | Description                               |
 * |---------------|------------|-------------------------------------------|
 * | `FPSMonitor`  | Component  | Real-time FPS overlay panel (see impl.).  |
 */
export * from './FPSMonitor';
