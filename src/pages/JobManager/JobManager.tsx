/**
 * @file JobManager.tsx
 * @description Page component for managing dental jobs. Provides a table view with
 *   filtering, sorting, column customization, invoice assignment, and import/export
 *   functionality. Integrates with job, tariff, invoice, developer, and language
 *   contexts to deliver a comprehensive job management UI.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
    Box, Alert, Snackbar, Paper, FormControl, InputLabel, Select, MenuItem, Button
} from '@mui/material';
import { FilterList, PostAdd } from '@mui/icons-material';

import { useJobs } from '../../context/JobContext';
import { useTariffs } from '../../context/TariffContext';
import { useInvoices } from '../../context/InvoiceContext';
import { useDeveloperMode } from '../../context/DeveloperContext';
import { useLogs } from '../../context/LogContext';
import { useLanguage } from '../../context/LanguageContext';
import { JobEditModal } from '../../components/JobEditModal/JobEditModal';
import { ShowcaseOverlay } from '../../components/ShowcaseOverlay';
import { ShowcaseLabel } from '../../components/ShowcaseLabel';
import { scanAndParseFolder } from '../../services/fileScanner';
import { dbService } from '../../services/db';
import { metadataService } from '../../services/metadataService';
import { invoiceService } from '../../services/invoiceService';
import { calculateJobPrice } from '../../services/pricingEngine';
import { useJobManager } from '../../hooks/useJobManager';
import { ResponsiveTooltip } from '../../components/ResponsiveTooltip';
import { JobManagerHeader } from '../../components/JobManagerHeader';
import { JobFilter } from '../../components/JobFilter';
import { JobTable } from '../../components/JobTable';
import type { Job, JobStatus, Invoice, PersonalDetails } from '../../types';
import { DUMMY_JOBS } from '../../data/dummyJobs';
import i11n from './JobManager-i11n.json';
import './JobManager.css';

/**
 * Represents the local invoice state used by the footer component.
 */
interface InvoiceState {
    /** List of available invoices. */
    invoices: Invoice[];
    /** Whether the invoice data is currently loading. */
    loading: boolean;
    /** Personal/sender details used when creating invoices. */
    personalDetails: PersonalDetails;
}

/**
 * Result of toggling a rule exclusion for a job's teeth array. When a
 * `toothId` is provided the helper rewrites the matching tooth's
 * `excludedRuleIds` in place. When no `toothId` is provided it toggles
 * the job-level `excludedRuleIds` instead.
 */
interface ExclusionToggleResult {
    updatedTeeth: Job['teeth'];
    updatedJobExcludedRuleIds: string[];
    wasExcluded: boolean;
}

/**
 * Toggles a rule exclusion for either a specific tooth or the whole job.
 *
 * - For a tooth-level toggle the matching tooth's `excludedRuleIds` is
 *   updated in place. No companion unit is created or removed; the
 *   original tooth is left visible (or hidden) per the engine's
 *   `ignoreUnit` evaluation.
 * - For a job-level toggle the rule id is added to / removed from
 *   `job.excludedRuleIds`.
 */
const toggleRuleExclusion = (
    teeth: Job['teeth'],
    jobExcludedRuleIds: string[] | undefined,
    ruleId: string,
    toothId: string | undefined
): ExclusionToggleResult | null => {
    if (toothId === undefined) {
        return toggleJobLevelExclusion(teeth, jobExcludedRuleIds, ruleId);
    }
    return toggleToothLevelExclusion(teeth, jobExcludedRuleIds, ruleId, toothId);
};

/**
 * Toggles a rule on a specific tooth's `excludedRuleIds` array. Reports
 * whether the rule was previously excluded for the matching tooth.
 */
const toggleToothLevelExclusion = (
    teeth: Job['teeth'],
    jobExcludedRuleIds: string[] | undefined,
    ruleId: string,
    toothId: string
): ExclusionToggleResult => {
    let wasExcluded = false;
    const updatedTeeth = teeth.map((tooth) => {
        if (tooth.id !== toothId) return tooth;
        const excludedIds = tooth.excludedRuleIds || [];
        if (excludedIds.includes(ruleId)) {
            wasExcluded = true;
            return {
                ...tooth,
                excludedRuleIds: excludedIds.filter(id => id !== ruleId)
            };
        }
        return {
            ...tooth,
            excludedRuleIds: [...excludedIds, ruleId]
        };
    });
    return {
        updatedTeeth,
        updatedJobExcludedRuleIds: jobExcludedRuleIds || [],
        wasExcluded
    };
};

/**
 * Toggles a rule on the job's `excludedRuleIds` (no tooth scope).
 */
const toggleJobLevelExclusion = (
    teeth: Job['teeth'],
    jobExcludedRuleIds: string[] | undefined,
    ruleId: string
): ExclusionToggleResult => {
    const excludedIds = jobExcludedRuleIds || [];
    const wasAlreadyExcluded = excludedIds.includes(ruleId);
    const nextJobExcluded = wasAlreadyExcluded
        ? excludedIds.filter(id => id !== ruleId)
        : [...excludedIds, ruleId];
    return {
        updatedTeeth: teeth,
        updatedJobExcludedRuleIds: nextJobExcluded,
        wasExcluded: wasAlreadyExcluded
    };
};

/**
 * Builds the toast message after an exclusion toggle. Keeps all the
 * `.replace` chaining in one place so the caller stays small.
 */
const buildExclusionToastMessage = (params: {
    t: (key: string) => string;
    ruleName: string;
    projectId: string;
    toothId: string | undefined;
    wasExcluded: boolean;
}): string => {
    const { t, ruleName, projectId, toothId, wasExcluded } = params;
    if (toothId !== undefined) {
        const key = wasExcluded ? 'toast.rule.toothIncluded' : 'toast.rule.toothExcluded';
        return t(key)
            .replace('{toothId}', String(toothId))
            .replace('{projectId}', projectId)
            .replace('{name}', ruleName);
    }
    const key = wasExcluded ? 'toast.rule.included' : 'toast.rule.excluded';
    return t(key)
        .replace('{projectId}', projectId)
        .replace('{name}', ruleName);
};

/**
 * Props for the {@link JobManagerFooter} component.
 */
interface JobManagerFooterProps {
    /** Set of currently selected job IDs. */
    selectedIds: Set<string>;
    /** Current invoice state including invoices list and loading flag. */
    invoiceState: InvoiceState;
    /** The ID of the invoice currently selected in the dropdown. */
    selectedInvoiceId: string;
    /** Callback to update the selected invoice ID. */
    setSelectedInvoiceId: (id: string) => void;
    /** Callback invoked when the user clicks "Add to Invoice". */
    onAddToInvoice: () => void;
    /** Global translation function. */
    t: (key: string) => string;
    /** Local (file-scoped) translation function with optional parameter interpolation. */
    localT: (key: string, params?: Record<string, string>) => string;
    /** Whether the UI is running in demo / showcase mode. */
    isDemo: boolean;
}

/**
 * Footer bar displaying invoice assignment controls.
 * Renders an invoice selector dropdown and an "Add Selected" button,
 * disabled when no jobs are selected or when in demo mode.
 *
 * @param selectedIds - Set of currently selected job IDs.
 * @param invoiceState - Current invoice state including the invoices list, loading flag,
 *   and personal/sender details.
 * @param selectedInvoiceId - The ID of the invoice currently selected in the dropdown.
 * @param setSelectedInvoiceId - Callback to update the selected invoice ID.
 * @param onAddToInvoice - Callback invoked when the user clicks "Add to Invoice".
 * @param t - Global translation function.
 * @param localT - Local (file-scoped) translation function with optional parameter interpolation.
 * @param isDemo - Whether the UI is running in demo / showcase mode.
 * @return The rendered footer JSX element.
 */
const JobManagerFooter = ({
    selectedIds,
    invoiceState,
    selectedInvoiceId,
    setSelectedInvoiceId,
    onAddToInvoice,
    t,
    localT,
    isDemo
}: JobManagerFooterProps) => (
    <Paper variant="outlined" className={`footerControls ${isDemo ? 'demoMode' : ''}`}>
        <FormControl 
            size="small" 
            className="invoiceFormControl"
            sx={{ flex: 1, minWidth: 200 }}
            disabled={selectedIds.size === 0}
        >
            <InputLabel id="invoice-select-label">{t('jobs.invoice.addLabel')} ({selectedIds.size})</InputLabel>
            <Select
                labelId="invoice-select-label"
                id="invoice-select"
                value={selectedInvoiceId || ''}
                label={`${t('jobs.invoice.addLabel')} (${selectedIds.size})`}
                onChange={(e) => setSelectedInvoiceId(e.target.value as string)}
                disabled={selectedIds.size === 0}
                MenuProps={{
                    PaperProps: {
                        style: {
                            // Override MUI's default minWidth (anchor element width)
                            // so the dropdown menu expands to fit its content
                            minWidth: 'max-content',
                        },
                    },
                }}
            >
                <MenuItem value="new">{t('jobs.invoice.createNew')}</MenuItem>
                {invoiceState.invoices.map((inv: Invoice) => (
                    <MenuItem key={inv.id} value={inv.id}>{inv.invoiceNumber} ({new Date(inv.createdAt).toLocaleDateString()})</MenuItem>
                ))}
            </Select>
        </FormControl>
        <ResponsiveTooltip title={localT('tooltip.addSelectedToInvoice')}>
            <span>
                <Button 
                    variant="contained" 
                    startIcon={<PostAdd />} 
                    disabled={!selectedInvoiceId || selectedIds.size === 0}
                    onClick={onAddToInvoice}
                    className="addButton"
                >
                    {t('jobs.actions.addSelected')}
                </Button>
            </span>
        </ResponsiveTooltip>
    </Paper>
);


/**
 * Extracts all exclusion rules applied to a given job, including both
 * job-level and tooth-level exclusions.
 *
 * (No longer used by JobManager directly; the chevron expansion on the
 * unit table reads `excludedRuleIds` per tooth / per job as needed.)
 */

/**
 * Main page component for job management.
 *
 * Provides a full-featured job manager including:
 * - Import of `.dentalProject` files and JSON job data
 * - A virtualised, sortable, filterable job table
 * - Column visibility and resize controls
 * - Invoice assignment (new or existing invoice)
 * - Manual job creation and inline editing
 * - Price recalculation against tariff rules
 * - Rule exclusion / inclusion at job and tooth level
 * - Automatic metadata cleanup
 *
 * @return The rendered job manager page.
 */
const JobManagerPage = () => {
    const { state: jobState, dispatch: jobDispatch } = useJobs();
    const { state: tariffState } = useTariffs();
    const { state: invoiceState, dispatch: invoiceDispatch } = useInvoices();
    const { isDeveloperMode } = useDeveloperMode();
    const { addLog } = useLogs();
    const { t, language } = useLanguage();
    
    const localT = useCallback((key: string, params?: Record<string, string>) => {
        let text = (i11n as Record<string, Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, v);
            });
        }
        return text;
    }, [language]);

    const isDemo = jobState.jobs.length === 0;
    const effectiveJobs = isDemo ? DUMMY_JOBS : jobState.jobs;

    const [importing, setImporting] = useState(false);
    const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'warning'} | null>(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');

    const {
        sortConfig,
        selectedIds,
        visibleColumns,
        columnMenuAnchor,
        inputValue,
        columnFilters,
        dateFilter,
        duplicateHashes,
        filterOptions,
        filteredJobs,
        sortedJobs,
        selectionState,
        columnWidths,
        handleSearchChange,
        handleSort,
        handleClearFilters,
        handleColumnFilterChange,
        handleSelectAll,
        handleSelectOne,
        handleColumnMenuOpen,
        handleColumnMenuClose,
        handleColumnToggle,
        handleColumnResize,
        setDateFilter,
        setSelectedIds
    } = useJobManager(effectiveJobs);

    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);
    const [availableDoctors, setAvailableDoctors] = useState<string[]>([]);
    const [availablePatients, setAvailablePatients] = useState<string[]>([]);
    const jsonFileInputRef = React.useRef<HTMLInputElement>(null);

    const refreshMetadata = useCallback(async () => {
        const [materials, types, doctorsMeta, patientsMeta] = await Promise.all([
            dbService.getMetadata('materials'),
            dbService.getMetadata('types'),
            dbService.getMetadata('doctors'),
            dbService.getMetadata('patients')
        ]);
        setAvailableMaterials(materials);
        setAvailableTypes(types);

        const jobDocs = new Set<string>();
        const jobPatients = new Set<string>();
        jobState.jobs.forEach(j => {
            if (j.doctorName && j.doctorName !== 'Unknown') jobDocs.add(j.doctorName.trim());
            if (j.patientName && j.patientName !== 'Unknown') jobPatients.add(j.patientName.trim());
        });

        const combinedDocs = Array.from(new Set([...doctorsMeta, ...Array.from(jobDocs)])).sort();
        const combinedPatients = Array.from(new Set([...patientsMeta, ...Array.from(jobPatients)])).sort();

        setAvailableDoctors(combinedDocs);
        setAvailablePatients(combinedPatients);
    }, [jobState.jobs]);

    useEffect(() => {
        refreshMetadata();
    }, [refreshMetadata]);

    /**
     * Adds the currently selected jobs to an invoice.
     *
     * Validates that the selected jobs can be added (no duplicate hashes),
     * creates a new invoice if the user chose the "new" option, and assigns
     * all selected jobs to the target invoice. Updates both local and
     * persisted state and shows a success or error notification.
     *
     * @returns A Promise that resolves once the jobs have been assigned.
     */
    const handleAddToInvoice = async () => {
        const jobsToAdd = jobState.jobs.filter(j => selectedIds.has(j.id));
        
        // Validation using service
        const errorKey = invoiceService.validateJobsForInvoice(jobsToAdd, duplicateHashes);
        if (errorKey) {
            setNotification({ msg: t(errorKey), type: 'error' });
            return;
        }

        let targetInvoiceId = selectedInvoiceId;
        
        if (targetInvoiceId === 'new') {
            const newInvoice = invoiceService.createNewInvoice(invoiceState.invoices.length, jobsToAdd[0]);
            await dbService.addInvoice(newInvoice);
            invoiceDispatch({ type: 'ADD_INVOICE', payload: newInvoice });
            targetInvoiceId = newInvoice.id;
        }

        if (!targetInvoiceId) {
            setNotification({ msg: t('jobs.notifications.selectInvoice'), type: 'warning' });
            return;
        }

        // Assign jobs using service
        const updatedInvoice = await invoiceService.assignJobs(targetInvoiceId, Array.from(selectedIds));
        invoiceDispatch({ type: 'UPDATE_INVOICE', payload: updatedInvoice });
        
        // Update local job state
        const updatedJobs = jobState.jobs.map(j => {
            if (selectedIds.has(j.id)) {
                return { ...j, status: 'Invoiced' as JobStatus, parentInvoiceId: targetInvoiceId };
            }
            return j;
        });
        jobDispatch({ type: 'SET_JOBS', payload: updatedJobs });
        
        setNotification({ msg: t('jobs.notifications.addedSuccess'), type: 'success' });
        setSelectedIds(new Set());
        setSelectedInvoiceId('');
    };

    /**
     * Deletes all currently selected jobs from the database and local state.
     *
     * Prompts the user for confirmation before proceeding. On success, clears
     * the selection set and displays a success notification.
     *
     * @returns A Promise that resolves once the jobs have been deleted.
     */
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;

        if (window.confirm(localT('deleteConfirm'))) {
            const idsToDelete = Array.from(selectedIds);
            await dbService.deleteJobs(idsToDelete);
            jobDispatch({ type: 'DELETE_JOBS', payload: idsToDelete });
            
            setNotification({ msg: t('jobs.notifications.deletedSuccess'), type: 'success' });
            setSelectedIds(new Set());
        }
    };

    /**
     * Exports all jobs in the current state as a JSON file download.
     *
     * Serialises the jobs array with pretty-printing and triggers a
     * browser download of the resulting `.json` file, timestamped with
     * the current date.
     *
     * @return void
     */
    const handleExportJobs = () => {
        const dataStr = JSON.stringify(jobState.jobs, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `jobs_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    /**
     * Programmatically triggers the hidden JSON file input element.
     *
     * Opens the browser's native file-picker dialog so the user can
     * select a `.json` file for import.
     *
     * @return void
     */
    const handleImportJsonClick = () => {
        jsonFileInputRef.current?.click();
    };

    /**
     * Handles the change event of the hidden JSON file input.
     *
     * Reads the selected file, parses it as a JSON array of {@link Job}
     * objects, and—after user confirmation—imports them into the database
     * and local state. Also extracts and registers any new metadata
     * (materials, types, doctors, patients) found in the imported data.
     *
     * @param event The change event from the file input element.
     * @return A Promise that resolves once the import is complete.
     */
    const handleJsonFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedJobs = JSON.parse(text) as Job[];

            if (!Array.isArray(importedJobs)) {
                setNotification({ msg: localT('invalidFileFormat'), type: 'error' });
                return;
            }

            if (window.confirm(localT('importConfirm', { count: String(importedJobs.length) }))) {
                const recalculatedImportedJobs = importedJobs.map(job => {
                    const recalc = calculateJobPrice(job, tariffState.rules);
                    return recalc ? { ...job, ...recalc } : job;
                });
                await dbService.addJobs(recalculatedImportedJobs);
                jobDispatch({ type: 'ADD_JOBS', payload: recalculatedImportedJobs });

                // Extract and register metadata from the imported JSON jobs
                const materials = new Set<string>();
                const types = new Set<string>();
                const doctors = new Set<string>();
                const patients = new Set<string>();

                importedJobs.forEach(job => {
                    if (job.doctorName) doctors.add(job.doctorName);
                    if (job.patientName) patients.add(job.patientName);
                    if (job.teeth) {
                        job.teeth.forEach(tooth => {
                            if (tooth.material && tooth.material !== 'Unknown') {
                                materials.add(tooth.material);
                            }
                            if (tooth.type && tooth.type !== 'Unknown') {
                                types.add(tooth.type);
                            }
                        });
                    }
                });

                if (materials.size > 0) await dbService.addMetadata('materials', Array.from(materials));
                if (types.size > 0) await dbService.addMetadata('types', Array.from(types));
                if (doctors.size > 0) await dbService.addMetadata('doctors', Array.from(doctors));
                if (patients.size > 0) await dbService.addMetadata('patients', Array.from(patients));

                await refreshMetadata();
                setNotification({ msg: t('jobs.notifications.importSuccess'), type: 'success' });
            }
        } catch (error) {
            console.error('Import error:', error);
            setNotification({ msg: t('jobs.notifications.importError'), type: 'error' });
        } finally {
            if (jsonFileInputRef.current) jsonFileInputRef.current.value = '';
        }
    };

    /**
     * Scans the file system for new `.dentalProject` files and imports them.
     *
     * Uses the file scanner service to discover and parse files not yet
     * present in the job list. Persists the new jobs and any discovered
     * metadata (materials, types) to the database, then refreshes local
     * state. Shows a warning if no new files are found.
     *
     * @return A Promise that resolves once the import process finishes.
     */
    const handleImport = async () => {
        setImporting(true);
        try {
            const { jobs: newJobs, updatedJobs, materials, types } = await scanAndParseFolder(jobState.jobs);
            
            if (newJobs.length === 0 && updatedJobs.length === 0) {
                setNotification({ msg: localT('importWarningNoNewProjects'), type: 'warning' });
                setImporting(false);
                return;
            }

            // Recalculate pricing for updated jobs because they have new 3D model units
            const recalculatedUpdatedJobs = updatedJobs.map(job => {
                const recalc = calculateJobPrice(job, tariffState.rules);
                return recalc ? { ...job, ...recalc } : job;
            });

            const recalculatedNewJobs = newJobs.map(job => {
                const recalc = calculateJobPrice(job, tariffState.rules);
                return recalc ? { ...job, ...recalc } : job;
            });

            if (recalculatedNewJobs.length > 0) {
                await dbService.addJobs(recalculatedNewJobs);
                jobDispatch({ type: 'ADD_JOBS', payload: recalculatedNewJobs });
            }

            if (recalculatedUpdatedJobs.length > 0) {
                await dbService.addJobs(recalculatedUpdatedJobs);
                jobDispatch({ type: 'UPDATE_JOBS', payload: recalculatedUpdatedJobs });
            }

            await dbService.addMetadata('materials', materials);
            await dbService.addMetadata('types', types);
            await refreshMetadata();

            let msg = '';
            if (recalculatedNewJobs.length > 0 && recalculatedUpdatedJobs.length > 0) {
                msg = localT('importSuccessMix', { 
                    newCount: recalculatedNewJobs.length.toString(), 
                    updatedCount: recalculatedUpdatedJobs.length.toString() 
                });
            } else if (recalculatedNewJobs.length > 0) {
                msg = t('jobs.notifications.importSuccess');
            } else {
                msg = localT('importSuccessUpdatedOnly', { 
                    updatedCount: recalculatedUpdatedJobs.length.toString() 
                });
            }
            setNotification({ msg, type: 'success' });
        } catch (error) {
            console.error(error);
            setNotification({ msg: t('jobs.notifications.importError'), type: 'error' });
        } finally {
            setImporting(false);
        }
    };

    /**
     * Creates a new blank manual job and opens it in the edit modal.
     *
     * Initialises a {@link Job} object with sensible defaults (status
     * `'Manual'`, empty teeth array, HUF currency) and sets it as the
     * editing job so the {@link JobEditModal} opens for further data entry.
     *
     * @return void
     */
    const handleCreateManualJob = () => {
        const newJob: Job = {
            id: `MANUAL-${Date.now()}`,
            patientName: '',
            doctorName: '',
            fileName: 'Manual Entry',
            createdAt: new Date().toISOString(),
            teeth: [],
            unitCount: 0,
            status: 'Manual',
            price: 0,
            currency: 'HUF',
            notes: '',
            validationErrors: []
        };
        setEditingJob(newJob);
    };

    /**
     * Saves an updated job (existing or newly created) to the database and local state.
     *
     * Automatically recalculates the job price and status using the current tariff rules
     * before database insertion and state dispatching (except for discarded jobs).
     * Performs automatic metadata cleanup to remove stale entries no longer referenced by any job.
     *
     * @param updatedJob The job object with the latest edits applied.
     * @return A Promise that resolves once the job has been persisted.
     */
    const handleUpdateJob = async (updatedJob: Job) => {
        const original = jobState.jobs.find(j => j.id === updatedJob.id);
        
        let jobToSave = updatedJob;
        if (updatedJob.status !== 'Discarded') {
            const recalc = calculateJobPrice(updatedJob, tariffState.rules);
            if (recalc) {
                jobToSave = recalc;
            }
        }

        if (original) {
            await dbService.updateJob(jobToSave);
            jobDispatch({ type: 'UPDATE_JOB', payload: jobToSave });
            setNotification({ msg: localT('jobUpdated'), type: 'success' });

            // Perform automatic metadata cleanup
            const cleaned = await metadataService.performAutomaticCleanup(original, jobToSave, jobState.jobs);
            
            if (cleaned.length > 0) {
                cleaned.forEach(val => {
                    addLog(localT('removedMetadata', { val }), 'warning', localT('autoCleanup'));
                });
                await refreshMetadata();
            }
        } else {
            // New Job
            await dbService.addJobs([jobToSave]);
            jobDispatch({ type: 'ADD_JOBS', payload: [jobToSave] });
            setNotification({ msg: localT('manualJobCreated'), type: 'success' });
        }
    };

    /**
     * Recalculates prices for all non-discarded jobs against the current tariff rules.
     *
     * Iterates over every job, applies the pricing engine with the loaded rules,
     * and persists any jobs whose price or status changed. Skips discarded jobs.
     * Displays a summary notification indicating how many jobs were updated and
     * whether any errors occurred.
     *
     * @return A Promise that resolves once all jobs have been recalculated.
     */
    const handleRecalculate = async () => {
        if (tariffState.rules.length === 0) {
            setNotification({ msg: t('jobs.notifications.noRules'), type: 'error' });
            return;
        }
        let updatedCount = 0;
        let errorCount = 0;
        const updatedJobsList: Job[] = [];
        
        for (const job of jobState.jobs) {
            if (job.status === 'Discarded') {
                updatedJobsList.push(job);
                continue;
            }
            const updatedJob = calculateJobPrice(job, tariffState.rules);
            if (!updatedJob) {
                errorCount++;
                updatedJobsList.push(job);
                continue;
            }
            if (updatedJob.status !== job.status || updatedJob.price !== job.price) {
                await dbService.updateJob(updatedJob);
                updatedCount++;
            }
            // Push the updatedJob (new reference) to trigger dependencies in the UI/JobRow
            updatedJobsList.push(updatedJob);
        }
        
        jobDispatch({ type: 'SET_JOBS', payload: updatedJobsList });
        
        if (errorCount > 0) {
            setNotification({ msg: t('jobs.notifications.recalculationErrors'), type: 'warning' });
        } else if (updatedCount > 0) {
            setNotification({ msg: t('jobs.notifications.recalculated'), type: 'success' });
        } else {
            setNotification({ msg: t('jobs.notifications.noChanges'), type: 'success' });
        }
    };

    const handleDelete = useCallback(async (id: string) => {
        if (window.confirm(localT('deleteConfirm'))) {
            await dbService.deleteJob(id);
            jobDispatch({ type: 'DELETE_JOB', payload: id });
        }
    }, [jobDispatch, localT]);

    const handleDiscard = useCallback(async (job: Job) => {
        const updatedJob = { ...job, status: 'Discarded' as JobStatus, price: 0 };
        await dbService.updateJob(updatedJob);
        jobDispatch({ type: 'UPDATE_JOB', payload: updatedJob });
        setNotification({ msg: localT('jobDiscarded'), type: 'success' });
    }, [jobDispatch, localT]);

    const handleExcludeFromRule = useCallback(async (ruleId: string, projectId: string, toothId?: string) => {
        const rule = tariffState.rules.find(r => r.id === ruleId);
        if (!rule) {
            setNotification({ msg: localT('ruleNotFound'), type: 'error' });
            return;
        }

        const targetJob = jobState.jobs.find(j => j.projectId === projectId);
        if (!targetJob) {
            setNotification({ msg: localT('jobNotFound'), type: 'error' });
            return;
        }

        const toggleResult = toggleRuleExclusion(
            targetJob.teeth,
            targetJob.excludedRuleIds,
            ruleId,
            toothId
        );
        if (!toggleResult) {
            return;
        }
        const { updatedTeeth, updatedJobExcludedRuleIds, wasExcluded } = toggleResult;

        const updatedJob: Job = toothId !== undefined
            ? { ...targetJob, teeth: updatedTeeth }
            : { ...targetJob, excludedRuleIds: updatedJobExcludedRuleIds };

        const recalculatedJob = calculateJobPrice(updatedJob, tariffState.rules);
        if (!recalculatedJob) {
            setNotification({ msg: localT('recalcFailed'), type: 'error' });
            return;
        }

        await dbService.updateJob(recalculatedJob);
        jobDispatch({ type: 'UPDATE_JOB', payload: recalculatedJob });

        // Sync editingJob so JobEditModal re-initializes formData with the recalculated state
        if (editingJob?.id === recalculatedJob.id) {
            setEditingJob(recalculatedJob);
        }

        const msg = buildExclusionToastMessage({
            t,
            ruleName: rule.name,
            projectId,
            toothId,
            wasExcluded
        });
        setNotification({ msg, type: 'success' });
    }, [tariffState.rules, jobState.jobs, jobDispatch, t, localT, editingJob]);

    const isFiltered = jobState.jobs.length !== filteredJobs.length;

    return (
        <Box className="jobManagerContainer">
            <input 
                type="file" 
                ref={jsonFileInputRef} 
                className="hiddenInput"
                accept=".json" 
                onChange={handleJsonFileChange} 
            />
            <JobManagerHeader
                jobs={jobState.jobs}
                isDeveloperMode={isDeveloperMode}
                importing={importing}
                onImportJsonClick={handleImportJsonClick}
                onExportJobs={handleExportJobs}
                onImport={handleImport}
                onRecalculate={handleRecalculate}
                onAddManual={handleCreateManualJob}
            />

            <JobFilter
                inputValue={inputValue}
                onSearchChange={handleSearchChange}
                onClearFilters={handleClearFilters}
                isFiltered={isFiltered}
                onColumnMenuOpen={handleColumnMenuOpen}
                onDeleteSelected={handleDeleteSelected}
                selectedCount={selectedIds.size}
            />

            {isFiltered && !isDemo && (
                <Alert severity="info" icon={<FilterList />} className="filterAlert">
                    {t('jobs.filter.showing')} <b>{filteredJobs.length}</b> {t('jobs.filter.results')} {jobState.jobs.length}).
                </Alert>
            )}

            <Paper 
                variant="outlined" 
                className="tablePaper"
            >
                <ShowcaseOverlay isDemo={isDemo} label={<ShowcaseLabel />}>
                    <JobTable
                        jobs={effectiveJobs}
                        sortedJobs={sortedJobs}
                        visibleColumns={visibleColumns}
                        columnWidths={columnWidths}
                        sortConfig={sortConfig}
                        selectedIds={selectedIds}
                        selectionState={selectionState}
                        columnMenuAnchor={columnMenuAnchor}
                        filterOptions={filterOptions}
                        columnFilters={columnFilters}
                        dateFilter={dateFilter}
                        duplicateHashes={duplicateHashes}
                        onColumnResize={handleColumnResize}
                        onSort={handleSort}
                        onSelectAll={handleSelectAll}
                        onSelectOne={handleSelectOne}
                        onColumnMenuOpen={handleColumnMenuOpen}
                        onColumnMenuClose={handleColumnMenuClose}
                        onColumnToggle={handleColumnToggle}
                        onDateFilterChange={(start, end) => setDateFilter({ start, end })}
                        onColumnFilterChange={handleColumnFilterChange}
                        onEdit={setEditingJob}
                        onDiscard={handleDiscard}
                        onDelete={handleDelete}
                        materials={availableMaterials}
                        types={availableTypes}
                    />
                </ShowcaseOverlay>
            </Paper>

            <JobManagerFooter
                selectedIds={selectedIds}
                invoiceState={invoiceState}
                selectedInvoiceId={selectedInvoiceId}
                setSelectedInvoiceId={setSelectedInvoiceId}
                onAddToInvoice={handleAddToInvoice}
                t={t}
                localT={localT}
                isDemo={isDemo}
            />

            <JobEditModal
                open={!!editingJob}
                job={editingJob}
                onClose={() => setEditingJob(null)}
                onSave={handleUpdateJob}
                onDelete={editingJob && jobState.jobs.some(j => j.id === editingJob.id) ? handleDelete : undefined}
                isNew={editingJob ? !jobState.jobs.some(j => j.id === editingJob.id) : true}
                materials={availableMaterials}
                types={availableTypes}
                doctors={availableDoctors}
                patients={availablePatients}
                isDeveloperMode={isDeveloperMode}
                onMetadataChange={refreshMetadata}
                onExcludeFromRule={handleExcludeFromRule}
                onAttrListChange={refreshMetadata}
            />

            <Snackbar open={!!notification} autoHideDuration={6000} onClose={() => setNotification(null)}>
                <Alert onClose={() => setNotification(null)} severity={notification?.type} className="notificationAlert">
                    {notification?.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export { JobManagerPage };
