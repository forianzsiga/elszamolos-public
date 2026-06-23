/**
 * @file Custom hook that automatically calculates and distributes column widths
 * for a virtualised data table based on header text, sampled cell content, and
 * the available container width. Columns with a `flex` property receive
 * proportionally more of any remaining space.
 */

import React from 'react';
import type { ColumnDef } from '../components/VirtualDataTable';
import { getHeaderMinimumWidth, measureText } from '../utils/columnSizing';

/**
 * Custom hook to calculate optimal column widths for a virtualised data table.
 *
 * Analyses header labels and a sample of cell content to determine the minimum
 * width required for each column. If the total computed width is smaller than
 * the available container width the remaining space is distributed — flex
 * columns receive a proportionally larger share, otherwise every column gets
 * an equal portion.
 *
 * @typeParam T - The type of each row in the data array.
 * @param columns - Column definitions used to build the table.
 * @param data - The full row dataset. Only the first `sampleSize` rows are
 *               measured for content width.
 * @param containerWidth - The pixel width of the table container. When
 *                         `null` or `0` the recalculation is skipped.
 * @param sampleSize - Number of rows to sample when measuring content text
 *                     width (default `50`).
 * @param enabled - When `false` the width calculation effect is skipped and
 *                  the last computed widths are preserved (default `true`).
 * @returns A record mapping each column `id` to its computed pixel width.
 */
export const useAutoColumnWidths = <T,>(
    columns: ColumnDef<T>[],
    data: T[],
    containerWidth: number | null,
    sampleSize = 50, // Number of rows to sample for width calculation
    enabled = true
) => {
    const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(() => {
        const initialWidths: Record<string, number> = {};
        columns.forEach(col => {
            initialWidths[col.id] = col.width || col.minWidth || 150;
        });
        return initialWidths;
    });

    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        if (containerWidth === null || containerWidth === 0) {
            return;
        }

        const font = '14px "Roboto", "Helvetica", "Arial", sans-serif'; // Corresponds to MUI TableCell typography
        const padding = 0; // Ignore cell padding in width calculation

        // Empty table: base widths on minWidth and distribute remaining space evenly.
        if (data.length === 0) {
            const calculatedWidths: Record<string, number> = {};
            let totalWidth = 0;
            columns.forEach(col => {
                const requiredWidth = Math.max(col.minWidth || 50, 50);
                calculatedWidths[col.id] = requiredWidth;
                totalWidth += requiredWidth;
            });

            if (totalWidth < containerWidth && columns.length > 0) {
                const remainingSpace = containerWidth - totalWidth;
                const share = remainingSpace / columns.length;
                columns.forEach(col => {
                    calculatedWidths[col.id] += share;
                });
            }

            setColumnWidths(calculatedWidths);
            return;
        }

        // Calculate header widths
        const headerWidths: Record<string, number> = {};
        columns.forEach(col => {
            headerWidths[col.id] = Math.max(
                getHeaderMinimumWidth({
                    label: col.label,
                    sortable: col.sortable !== false,
                    filterable: Boolean(col.filterOptions)
                }),
                measureText(col.label, font) + padding,
                col.contentMinWidth ?? 0,
                col.headerMinWidth ?? 0,
                col.minWidth || 50
            );
        });

        // Calculate content widths from a sample of data
        const sample = data.slice(0, sampleSize);
        const contentWidths: Record<string, number> = {};
        columns.forEach(col => {
            let max = 0;
            sample.forEach((item, index) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cellContent = col.renderCell ? col.renderCell(item, index) : (item as any)[col.id];
                const text = typeof cellContent === 'string' || typeof cellContent === 'number'
                    ? String(cellContent)
                    : ''; 
                if (text) {
                    const width = measureText(text, font) + padding;
                    if (width > max) {
                        max = width;
                    }
                }
            });
            contentWidths[col.id] = max;
        });

        const calculatedWidths: Record<string, number> = {};
        let totalWidth = 0;
        const flexColumns: ColumnDef<T>[] = [];

        columns.forEach(col => {
            const requiredWidth = Math.max(
                headerWidths[col.id] || 0,
                contentWidths[col.id] || 0,
                col.minWidth || 50
            );
            calculatedWidths[col.id] = requiredWidth;
            totalWidth += requiredWidth;

            if (col.flex) {
                flexColumns.push(col);
            }
        });

        // If total width is less than container width, distribute the rest
        if (containerWidth && totalWidth < containerWidth) {
            const remainingSpace = containerWidth - totalWidth;
            let totalFlex = flexColumns.reduce((sum, col) => sum + (col.flex || 0), 1);
            if (totalFlex === 0 && flexColumns.length > 0) totalFlex = flexColumns.length;


            if (flexColumns.length > 0) {
                 flexColumns.forEach(col => {
                    const share = (col.flex || 1) / totalFlex;
                    calculatedWidths[col.id] += remainingSpace * share;
                });
            } else {
                // If no flex columns, distribute equally
                const share = remainingSpace / columns.length;
                columns.forEach(col => {
                    calculatedWidths[col.id] += share;
                });
            }
        }
        
        setColumnWidths(calculatedWidths);

    }, [columns, data, containerWidth, sampleSize, enabled]);

    return columnWidths;
};