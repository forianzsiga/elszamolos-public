/**
 * @file LogTable.tsx
 * Renders a virtualized, filterable, sortable log table with resizable
 * columns.  Integrates with {@link LogContext} for data and
 * {@link LanguageContext} for internationalisation (i18n).
 */

import React, { useCallback } from 'react';
import { DateFilterHeader } from '../DateFilterHeader';
import { LogRow } from '../LogRow';
import type { LogEntry } from '../../context/LogContext';
import { VirtualDataTable, type ColumnDef } from '../VirtualDataTable';
import { useLanguage } from '../../context/LanguageContext';
import { getHeaderMinimumWidth } from '../../utils/columnSizing';
import i11n from './LogTable-i11n.json';
import './LogTable.css';

/** Props for the {@link LogTable} component. */
interface LogTableProps {
    logs: LogEntry[];
    sortedLogs: LogEntry[];
    onCopy: (log: LogEntry) => void;
    // Log Manager Props
    columnWidths: Record<string, number>;
    sortConfig: { key: string, direction: 'asc' | 'desc' } | null;
    visibleColumns: Record<string, boolean>;
    columnMenuAnchor: HTMLElement | null;
    filterOptions: Record<string, string[]>;
    columnFilters: Record<string, string[]>;
    dateFilter: { start: string, end: string };
    onColumnResize: (key: string, newWidth: number) => void;
    onSort: (key: string) => void;
    onColumnMenuOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onColumnMenuClose: () => void;
    onColumnToggle: (column: string) => void;
    onDateFilterChange: (start: string, end: string) => void;
    onColumnFilterChange: (field: string, values: string[]) => void;
    noRowSeparator?: boolean;
    disableColumnMenu?: boolean;
}

/**
 * Virtual log table component.
 *
 * Displays log entries in a virtualized table with configurable columns,
 * sorting, filtering, column resizing, column visibility toggling, and a
 * column context menu.  Uses {@link VirtualDataTable} for the virtualised
 * grid and {@link DateFilterHeader} for date-range filtering.
 *
 * @param props - Component props.
 * @param props.logs - Full unsorted list of log entries (available for
 *     external use).
 * @param props.sortedLogs - Pre-sorted log entries displayed in the table.
 * @param props.onCopy - Callback invoked when a log entry's copy action is
 *     triggered.
 * @param props.columnWidths - Map of column IDs to their current pixel
 *     widths.
 * @param props.sortConfig - Current sort configuration
 *     ({@code key, direction}) or null.
 * @param props.visibleColumns - Map of column IDs to visibility booleans.
 * @param props.columnMenuAnchor - DOM element anchoring the column context
 *     menu, or null.
 * @param props.filterOptions - Map of field names to available filter option
 *     arrays.
 * @param props.columnFilters - Map of field names to currently active filter
 *     value arrays.
 * @param props.dateFilter - Date-filter range ({@code start, end}).
 * @param props.onColumnResize - Callback when a column is resized to a new
 *     width.
 * @param props.onSort - Callback when a column sort is requested.
 * @param props.onColumnMenuOpen - Callback to open the column context menu.
 * @param props.onColumnMenuClose - Callback to close the column context menu.
 * @param props.onColumnToggle - Callback to toggle a column's visibility.
 * @param props.onDateFilterChange - Callback when the date-filter range
 *     changes.
 * @param props.onColumnFilterChange - Callback when a column's filter values
 *     change.
 * @param props.noRowSeparator - When true, hides row separator lines.
 * @param props.disableColumnMenu - When true, disables the column context
 *     menu.
 * @returns A virtualized log table element.
 */
export const LogTable: React.FC<LogTableProps> = ({ 
    sortedLogs, 
    onCopy,        
    columnWidths,
    sortConfig,
    visibleColumns,
    columnMenuAnchor,
    filterOptions,
    columnFilters,
    dateFilter,
    onColumnResize,
    onSort,
    onColumnMenuOpen,
    onColumnMenuClose,
    onColumnToggle,
    onDateFilterChange,
    onColumnFilterChange,
    noRowSeparator,
    disableColumnMenu
}) => {
    const { language } = useLanguage();
    const localT = (key: string) => i11n[language as 'en' | 'hu']?.[key as keyof typeof i11n['en']] || key;

    const columns: ColumnDef<LogEntry>[] = [
        {
            id: 'timestamp',
            label: localT('logs.column.timestamp'),
            minWidth: 180,
            headerMinWidth: getHeaderMinimumWidth({ label: localT('logs.column.timestamp'), sortable: true, filterable: true }),
            sortable: true,
            renderHeader: ({ width, minWidth, sortConfig, onSort, onResize }) => (
                <DateFilterHeader
                    label={localT('logs.column.timestamp')}
                    field="timestamp"
                    width={width}
                    minWidth={minWidth}
                    sortConfig={sortConfig}
                    onSort={onSort}
                    onResize={onResize}
                    dateFilter={dateFilter}
                    onDateFilterChange={onDateFilterChange}
                />
            )
        },
        {
            id: 'severity',
            label: localT('logs.column.severity'),
            minWidth: 120,
            sortable: true
        },
        {
            id: 'message',
            label: localT('logs.column.message'),
            minWidth: 300,
            flex: 1,
            sortable: true
        },
        {
            id: 'details',
            label: localT('logs.column.details'),
            minWidth: 150,
            flex: 1,
            sortable: true
        },
        {
            id: 'copy',
            label: localT('logs.column.copy'),
            minWidth: 100,
            sortable: false,
            align: 'center'
        }
    ];

    const renderRow = useCallback(({ item: log, visibleColumns, gridTemplateColumns }: {
        item: LogEntry;
        visibleColumns: Record<string, boolean>;
        gridTemplateColumns: string;
    }) => (
        <LogRow
            key={log.id}
            log={log}
            onCopy={onCopy}
            visibleColumns={visibleColumns}
            gridTemplateColumns={gridTemplateColumns}
        />
    ), [onCopy]);

    return (
        <VirtualDataTable
            data={sortedLogs}
            columns={columns}
            visibleColumns={visibleColumns}
            columnWidths={columnWidths}
            sortConfig={sortConfig}
            columnMenuAnchor={columnMenuAnchor}
            filterOptions={filterOptions}
            columnFilters={columnFilters}
            onColumnResize={onColumnResize}
            onSort={onSort}
            onColumnMenuOpen={onColumnMenuOpen}
            onColumnMenuClose={onColumnMenuClose}
            onColumnToggle={onColumnToggle}
            onColumnFilterChange={onColumnFilterChange}
            getRowId={(log) => log.id}
            noRowSeparator={noRowSeparator}
            disableColumnMenu={disableColumnMenu}
            renderRow={renderRow}
        />
    );
};
