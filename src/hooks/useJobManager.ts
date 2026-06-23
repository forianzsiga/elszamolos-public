/**
 * @file Provides the useJobManager custom hook for job listing state, filtering,
 * sorting, column management, and multi-select selection logic.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Job } from '../types';
import { SEARCH_DEBOUNCE_MS } from '../utils/constants';
import { useBaseManager } from './useBaseManager';
import {
    getDuplicateHashes,
    getFilterOptions,
    filterJobs,
    sortJobs
} from '../utils/jobManagerUtils';

/**
 * Custom hook that manages all job-related UI state including filtering,
 * sorting, column visibility, selection, and duplicate detection.
 *
 * @param jobs - The full list of job objects to manage.
 * @returns An object containing all state values and handler functions
 *   for driving a job list view.
 *
 * @returns {object} sortConfig - Current sort column and direction.
 * @returns {Set<string>} selectedIds - Set of currently selected job IDs.
 * @returns {Record<string, boolean>} visibleColumns - Map of column keys to visibility flags.
 * @returns {null | HTMLElement} columnMenuAnchor - Anchor element for the column toggle menu.
 * @returns {string} inputValue - Raw search input value.
 * @returns {string} searchText - Debounced search text.
 * @returns {Record<string, string[]>} columnFilters - Active per-column filter values.
 * @returns {{ start: Date | null; end: Date | null }} dateFilter - Active date range filter.
 * @returns {Set<string>} duplicateHashes - Set of file hashes that appear on more than one job.
 * @returns {FilterOptions} filterOptions - Available filter choices derived from the job list.
 * @returns {Job[]} filteredJobs - Jobs after applying all filters.
 * @returns {Job[]} sortedJobs - Filtered jobs after applying the current sort.
 * @returns {{ allSelected: boolean; someSelected: boolean }} selectionState -
 *   Indicates whether all / some filtered jobs are selected.
 * @returns {Record<string, number>} columnWidths - User-resized column widths.
 * @returns {(e: React.ChangeEvent<HTMLInputElement>) => void} handleSearchChange -
 *   Handles search input changes with debounce.
 * @returns {(key: string) => void} handleSort - Toggles sort on the given column key.
 * @returns {() => void} handleClearFilters - Resets all filters and selection.
 * @returns {(column: string, values: string[]) => void} handleColumnFilterChange -
 *   Updates filter values for a specific column.
 * @returns {(checked: boolean) => void} handleSelectAll - Selects or deselects all filtered jobs.
 * @returns {(id: string, checked: boolean) => void} handleSelectOne -
 *   Selects or deselects a single job by ID.
 * @returns {(e: React.MouseEvent<HTMLElement>) => void} handleColumnMenuOpen -
 *   Opens the column visibility menu.
 * @returns {() => void} handleColumnMenuClose - Closes the column visibility menu.
 * @returns {(column: string) => void} handleColumnToggle - Toggles a column's visibility.
 * @returns {(column: string, width: number) => void} handleColumnResize -
 *   Persists a column's new width.
 * @returns {(filter: { start: Date | null; end: Date | null }) => void} setDateFilter -
 *   Sets the date range filter.
 * @returns {React.Dispatch<React.SetStateAction<Set<string>>>} setSelectedIds -
 *   Direct setter for the selected IDs set.
 */
export const useJobManager = (jobs: Job[]) => {
    const base = useBaseManager(jobs, {
        localStoragePrefix: 'vdt_job',
        defaultVisibleColumns: {
            createdAt: true,
            status: true,
            state: true,
            patientName: true,
            doctorName: true,
            type: true,
            material: true,
            unitCount: true,
            isScrewRetained: true,
            price: true,
            actions: true,
            projectId: false,
            originalHash: false
        },
        searchFields: (job) => [job.patientName, job.doctorName, job.fileName],
        dateField: (job) => job.createdAt
    });

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const duplicateHashes = useMemo(() => {
        return getDuplicateHashes(jobs);
    }, [jobs]);

    const filterOptions = useMemo(() => {
        return getFilterOptions(jobs);
    }, [jobs]);

    const filteredJobs = useMemo(() => {
        return filterJobs(jobs, base.searchText, base.dateFilter, base.columnFilters, duplicateHashes);
    }, [jobs, base.searchText, base.columnFilters, base.dateFilter, duplicateHashes]);

    const sortedJobs = useMemo(() => {
        return sortJobs(filteredJobs, base.sortConfig, duplicateHashes);
    }, [filteredJobs, base.sortConfig, duplicateHashes]);

    const selectionState = useMemo(() => {
        if (filteredJobs.length === 0) return { allSelected: false, someSelected: false };
        let selectedCount = 0;
        for (const job of filteredJobs) {
            if (selectedIds.has(job.id)) selectedCount++;
        }
        return {
            allSelected: selectedCount === filteredJobs.length,
            someSelected: selectedCount > 0 && selectedCount < filteredJobs.length
        };
    }, [filteredJobs, selectedIds]);

    /** Resets all search/filter state and clears the job selection. */
    const handleClearFilters = () => {
        base.handleClearFilters();
        setSelectedIds(new Set());
    };

    /**
     * Selects or deselects all currently filtered jobs.
     * @param checked - `true` to select all, `false` to deselect all.
     */
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(filteredJobs.map(job => job.id));
            setSelectedIds(allIds);
        } else {
            setSelectedIds(new Set());
        }
    };

    /**
     * Toggles selection state for a single job by its ID.
     * @param id - The unique identifier of the job.
     * @param checked - `true` to select the job, `false` to deselect it.
     */
    const handleSelectOne = useCallback((id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const newSelected = new Set(prev);
            if (checked) {
                newSelected.add(id);
            } else {
                newSelected.delete(id);
            }
            return newSelected;
        });
    }, []);

    return {
        sortConfig: base.sortConfig,
        selectedIds,
        visibleColumns: base.visibleColumns,
        columnMenuAnchor: base.columnMenuAnchor,
        inputValue: base.inputValue,
        searchText: base.searchText,
        columnFilters: base.columnFilters,
        dateFilter: base.dateFilter,
        duplicateHashes,
        filterOptions,
        filteredJobs,
        sortedJobs,
        selectionState,
        columnWidths: base.columnWidths,
        handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => base.handleSearchChange(e, SEARCH_DEBOUNCE_MS),
        handleSort: base.handleSort,
        handleClearFilters,
        handleColumnFilterChange: base.handleColumnFilterChange,
        handleSelectAll,
        handleSelectOne,
        handleColumnMenuOpen: base.handleColumnMenuOpen,
        handleColumnMenuClose: base.handleColumnMenuClose,
        handleColumnToggle: base.handleColumnToggle,
        handleColumnResize: base.handleColumnResize,
        setDateFilter: base.setDateFilter,
        setSelectedIds
    };
};
