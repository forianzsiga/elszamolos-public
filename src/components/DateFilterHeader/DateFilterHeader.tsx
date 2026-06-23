/** @file DateFilterHeader.tsx
 *  @brief A column header component that combines a sortable, resizable date column header with an embedded date-range filter.
 *
 *  This component renders a table column header containing a label, a date-range filter control
 *  (DateColumnFilter), a sort-direction indicator, and a resize handle. It uses the project's
 *  language context and i18n resource file for localised tooltips.
 */

import { Box, Typography } from '@mui/material';
import { ArrowUpward, ArrowDownward, Sort } from '@mui/icons-material';
import { DateColumnFilter } from '../DateColumnFilter/DateColumnFilter';
import { ResizeHandle } from '../ResizeHandle/ResizeHandle';
import { useCallback } from 'react';
import './DateFilterHeader.css';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './DateFilterHeader-i11n.json';
import { ResponsiveTooltip } from '../ResponsiveTooltip';

/** Props accepted by the DateFilterHeader component. */
interface DateFilterHeaderProps {
    /** The display label shown in the header. */
    label: string;
    /** The data field key this header represents. */
    field: string;
    /** The current width of the column in pixels. */
    width: number;
    /** The minimum allowed width for the column in pixels. */
    minWidth: number;
    /** The current sort configuration, or null if the column is not sorted. */
    sortConfig: { key: string, direction: 'asc' | 'desc' } | null;
    /** Callback invoked when the user clicks the header to toggle sorting. Receives the field key. */
    onSort: (key: string) => void;
    /** Callback invoked when the user finishes resizing the column. Receives the new width. */
    onResize: (width: number) => void;
    /** The current date filter range. */
    dateFilter: { start: string, end: string };
    /** Callback invoked when the date filter changes. Receives the new start and end values. */
    onDateFilterChange: (start: string, end: string) => void;
    /** Optional left padding override. Defaults to '8px'. */
    paddingLeft?: string | number;
}

/**
 * A column header component that renders a sortable, resizable label and an embedded date-range filter.
 *
 * @param props - The component props.
 * @param props.label - The display label shown in the header.
 * @param props.field - The data field key this header represents.
 * @param props.width - The current width of the column in pixels.
 * @param props.minWidth - The minimum allowed width for the column in pixels.
 * @param props.sortConfig - The current sort configuration, or null if the column is not sorted.
 * @param props.onSort - Callback invoked when the user clicks the header to toggle sorting.
 * @param props.onResize - Callback invoked when the user finishes resizing the column.
 * @param props.dateFilter - The current date filter range.
 * @param props.onDateFilterChange - Callback invoked when the date filter changes.
 * @param props.paddingLeft - Optional left padding override. Defaults to '8px'.
 * @returns The rendered DateFilterHeader element.
 */
export const DateFilterHeader = ({
    label,
    field,
    width,
    minWidth,
    sortConfig,
    onSort,
    onResize,
    dateFilter,
    onDateFilterChange,
    paddingLeft = '8px'
}: DateFilterHeaderProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;

    /**
     * Renders the appropriate sort icon based on the current sort configuration.
     *
     * When the column is not the active sort key, a neutral sort icon is shown.
     * When it is the active sort key, an upward or downward arrow is displayed
     * depending on the sort direction.
     *
     * @returns A React node representing the sort icon.
     */
    const renderSortIcon = () => {
        if (sortConfig?.key !== field) {
            return <Sort fontSize="small" className="date-filter-header-sort-icon" />;
        }
        
        return sortConfig.direction === 'asc' 
            ? <ArrowUpward fontSize="small" color="primary" />
            : <ArrowDownward fontSize="small" color="primary" />;
    };

    const containerRef = useCallback((node: HTMLDivElement | null) => {
        if (node) {
            node.style.paddingLeft = typeof paddingLeft === 'number' ? `${paddingLeft}px` : paddingLeft;
            node.style.width = `${width}px`;
        }
    }, [paddingLeft, width]);

    return (
        <div 
            ref={containerRef}
            className="date-filter-header"
        >
            <ResponsiveTooltip title={localT('sortBy')}>
                <Box 
                    className="date-filter-header-content"
                    onClick={() => onSort(field)} 
                >
                    <Box className="date-filter-header-label-container">
                        <Typography variant="body2" fontWeight="bold" noWrap title={label}>{label}</Typography>
                    </Box>
                    <Box
                        className="date-filter-header-filter-container"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <DateColumnFilter 
                            onFilterChange={onDateFilterChange} 
                            startDate={dateFilter.start} 
                            endDate={dateFilter.end} 
                        />
                        {renderSortIcon()}
                    </Box>
                </Box>
            </ResponsiveTooltip>
            <ResizeHandle width={width} minWidth={minWidth} onResize={onResize} />
        </div>
    );
};
