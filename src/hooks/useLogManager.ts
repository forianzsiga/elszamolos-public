/**
 * @file Provides the `useLogManager` hook for managing log entries with
 * filtering, sorting, column visibility, and search capabilities.
 */

import { useMemo } from 'react';
import type { LogEntry } from '../context/LogContext';
import { useBaseManager } from './useBaseManager';

/**
 * Custom hook that wraps `useBaseManager` with log-specific configuration.
 *
 * Accepts an array of `LogEntry` objects and exposes filtered, sorted log
 * data together with UI state and event handlers for column management,
 * search, filtering, and sorting.
 *
 * @param logs - The full list of log entries to manage.
 * @returns An object containing:
 *  - `sortConfig` – Current sort direction and key.
 *  - `visibleColumns` – Map of column keys to their visibility state.
 *  - `columnMenuAnchor` – DOM anchor element for the column menu (or `null`).
 *  - `inputValue` – Current raw input value.
 *  - `searchText` – Current debounced search text.
 *  - `columnFilters` – Active per-column filter values.
 *  - `dateFilter` – Active date-range filter (start / end).
 *  - `filterOptions` – Available filter options grouped by column key.
 *  - `filteredLogs` – Log entries after applying search and column filters.
 *  - `sortedLogs` – Filtered entries sorted according to `sortConfig`.
 *  - `columnWidths` – Resizable column widths.
 *  - `handleSearchChange` – Callback for search input changes.
 *  - `handleSort` – Callback for column-header sort clicks.
 *  - `handleClearFilters` – Callback to reset all filters.
 *  - `handleColumnFilterChange` – Callback for per-column filter changes.
 *  - `handleColumnMenuOpen` – Callback to open the column visibility menu.
 *  - `handleColumnMenuClose` – Callback to close the column visibility menu.
 *  - `handleColumnToggle` – Callback to toggle a column's visibility.
 *  - `handleColumnResize` – Callback to update a column's width.
 *  - `setDateFilter` – Setter for the date-range filter.
 */
export const useLogManager = (logs: LogEntry[]) => {
    const base = useBaseManager(logs, {
        localStoragePrefix: 'vdt_log',
        defaultVisibleColumns: {
            timestamp: true,
            severity: true,
            message: true,
            details: false, // Hidden by default to save space
            copy: true
        },
        searchFields: (log) => [log.message, log.details || ''],
        dateField: (log) => log.timestamp
    });

    const filterOptions = useMemo(() => {
        const options: Record<string, string[]> = {
            severity: ['success', 'info', 'warning', 'error'],
        };
        return options;
    }, []);

    const filteredLogs = base.filteredItems;

    const sortedLogs = useMemo(() => {
        if (!base.sortConfig) return filteredLogs;

        return [...filteredLogs].sort((a, b) => {
            const aVal = a[base.sortConfig!.key as keyof LogEntry] || '';
            const bVal = b[base.sortConfig!.key as keyof LogEntry] || '';

            if (aVal < bVal) return base.sortConfig!.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return base.sortConfig!.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredLogs, base.sortConfig]);

    return {
        sortConfig: base.sortConfig,
        visibleColumns: base.visibleColumns,
        columnMenuAnchor: base.columnMenuAnchor,
        inputValue: base.inputValue,
        searchText: base.searchText,
        columnFilters: base.columnFilters,
        dateFilter: base.dateFilter,
        filterOptions,
        filteredLogs,
        sortedLogs,
        columnWidths: base.columnWidths,
        handleSearchChange: base.handleSearchChange,
        handleSort: base.handleSort,
        handleClearFilters: base.handleClearFilters,
        handleColumnFilterChange: base.handleColumnFilterChange,
        handleColumnMenuOpen: base.handleColumnMenuOpen,
        handleColumnMenuClose: base.handleColumnMenuClose,
        handleColumnToggle: base.handleColumnToggle,
        handleColumnResize: base.handleColumnResize,
        setDateFilter: base.setDateFilter,
    };
};
