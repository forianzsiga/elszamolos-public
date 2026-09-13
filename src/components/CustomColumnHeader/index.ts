/** @file CustomColumnHeader/index.ts
 *  Barrel module that re-exports all public API members from the CustomColumnHeader
 *  component module. Consumers should import from this barrel rather than from the
 *  implementation file directly.
 */

/** Custom column header with sort and column filter controls.
 *  Re-exports the {@link CustomColumnHeader} component, which renders a data-grid
 *  column header augmented with a sort-direction toggle icon and a per-column
 *  filter dropdown. See the component source for full documentation.
 */
export * from './CustomColumnHeader';
