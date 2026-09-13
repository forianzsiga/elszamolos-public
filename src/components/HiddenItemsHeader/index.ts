/**
 * @file index.ts
 * Barrel export for the HiddenItemsHeader component.
 * Re-exports the default export from HiddenItemsHeader as a named export
 * to allow both `import { HiddenItemsHeader }` and `import HiddenItemsHeader` usage.
 */

/**
 * HiddenItemsHeader component.
 *
 * Renders a collapsible header row for hidden job teeth items. It provides
 * a toggle-expand button, a "select all" checkbox with indeterminate state
 * support, and a localised label. The component is used within the job-teeth
 * table to group and manage hidden (archived) items.
 *
 * @param props             - The component props.
 * @param props.mode        - Visual theme mode: `'light'` or `'dark'`.
 * @param props.isHiddenExpanded   - Whether the hidden items section is currently expanded.
 * @param props.onToggleExpand     - Callback fired when the header row is clicked to toggle expand/collapse.
 * @param props.gridTemplateColumns - CSS `grid-template-columns` value applied to the header row for column alignment.
 * @param props.isAllHiddenSelected - Whether all hidden items are currently selected (drives checkbox checked state).
 * @param props.isSomeHiddenSelected - Whether only a subset of hidden items are selected (drives checkbox indeterminate state).
 * @param props.onToggleSelectAllHidden - Callback fired when the select-all checkbox is toggled; receives the new checked boolean.
 * @param props.label               - Localised label string displayed as the header text.
 *
 * @returns The HiddenItemsHeader React component.
 */
export { default as HiddenItemsHeader } from './HiddenItemsHeader';
