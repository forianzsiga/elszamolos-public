/**
 * @file Shared CSS style constants and UI/column-width constants used throughout the application.
 */

/** Shared CSS style object for flex-based table cells. */
export const FLEX_CELL_STYLE: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    overflow: 'hidden',
    borderBottom: 'none',
    borderRight: '1px solid var(--mui-palette-divider)',
    padding: '8px 8px',
    flexShrink: 0,
    height: '100%'
};

/** Total horizontal padding (in pixels) applied inside a table cell. */
export const CELL_HORIZONTAL_PADDING_PX = 32;

/** Height (in pixels) of the table header row. */
export const HEADER_ROW_HEIGHT = 24;

/** Duration (in milliseconds) that a toast notification stays visible. */
export const TOAST_DURATION = 8000;

/** Interval (in milliseconds) between toast progress ticks. */
export const TOAST_TICK = 100;

/** Debounce delay (in milliseconds) for search input. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Width (in pixels) of the side drawer. */
export const DRAWER_WIDTH = 240;

/** Minimum allowed column width (in pixels). */
export const MIN_COLUMN_WIDTH = 50;

/** Default column width (in pixels) when no explicit width is set. */
export const DEFAULT_COLUMN_WIDTH = 150;

/** Extra horizontal padding (in pixels) reserved inside each column. */
export const COLUMN_PADDING = 48;
