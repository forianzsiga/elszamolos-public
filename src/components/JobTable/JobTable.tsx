/**
 * @file JobTable.tsx
 * Main table component for the job management view.
 * Provides a virtualized, sortable, filterable table with column
 * customization, mobile responsiveness, and row-level actions.
 */
import React, { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme, useMediaQuery } from '@mui/material';
import { VirtualDataTable } from '../VirtualDataTable';
import type { ColumnDef } from '../VirtualDataTable';
import { JobRow } from '../JobRow';
import { DateFilterHeader } from '../DateFilterHeader';
import { useLanguage } from '../../context/LanguageContext';
import type { Job } from '../../types';
import { getHeaderMinimumWidth, measureText } from '../../utils/columnSizing';
import { MobileJobTable } from '../MobileJobTable';
import i11n from './JobTable-i11n.json';
import './JobTable.css';

/** Props passed to the {@link JobTable} component. */
interface JobTableProps {
    jobs: Job[];
    sortedJobs: Job[];
    visibleColumns: Record<string, boolean>;
    columnWidths: Record<string, number>;
    sortConfig: { key: string, direction: 'asc' | 'desc' } | null;
    selectedIds: Set<string>;
    selectionState: { allSelected: boolean, someSelected: boolean };
    columnMenuAnchor: HTMLElement | null;
    filterOptions: Record<string, string[]>;
    columnFilters: Record<string, string[]>;
    dateFilter: { start: string, end: string };
    duplicateHashes: Set<string>;
    onColumnResize: (key: string, newWidth: number) => void;
    onSort: (key: string) => void;
    onSelectAll: (checked: boolean) => void;
    onSelectOne: (id: string, checked: boolean) => void;
    onColumnMenuOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onColumnMenuClose: () => void;
    onColumnToggle: (column: string) => void;
    onDateFilterChange: (start: string, end: string) => void;
    onColumnFilterChange: (field: string, values: string[]) => void;
    onEdit: (job: Job) => void;
    onDiscard: (job: Job) => void;
    onDelete: (id: string) => void;
    materials: string[];
    types: string[];
}

/**
 * Main table component for displaying and managing dental jobs.
 *
 * Renders either a mobile-optimized table on small screens or a high-performance
 * virtual data table on desktop with sorting, filtering, column resizing, column
 * visibility toggling, row selection, and row expansion capabilities.
 *
 * @param props - Component props (see {@link JobTableProps} for full details)
 * @param props.sortedJobs - Jobs in their current sorted/filtered display order
 * @param props.visibleColumns - Map of column IDs to their visibility state
 * @param props.columnWidths - Map of column IDs to their current pixel widths
 * @param props.sortConfig - Current sort configuration (column key and direction, or null)
 * @param props.selectedIds - Set of currently selected job IDs
 * @param props.selectionState - Aggregate selection state (all / some selected)
 * @param props.columnMenuAnchor - DOM anchor element for the column visibility menu (or null)
 * @param props.filterOptions - Available filter values per column
 * @param props.columnFilters - Active filter values per column
 * @param props.dateFilter - Date range filter (start and end dates)
 * @param props.duplicateHashes - Set of hashes that identify duplicate jobs
 * @param props.onColumnResize - Callback invoked when a column is resized
 * @param props.onSort - Callback invoked when a column header is clicked to sort
 * @param props.onSelectAll - Callback invoked when the select-all checkbox is toggled
 * @param props.onSelectOne - Callback invoked when an individual row checkbox is toggled
 * @param props.onColumnMenuOpen - Callback invoked to open the column visibility menu
 * @param props.onColumnMenuClose - Callback invoked to close the column visibility menu
 * @param props.onColumnToggle - Callback invoked when a column&#39;s visibility is toggled
 * @param props.onDateFilterChange - Callback invoked when the date filter range changes
 * @param props.onColumnFilterChange - Callback invoked when a column filter value changes
 * @param props.onEdit - Callback invoked to edit a job
 * @param props.onDiscard - Callback invoked to discard a job
 * @param props.onDelete - Callback invoked to delete a job by ID
 * @param props.materials - List of available material options
 * @param props.types - List of available type options
 * @returns The rendered JobTable component
 */
export const JobTable: React.FC<JobTableProps> = ({
    sortedJobs,
    visibleColumns,
    columnWidths,
    sortConfig,
    selectedIds,
    selectionState,
    columnMenuAnchor,
    filterOptions,
    columnFilters,
    dateFilter,
    duplicateHashes,
    onColumnResize,
    onSort,
    onSelectAll,
    onSelectOne,
    onColumnMenuOpen,
    onColumnMenuClose,
    onColumnToggle,
    onDateFilterChange,
    onColumnFilterChange,
    onEdit,
    onDiscard,
    onDelete,
    materials,
    types,
}) => {
    const { language } = useLanguage();
    const localT = useCallback((key: string) => {
        const lang = (language === 'en' || language === 'hu') ? language : 'en';
        return (i11n as Record<'en' | 'hu', Record<string, string>>)[lang][key] || key;
    }, [language]);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const location = useLocation();
    const navigate = useNavigate();

    React.useEffect(() => {
        const state = location.state as { highlightJobId?: string; expandJob?: boolean; openEditModal?: boolean } | null;
        if (state?.highlightJobId) {
            const jobId = state.highlightJobId;

            if (state.openEditModal) {
                const jobToEdit = sortedJobs.find(j => j.id === jobId);
                if (jobToEdit) {
                    onEdit(jobToEdit);
                }
            }

            setTimeout(() => {
                const element = document.getElementById(`job-row-${jobId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);

            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.state, sortedJobs, onEdit, navigate, location.pathname]);

    const createdAtContentMinWidth = useMemo(() => {
        const font = '400 14px "Roboto", "Helvetica", "Arial", sans-serif';
        const sampleDates = sortedJobs.slice(0, 100).map(job => new Date(job.createdAt).toLocaleDateString());
        const longestDateLabel = sampleDates.reduce((longest, current) => (
            current.length > longest.length ? current : longest
        ), '12/31/2026');

        return Math.ceil(measureText(longestDateLabel, font) + 32 + 32 + 12);
    }, [sortedJobs]);
    
    const columns: ColumnDef<Job>[] = useMemo(() => [
        {
            id: 'createdAt',
            label: localT('date'),
            minWidth: 120,
            contentMinWidth: createdAtContentMinWidth,
            headerMinWidth: getHeaderMinimumWidth({ label: localT('date'), sortable: true, filterable: true }),
            flex: 1,
            renderHeader: ({ width, minWidth, sortConfig, onSort, onResize }) => (
                <DateFilterHeader
                    label={localT('date')}
                    field="createdAt"
                    width={width}
                    minWidth={minWidth}
                    sortConfig={sortConfig}
                    onSort={onSort}
                    onResize={onResize}
                    dateFilter={dateFilter}
                    onDateFilterChange={onDateFilterChange}
                    paddingLeft="58px"
                />
            )
        },
        { id: 'status', label: localT('status'), minWidth: 140, flex: 1 },
        { id: 'state', label: localT('state'), minWidth: 60, align: 'center' },
        { id: 'patientName', label: localT('patient'), minWidth: 100, flex: 1 },
        { id: 'doctorName', label: localT('doctor'), minWidth: 100, flex: 1 },
        { id: 'projectId', label: localT('projectId'), minWidth: 100, flex: 1 },
        { id: 'originalHash', label: localT('hash'), minWidth: 80 },
        { id: 'type', label: localT('type'), minWidth: 100, sortable: false, flex: 1 },
        { id: 'material', label: localT('material'), minWidth: 100, sortable: false, flex: 1 },
        { id: 'unitCount', label: localT('units'), minWidth: 80, align: 'right' },
        { id: 'isScrewRetained', label: localT('screw'), minWidth: 60, align: 'center', sortable: false },
        { id: 'price', label: localT('price'), minWidth: 100, align: 'right', sortable: true },
        { 
            id: 'actions', 
            label: localT('actions'), 
            minWidth: 140, 
            headerMinWidth: getHeaderMinimumWidth({ label: localT('actions'), sortable: false, filterable: false }),
            align: 'right',
            sortable: false
        }
    ], [createdAtContentMinWidth, dateFilter, onDateFilterChange, localT]);

    const renderRow = useCallback(({ item: job, isSelected, toggleSelection, visibleColumns, gridTemplateColumns }: {
        item: Job;
        isSelected: boolean;
        toggleSelection: (id: string, checked: boolean) => void;
        visibleColumns: Record<string, boolean>;
        gridTemplateColumns: string;
    }) => (
        <JobRow
            key={job.id}
            job={job}
            selected={isSelected}
            onSelectionChange={toggleSelection}
            onEdit={onEdit}
            onDiscard={onDiscard}
            onDelete={onDelete}
            visibleColumns={visibleColumns}
            gridTemplateColumns={gridTemplateColumns}
            isDuplicate={job.originalHash ? duplicateHashes.has(job.originalHash) : false}
        />
    ), [onEdit, onDiscard, onDelete, duplicateHashes]);

    if (isMobile) {
        return (
            <MobileJobTable
                sortedJobs={sortedJobs}
                onEdit={onEdit}
                onDelete={onDelete}
                onDiscard={onDiscard}
                materials={materials}
                types={types}
            />
        );
    }

    return (
        <VirtualDataTable
            data={sortedJobs}
            columns={columns}
            visibleColumns={visibleColumns}
            columnWidths={columnWidths}
            sortConfig={sortConfig}
            selectedIds={selectedIds}
            selectionState={selectionState}
            columnMenuAnchor={columnMenuAnchor}
            filterOptions={filterOptions}
            columnFilters={columnFilters}
            onColumnResize={onColumnResize}
            onSort={onSort}
            onSelectAll={onSelectAll}
            onSelectOne={onSelectOne}
            onColumnMenuOpen={onColumnMenuOpen}
            onColumnMenuClose={onColumnMenuClose}
            onColumnToggle={onColumnToggle}
            onColumnFilterChange={onColumnFilterChange}
            getRowId={(job) => job.id}
            disableColumnMenu={true}
            renderRow={renderRow}
        />
    );
};
