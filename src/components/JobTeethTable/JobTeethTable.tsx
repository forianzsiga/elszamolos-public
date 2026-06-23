/**
 * @file JobTeethTable.tsx
 * Displays a virtualized table of teeth/jaw units for a job. Each row has a
 * chevron toggle that expands a bulleted list of applied rules beneath it.
 * Selection is gone; rule exclude/reinclude is performed per-rule from the
 * expanded list.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
    Box, Typography, Paper,
    useTheme, useMediaQuery
} from '@mui/material';
import type { AppliedRuleBreakdown, Tooth } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { VirtualDataTable } from '../VirtualDataTable';
import JobTeethTableRow from '../JobTeethTableRow/JobTeethTableRow';
import { AddUnitModal } from '../AddUnitModal';
import { getDisplayRows } from '../../utils/teethTableUtils';
import { useTeethColumnDefs } from '../columns';
import type { JobTeethTableEntry } from '../JobTeethTableRow/JobTeethTableRow';
import { JobTeethTableHeader } from '../JobTeethTableHeader';
import { JobTeethTableNotes } from '../JobTeethTableNotes';
import { HiddenItemsHeader } from '../HiddenItemsHeader';
import { RuleEditorDialog } from '../RuleEditor';
import i11n from './JobTeethTable-i11n.json';
import './JobTeethTable.css';

/** Represents the writable subset of a Tooth, excluding internal fields. */
type ToothUpdate = Omit<Tooth, '_tempId' | 'price' | 'status' | 'appliedRule'>;

/** Props for the {@link JobTeethTable} component. */
interface JobTeethTableProps {
    /** All teeth/units belonging to the job. */
    teeth: Tooth[];
    /** Optional job-level notes displayed below the table. */
    notes?: string;
    /** The currently hovered tooth number (from the tooth chart). */
    hoveredTooth: string | null;
    /** Callback fired when a tooth is hovered. */
    onHoverTooth(toothNum: string | null): void;
    /** Currently hovered row ID (for table-row-only hover isolation). */
    hoveredRowId: string | null;
    /** Callback fired when a table row is hovered. */
    onHoverRowId(rowId: string | null): void;
    /** Callback fired to delete the given teeth. */
    onDeleteTeeth?(teeth: Tooth[]): void;
    /** Callback fired when an existing unit is edited. */
    onEditTeeth?(editingUnit: Tooth, updatedUnit: ToothUpdate): void;
    /** Callback fired when a tooth is duplicated. */
    onDuplicateTeeth?(tooth: Tooth): void;
    /** Extra applied-rules breakdowns for this job. */
    jobExtraRules?: AppliedRuleBreakdown[];
    /** Callback to expand the view (e.g. to a full-page table). */
    onExpand?(): void;
    /** Callback fired to add a new unit. */
    onAddUnit?(newUnit: ToothUpdate): void;
    /** Available material names for the add/edit modal. */
    materials: string[];
    /** Available type names for the add/edit modal. */
    types: string[];
    /** Optional callback invoked when the user hides/restores a dropdown option. */
    onAttrListChange?: () => void;
    /** Doctor name displayed in relevant columns. */
    doctorName?: string;
    /** Patient name displayed in relevant columns. */
    patientName?: string;
    /** Callback fired to exclude a tooth from a rule. */
    onExcludeFromRule?(ruleId: string, projectId: string, toothId?: string): void;
    /** Current project ID used for rule exclusions. */
    projectId?: string;
    /** Current job ID used for stable tooth ID generation. */
    jobId?: string;
    /** If true the table fills the available height; otherwise a fixed max height is used. */
    fullHeight?: boolean;
}

/** Maps column IDs to their manual pixel widths. */
type WidthMap = { [key: string]: number };

/**
 * Width (in pixels) of the leading column reserved for the per-row
 * chevron toggle. Matches the Material Design touch-target minimum and
 * lines up with the IconButton `size="small"` (32px) plus a few px of
 * horizontal padding. Must match the value used in
 * `JobTeethTableRow.css` (`.chevron-cell { width: 48px }`).
 */
const CHEVRON_COLUMN_WIDTH = 48;

/**
 * Main table component that renders a virtualized, sortable list of job teeth/units.
 *
 * Each unit row has a chevron toggle that expands a bulleted list of applied
 * rules beneath the row. The previous multi-select / bottom-toolbar pattern
 * has been removed.
 *
 * @param props - Component props.
 * @returns The rendered teeth table.
 */
export const JobTeethTable = React.memo(function JobTeethTable({
    teeth,
    notes,
    hoveredTooth,
    onHoverTooth,
    hoveredRowId,
    onHoverRowId,
    onDeleteTeeth,
    onEditTeeth,
    onDuplicateTeeth,
    jobExtraRules = [],
    onExpand,
    onAddUnit,
    materials,
    types,
    onAttrListChange,
    doctorName = '',
    patientName = '',
    onExcludeFromRule,
    projectId,
    jobId,
    fullHeight = false
}: JobTeethTableProps) {
    const { language } = useLanguage();
    /**
     * Resolves a translation key to the current language string.
     */
    const localT = useCallback(function localT(key: string) {
        if (language === 'debug') return key;
        return (i11n as Record<'en' | 'hu', Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
    }, [language]);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null as Tooth | null);
    const [isHiddenExpanded, setIsHiddenExpanded] = useState(false);
    const [expandedIds, setExpandedIds] = useState(new Set<string>());
    /**
     * ID of the rule currently being edited in the in-place rule editor
     * dialog. When `null` the dialog is closed. Set by
     * `handleJumpToRule` (the new in-place implementation) when the user
     * clicks the edit icon on an applied rule bullet.
     */
    const [editingRuleId, setEditingRuleId] = useState(null as string | null);

    const [manualWidths, setManualWidths] = useState(function() {
        const saved = localStorage.getItem('vdt_teeth_column_widths');
        return (saved ? JSON.parse(saved) : {}) as WidthMap;
    });

    React.useEffect(function() {
        localStorage.setItem('vdt_teeth_column_widths', JSON.stringify(manualWidths));
    }, [manualWidths]);

    const sortedTeeth = useMemo(function() {
        return [...teeth].filter(function(t) { return !t.isIgnored; }).sort(function(a, b) { return a.number - b.number; });
    }, [teeth]);

    const sortedHiddenTeeth = useMemo(function() {
        return [...teeth].filter(function(t) { return t.isIgnored; }).sort(function(a, b) { return a.number - b.number; });
    }, [teeth]);

    const hasHiddenItems = sortedHiddenTeeth.length > 0;

    const displayRows = useMemo(function() {
        return getDisplayRows(sortedTeeth, teeth, [], jobId);
    }, [sortedTeeth, teeth, jobId]);

    const hiddenDisplayRows = useMemo(function() {
        return getDisplayRows(sortedHiddenTeeth, teeth, [], jobId);
    }, [sortedHiddenTeeth, teeth, jobId]);

    const hiddenHeaderEntry = useMemo(function() {
        return ({
            id: 'hidden-items-header',
            kind: 'hiddenHeader',
            tooth: { number: 0, material: '', type: '', price: 0, status: 'Pending' } as Tooth
        } as JobTeethTableEntry);
    }, []);

    const tableRows = useMemo(function() {
        if (!hasHiddenItems) return displayRows;
        if (isHiddenExpanded) return [...displayRows, hiddenHeaderEntry, ...hiddenDisplayRows];
        return [...displayRows, hiddenHeaderEntry];
    }, [hasHiddenItems, isHiddenExpanded, displayRows, hiddenDisplayRows, hiddenHeaderEntry]);

    /**
     * Toggles the chevron-expanded state for a single row id. Used to show
     * the bulleted applied-rules list beneath the row.
     */
    const handleToggleExpand = useCallback(function handleToggleExpand(rowId: string) {
        setExpandedIds(function(prev) {
            const next = new Set(prev);
            if (next.has(rowId)) {
                next.delete(rowId);
            } else {
                next.add(rowId);
            }
            return next;
        });
    }, []);

    /**
     * Opens the in-place rule editor for a given rule id. The dialog is
     * mounted at the top of this component; setting `editingRuleId`
     * triggers `RuleEditorDialog` to look up the rule from
     * TariffContext and seed its editor. The user never leaves the
     * current page.
     */
    const handleJumpToRule = useCallback(function handleJumpToRule(ruleId: string) {
        setEditingRuleId(ruleId);
    }, []);

    /**
     * Excludes a per-unit rule for a given tooth. Looks up the tooth by
     * row id (the row id is the tooth's stable id) and forwards the
     * call to `onExcludeFromRule` with the matching `toothId`.
     */
    const handleExcludeRuleForUnit = useCallback(function handleExcludeRuleForUnit(rowId: string, ruleId: string) {
        if (!onExcludeFromRule || !projectId) return;
        onExcludeFromRule(ruleId, projectId, rowId);
    }, [onExcludeFromRule, projectId]);

    /**
     * Re-includes a per-unit rule. The exclusion toggle is symmetric:
     * clicking the reinclude icon on an already-excluded unit rule
     * clears the rule id from that tooth's `excludedRuleIds`, which
     * re-activates the rule for the tooth.
     */
    const handleReincludeRuleForUnit = useCallback(function handleReincludeRuleForUnit(rowId: string, ruleId: string) {
        if (!onExcludeFromRule || !projectId) return;
        onExcludeFromRule(ruleId, projectId, rowId);
    }, [onExcludeFromRule, projectId]);

    /**
     * Excludes a job-scoped rule (a `jobExtra` rule) for the whole job.
     * `toothId` is left undefined so the handler updates the job's
     * `excludedRuleIds` rather than a tooth's.
     */
    const handleExcludeRuleForJob = useCallback(function handleExcludeRuleForJob(ruleId: string) {
        if (!onExcludeFromRule || !projectId) return;
        onExcludeFromRule(ruleId, projectId, undefined);
    }, [onExcludeFromRule, projectId]);

    /**
     * Re-includes a job-scoped rule. Same mechanism as exclusion with
     * `toothId` left undefined.
     */
    const handleReincludeRuleForJob = useCallback(function handleReincludeRuleForJob(ruleId: string) {
        if (!onExcludeFromRule || !projectId) return;
        onExcludeFromRule(ruleId, projectId, undefined);
    }, [onExcludeFromRule, projectId]);

    /**
     * The set of rule IDs that are currently excluded at the job level
     * (used to drive the "is excluded" state for `jobExtra` bullets
     * inside the chevron expansion).
     */
    const jobExcludedRuleIds = useMemo(function() {
        return new Set<string>();
    }, []);

    const columnDefs = useTeethColumnDefs(
        onDeleteTeeth,
        onEditTeeth ? function(tooth) { setEditingUnit(tooth); setIsAddUnitModalOpen(true); } : undefined,
        onDuplicateTeeth,
        jobExtraRules
    );

    /**
     * Column visibility is no longer user-configurable in this table: the
     * redesign dropped per-row selection and the column-menu, so every
     * column is always visible. Build the map once from the column defs.
     */
    const visibleColumns = useMemo(function() {
        return columnDefs.reduce(function(acc, col) { return ({ ...acc, [col.id]: true }); }, {} as Record<string, boolean>);
    }, [columnDefs]);

    /**
     * Renders a single row inside the virtualized table.
     */
    const renderRow = useCallback(function renderRow({ item: entry, gridTemplateColumns }: { item: JobTeethTableEntry; index: number; visibleColumns: Record<string, boolean>; gridTemplateColumns: string; isSelected: boolean; toggleSelection: (id: string, checked: boolean) => void }) {
        if (entry.kind === 'hiddenHeader') {
            return (
                <HiddenItemsHeader
                    mode={theme.palette.mode as 'light' | 'dark'}
                    isHiddenExpanded={isHiddenExpanded}
                    onToggleExpand={function() { return setIsHiddenExpanded(!isHiddenExpanded); }}
                    gridTemplateColumns={gridTemplateColumns}
                    label={localT('hiddenItems')}
                />
            );
        }
        const isExpanded = expandedIds.has(entry.id);
        return (
            <JobTeethTableRow
                entry={entry}
                gridTemplateColumns={gridTemplateColumns} columnDefs={columnDefs}
                visibleColumns={visibleColumns} hoveredTooth={hoveredTooth} onHoverTooth={onHoverTooth}
                hoveredRowId={hoveredRowId} onHoverRowId={onHoverRowId}
                expanded={isExpanded}
                onToggleExpand={function() { handleToggleExpand(entry.id); }}
                onJumpToRule={handleJumpToRule}
                onExcludeRuleForUnit={function(ruleId) { handleExcludeRuleForUnit(entry.id, ruleId); }}
                onReincludeRuleForUnit={function(ruleId) { handleReincludeRuleForUnit(entry.id, ruleId); }}
                onExcludeRuleForJob={handleExcludeRuleForJob}
                onReincludeRuleForJob={handleReincludeRuleForJob}
                jobExtraRules={entry.kind === 'tooth' ? jobExtraRules : []}
                jobExcludedRuleIds={Array.from(jobExcludedRuleIds)}
            />
        );
    }, [theme.palette.mode, isHiddenExpanded, localT, columnDefs, visibleColumns, hoveredTooth, onHoverTooth, hoveredRowId, onHoverRowId, expandedIds, jobExtraRules, jobExcludedRuleIds, handleToggleExpand, handleJumpToRule, handleExcludeRuleForUnit, handleReincludeRuleForUnit, handleExcludeRuleForJob, handleReincludeRuleForJob]);

    const ROW_HEIGHT = 50, HEADER_HEIGHT = 80;
    const MAX_HEIGHT = isMobile ? 110 : 360;
    const tableHeight = Math.min(Math.max(tableRows.length * ROW_HEIGHT, 100) + HEADER_HEIGHT, MAX_HEIGHT);

    const tableContentRef = React.useRef(null as HTMLDivElement | null);

    React.useLayoutEffect(function() {
        if (tableContentRef.current) {
            tableContentRef.current.style.height = fullHeight ? '100%' : tableHeight + 'px';
        }
    }, [fullHeight, tableHeight]);

    if (!teeth) {
        return React.createElement(Typography, { variant: "body2", color: "text.secondary" }, localT('noDetails'));
    }

    return (
        <>
            <AddUnitModal
                open={isAddUnitModalOpen} onClose={function() { setIsAddUnitModalOpen(false); setEditingUnit(null); }}
                onAdd={function(newUnit) {
                    if (editingUnit) { if (onEditTeeth) onEditTeeth(editingUnit, newUnit); } else if (onAddUnit) onAddUnit(newUnit);
                    setEditingUnit(null);
                }}
                materials={materials} types={types} initialValues={editingUnit}
                onAttrListChange={onAttrListChange}
            />
            <RuleEditorDialog
                open={editingRuleId !== null}
                ruleId={editingRuleId}
                onClose={function() { setEditingRuleId(null); }}
                activeJob={{
                    teeth,
                    doctorName,
                    patientName
                }}
            />
            <Paper variant="outlined" className={`job-teeth-table-paper ${fullHeight ? 'full-height' : ''}`}>
                <JobTeethTableHeader title={localT('teethTableTitle')} onExpand={onExpand} />
                <Box ref={tableContentRef} className={`job-teeth-table-content ${fullHeight ? 'full-height' : ''}`}>
                    <VirtualDataTable
                        height={fullHeight ? "100%" : tableHeight} defaultItemHeight={ROW_HEIGHT} data={tableRows}
                        columns={columnDefs} getRowId={function(entry) { return entry.id; }} visibleColumns={visibleColumns}
                        columnWidths={manualWidths} onColumnResize={function(key, width) { setManualWidths(function(prev) { return ({ ...prev, [key]: width }); }); }}
                        sortConfig={null} onSort={function() {}} columnMenuAnchor={null} onColumnMenuOpen={function() {}}
                        onColumnMenuClose={function() {}} onColumnToggle={function() {}} filterOptions={{}} columnFilters={{}}
                        onColumnFilterChange={function() {}} renderRow={renderRow}
                        disableColumnMenu
                        leadingColumnWidth={CHEVRON_COLUMN_WIDTH}
                        followOutput
                    />
                </Box>
            </Paper>
            {notes && <JobTeethTableNotes notes={notes} />}
        </>
    );
}, /**
     * Custom equality check for React.memo. Only re-renders when one of the
     * watched props changes.
     */
    function compare(prev, next) {
    return prev.teeth === next.teeth && prev.teeth.length === next.teeth.length &&
           prev.notes === next.notes && prev.hoveredTooth === next.hoveredTooth &&
           prev.hoveredRowId === next.hoveredRowId &&
           prev.doctorName === next.doctorName && prev.patientName === next.patientName &&
           prev.jobExtraRules === next.jobExtraRules &&
           prev.projectId === next.projectId && prev.jobId === next.jobId &&
           prev.onExcludeFromRule === next.onExcludeFromRule &&
           prev.onAddUnit === next.onAddUnit && prev.onEditTeeth === next.onEditTeeth &&
           prev.onDuplicateTeeth === next.onDuplicateTeeth && prev.onDeleteTeeth === next.onDeleteTeeth &&
           prev.onHoverTooth === next.onHoverTooth && prev.onHoverRowId === next.onHoverRowId;
});
