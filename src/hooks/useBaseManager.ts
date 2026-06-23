/**
 * @file useBaseManager.ts
 * @description Custom React hook that provides comprehensive list/table state management
 * including column widths, visibility toggling, sorting, searching (with debounce),
 * column filtering, date range filtering, and localStorage persistence for all settings.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Configuration options for the useBaseManager hook.
 *
 * @template T - The type of items in the data array being managed.
 */
export interface BaseManagerOptions<T> {
    localStoragePrefix: string;
    defaultVisibleColumns: Record<string, boolean>;
    searchFields: (item: T) => string[];
    dateField?: (item: T) => string;
}

/**
 * A custom hook that provides full-featured list/table state management.
 *
 * Manages column widths, visible columns, sort configuration, global search
 * (with debounced input), column-specific filters, date range filtering,
 * and persists all user preferences to localStorage under a common prefix.
 *
 * @template T - The type of items in the data array.
 * @param items        - The full (unfiltered) array of data items.
 * @param options      - Configuration options (prefix, default columns, search/date accessors).
 * @param options.localStoragePrefix   - Namespace prefix used for all localStorage keys.
 * @param options.defaultVisibleColumns - Record mapping column keys to their default visibility.
 * @param options.searchFields         - Function returning an array of searchable string fields for a given item.
 * @param options.dateField            - Optional function returning an ISO date string for a given item (enables date filtering).
 *
 * @returns An object containing:
 *  - `sortConfig` / `setSortConfig` - Current sort state and setter.
 *  - `visibleColumns` / `setVisibleColumns` - Current column visibility map and setter.
 *  - `columnMenuAnchor` - Anchor element for the column visibility menu (or null).
 *  - `inputValue` / `setInputValue` - Controlled search input value.
 *  - `searchText` / `setSearchText` - Debounced search text value.
 *  - `columnFilters` / `setColumnFilters` - Map of column filter selections and setter.
 *  - `dateFilter` / `setDateFilter` - Date range filter object and setter.
 *  - `columnWidths` - Record of manually resized column widths.
 *  - `handleSearchChange` - Handler for search input changes (with debounce).
 *  - `handleSort` - Handler for column-header sort clicks.
 *  - `handleClearFilters` - Resets all search, column, and date filters.
 *  - `handleColumnFilterChange` - Updates filters for a specific column.
 *  - `handleColumnMenuOpen` - Opens the column visibility menu.
 *  - `handleColumnMenuClose` - Closes the column visibility menu.
 *  - `handleColumnToggle` - Toggles a single column's visibility.
 *  - `handleColumnResize` - Updates the stored width for a resized column.
 *  - `filteredItems` - The items array after applying search, date, and column filters.
 */
export const useBaseManager = <T>(
    items: T[],
    options: BaseManagerOptions<T>
) => {
    const { localStoragePrefix, defaultVisibleColumns, searchFields, dateField } = options;

    // 1. Column Widths
    const [manualColumnWidths, setManualColumnWidths] = useState<Record<string, number>>(() => {
        const saved = localStorage.getItem(`${localStoragePrefix}_column_widths`);
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem(`${localStoragePrefix}_column_widths`, JSON.stringify(manualColumnWidths));
    }, [manualColumnWidths, localStoragePrefix]);

    // 2. Visible Columns
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem(`${localStoragePrefix}_visible_columns`);
        if (saved) return JSON.parse(saved);
        return defaultVisibleColumns;
    });

    useEffect(() => {
        localStorage.setItem(`${localStoragePrefix}_visible_columns`, JSON.stringify(visibleColumns));
    }, [visibleColumns, localStoragePrefix]);

    // 3. Sorting, Searching, Filtering
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(() => {
        const saved = localStorage.getItem(`${localStoragePrefix}_sort_config`);
        return saved ? JSON.parse(saved) : null;
    });

    useEffect(() => {
        if (sortConfig) {
            localStorage.setItem(`${localStoragePrefix}_sort_config`, JSON.stringify(sortConfig));
        } else {
            localStorage.removeItem(`${localStoragePrefix}_sort_config`);
        }
    }, [sortConfig, localStoragePrefix]);

    const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
    
    const [searchText, setSearchText] = useState(() => {
        return localStorage.getItem(`${localStoragePrefix}_search_text`) || '';
    });
    
    const [inputValue, setInputValue] = useState(searchText);

    useEffect(() => {
        localStorage.setItem(`${localStoragePrefix}_search_text`, searchText);
    }, [searchText, localStoragePrefix]);

    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(() => {
        const saved = localStorage.getItem(`${localStoragePrefix}_column_filters`);
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem(`${localStoragePrefix}_column_filters`, JSON.stringify(columnFilters));
    }, [columnFilters, localStoragePrefix]);

    const [dateFilter, setDateFilter] = useState(() => {
        const saved = localStorage.getItem(`${localStoragePrefix}_date_filter`);
        return saved ? JSON.parse(saved) : { start: '', end: '' };
    });

    useEffect(() => {
        localStorage.setItem(`${localStoragePrefix}_date_filter`, JSON.stringify(dateFilter));
    }, [dateFilter, localStoragePrefix]);

    const searchTimeoutRef = useRef<number | null>(null);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>, debounceMs = 300) => {
        const value = event.target.value;
        setInputValue(value);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = window.setTimeout(() => {
            setSearchText(value);
        }, debounceMs);
    };

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key && current.direction === 'asc') {
                return { key, direction: 'desc' };
            }
            if (current?.key === key && current.direction === 'desc') {
                return { key, direction: 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const handleClearFilters = () => {
        setInputValue('');
        setSearchText('');
        setColumnFilters({});
        setDateFilter({ start: '', end: '' });
    };

    const handleColumnFilterChange = (field: string, values: string[]) => {
        setColumnFilters(prev => ({ ...prev, [field]: values }));
    };

    const handleColumnMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        setColumnMenuAnchor(event.currentTarget);
    };

    const handleColumnMenuClose = () => {
        setColumnMenuAnchor(null);
    };

    const handleColumnToggle = (column: string) => {
        setVisibleColumns(prev => ({
            ...prev,
            [column]: !prev[column]
        }));
    };

    const handleColumnResize = (key: string, newWidth: number) => {
        setManualColumnWidths(prev => ({
            ...prev,
            [key]: newWidth
        }));
    };

    // Base filtering logic (can be extended or overridden)
    const filteredItems = useMemo(() => {
        const matchesGlobalSearch = (item: T) => {
            if (!searchText) return true;
            const searchStr = searchText.toLowerCase();
            const fields = searchFields(item);
            return fields.some(f => f.toLowerCase().includes(searchStr));
        };

        const matchesDateFilter = (item: T) => {
            if (!dateField || (!dateFilter.start && !dateFilter.end)) return true;
            const itemDate = dateField(item).slice(0, 10);
            if (dateFilter.start && itemDate < dateFilter.start) return false;
            if (dateFilter.end && itemDate > dateFilter.end) return false;
            return true;
        };

        const matchesColumnFilters = (item: T) => {
            for (const [field, selectedValues] of Object.entries(columnFilters)) {
                if (selectedValues.length > 0) {
                    const itemValue = String((item as Record<string, unknown>)[field]);
                    if (!selectedValues.includes(itemValue)) return false;
                }
            }
            return true;
        };

        return items.filter(item => {
            return matchesGlobalSearch(item) && matchesDateFilter(item) && matchesColumnFilters(item);
        });
    }, [items, searchText, columnFilters, dateFilter, searchFields, dateField]);

    return {
        sortConfig,
        setSortConfig,
        visibleColumns,
        setVisibleColumns,
        columnMenuAnchor,
        inputValue,
        setInputValue,
        searchText,
        setSearchText,
        columnFilters,
        setColumnFilters,
        dateFilter,
        setDateFilter,
        columnWidths: manualColumnWidths,
        handleSearchChange,
        handleSort,
        handleClearFilters,
        handleColumnFilterChange,
        handleColumnMenuOpen,
        handleColumnMenuClose,
        handleColumnToggle,
        handleColumnResize,
        filteredItems
    };
};
