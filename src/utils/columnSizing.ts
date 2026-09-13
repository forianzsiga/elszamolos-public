/**
 * @file Utility functions for calculating column sizing in data tables.
 * Provides helpers to measure text width and compute minimum header widths
 * based on label content, sort controls, and filter controls.
 */

const HEADER_LABEL_FONT = '700 14px "Roboto", "Helvetica", "Arial", sans-serif';
const HEADER_HORIZONTAL_PADDING_PX = 32;
const HEADER_CONTROL_GAP_PX = 4;
const HEADER_ICON_BUTTON_WIDTH_PX = 32;
const RESIZE_HANDLE_CLEARANCE_PX = 12;

/** Options for configuring the minimum width calculation of a column header. */
export interface HeaderMinimumWidthOptions {
    /** The text label of the column header. */
    label: string;
    /** Whether the column is sortable (adds a sort icon button). Defaults to true. */
    sortable?: boolean;
    /** Whether the column is filterable (adds a filter icon button). Defaults to false. */
    filterable?: boolean;
}

/**
 * Measures the width of a text string when rendered with a given font.
 *
 * Uses a canvas 2D context to perform the measurement without DOM rendering.
 *
 * @param text - The text string to measure.
 * @param font - The CSS font shorthand string to apply (e.g. "700 14px Roboto, sans-serif").
 * @returns The measured width of the text in pixels. Returns 0 if the canvas context is unavailable.
 */
export const measureText = (text: string, font: string): number => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return 0;
    context.font = font;
    return context.measureText(text).width;
};

/**
 * Calculates the minimum width required for a column header.
 *
 * Considers the label text width (including padding and resize-handle clearance)
 * as well as the combined width of any sort/filter control buttons.
 * Returns the larger of the two computed widths.
 *
 * @param options - Configuration options for the header.
 * @param options.label - The text label of the column header.
 * @param options.sortable - Whether a sort icon button is shown (default true).
 * @param options.filterable - Whether a filter icon button is shown (default false).
 * @returns The minimum header width in pixels.
 */
export const getHeaderMinimumWidth = ({
    label,
    sortable = true,
    filterable = false
}: HeaderMinimumWidthOptions): number => {
    const labelWidth = Math.ceil(
        measureText(label, HEADER_LABEL_FONT) + HEADER_HORIZONTAL_PADDING_PX + RESIZE_HANDLE_CLEARANCE_PX
    );

    const controlCount = Number(filterable) + Number(sortable);
    const controlsWidth = controlCount > 0
        ? Math.ceil(
            HEADER_HORIZONTAL_PADDING_PX +
            RESIZE_HANDLE_CLEARANCE_PX +
            (controlCount * HEADER_ICON_BUTTON_WIDTH_PX) +
            ((controlCount - 1) * HEADER_CONTROL_GAP_PX)
        )
        : 0;

    return Math.max(labelWidth, controlsWidth);
};
