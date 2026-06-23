/** @file useTariffEditor.ts - Custom hook providing the full tariff rule editor surface: CRUD operations, drag-and-drop reordering, bulk selection/deletion, duplicate, import/export, job recalculations, and exclusion management for tariff rules. */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTariffs } from '../context/TariffContext';
import { useJobs } from '../context/JobContext';
import { useLogs } from '../context/LogContext';
import { useLanguage } from '../context/LanguageContext';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { dbService } from '../services/db';
import { calculateJobPrice } from '../services/pricingEngine';
import type { TariffRule, Job, TariffCondition } from '../types';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { partitionAttributes } from '../utils/attributeFilter';

/**
 * Validates the conditions of a single tariff rule against available materials and types.
 * Performs structural checks (operator-value compatibility) and domain checks
 * (material/type values exist in known metadata). Pushes error messages into a shared
 * errors array for batch reporting.
 *
 * @param r - The tariff rule whose conditions are to be validated.
 * @param availableMaterials - List of known/registered material names.
 * @param availableTypes - List of known/registered type names.
 * @param errors - Mutable array to collect human-readable error strings.
 * @returns `true` if the rule's conditions passed all validation checks; `false` otherwise.
 */
const validateRuleConditions = (r: TariffRule, availableMaterials: string[], availableTypes: string[], errors: string[]) => {
    let isRuleValid = true;
    r.conditions.forEach(c => {
        // Structural checks
        if ((c.operator === 'isOneOf' || c.operator === 'notOneOf') && !Array.isArray(c.value)) {
            errors.push(`Rule '${r.name}': Operator '${c.operator}' requires an array value.`);
            isRuleValid = false;
        }
        if ((c.operator === 'greaterThan' || c.operator === 'lessThan') && typeof c.value !== 'number') {
             errors.push(`Rule '${r.name}': Operator '${c.operator}' requires a numeric value.`);
             isRuleValid = false;
        }

        // Domain checks
        const values = Array.isArray(c.value) ? c.value : [c.value];
        if (c.field === 'material') {
            values.forEach(v => {
                if (typeof v === 'string' && v && !availableMaterials.includes(v)) {
                    errors.push(`Rule '${r.name}': Unknown material '${v}'`);
                }
            });
        }
        if (c.field === 'type') {
             values.forEach(v => {
                if (typeof v === 'string' && v && !availableTypes.includes(v)) {
                    errors.push(`Rule '${r.name}': Unknown type '${v}'`);
                }
            });
        }
    });
    return isRuleValid;
};



/**
 * Custom hook that provides the complete tariff rule editor interface.
 * Manages rule CRUD, drag-and-drop reordering, bulk selection, import/export,
 * job recalculation, exclusion management, and metadata loading.
 *
 * @returns An object containing the editor state and all handler functions.
 */
export const useTariffEditor = () => {
    const { state, dispatch } = useTariffs();
    const { state: jobState, dispatch: jobDispatch } = useJobs();
    const { addLog } = useLogs();
    const { t } = useLanguage();
    const { confirm, dialog: confirmDialog } = useConfirmDialog();
    const [isEditing, setIsEditing] = useState(false);
    const [editingRule, setEditingRule] = useState<TariffRule | null>(null);
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);
    const [availableDoctors, setAvailableDoctors] = useState<string[]>([]);
    const [availablePatients, setAvailablePatients] = useState<string[]>([]);
    const [hiddenMaterials, setHiddenMaterials] = useState<Set<string>>(new Set());
    const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
    const [hiddenDoctors, setHiddenDoctors] = useState<Set<string>>(new Set());
    const [hiddenPatients, setHiddenPatients] = useState<Set<string>>(new Set());
    const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    /**
     * Bumped by callers (e.g. AutocompleteWithHide after a hide/restore) to
     * force the attribute lists to re-partition. Bumping this in a setState
     * triggers the load effect below.
     */
    const [attrListVersion, setAttrListVersion] = useState(0);
    const refreshAttributeLists = useCallback(() => {
        setAttrListVersion(v => v + 1);
    }, []);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const [materials, types, doctorsMeta, patientsMeta] = await Promise.all([
                    dbService.getMetadata('materials'),
                    dbService.getMetadata('types'),
                    dbService.getMetadata('doctors'),
                    dbService.getMetadata('patients')
                ]);
                const rawMaterials = materials || [];
                const rawTypes = types || [];

                const jobDocs = new Set<string>();
                const jobPatients = new Set<string>();
                jobState.jobs.forEach(j => {
                    if (j.doctorName && j.doctorName !== 'Unknown') jobDocs.add(j.doctorName.trim());
                    if (j.patientName && j.patientName !== 'Unknown') jobPatients.add(j.patientName.trim());
                });

                const rawDoctors = Array.from(new Set([...(doctorsMeta || []), ...Array.from(jobDocs)])).sort();
                const rawPatients = Array.from(new Set([...(patientsMeta || []), ...Array.from(jobPatients)])).sort();

                // partitionAttributes is currently keying off the user's
                // per-category hidden-attribute list (localStorage), not off
                // tariff rules. `state.rules` is still a dependency of the
                // surrounding useEffect so the partition is re-run when rules
                // change (e.g. a rule kind rename migration).
                const partitionedMaterials = partitionAttributes(rawMaterials, 'material');
                const partitionedTypes = partitionAttributes(rawTypes, 'type');
                const partitionedDoctors = partitionAttributes(rawDoctors, 'doctorName');
                const partitionedPatients = partitionAttributes(rawPatients, 'patientName');

                setAvailableMaterials(partitionedMaterials.ordered);
                setHiddenMaterials(partitionedMaterials.hidden);

                setAvailableTypes(partitionedTypes.ordered);
                setHiddenTypes(partitionedTypes.hidden);

                setAvailableDoctors(partitionedDoctors.ordered);
                setHiddenDoctors(partitionedDoctors.hidden);

                setAvailablePatients(partitionedPatients.ordered);
                setHiddenPatients(partitionedPatients.hidden);
            } catch (error) {
                console.error('Failed to load metadata in useTariffEditor:', error);
            }
        };
        loadMetadata();
    }, [jobState.jobs, state.rules, attrListVersion]);

    /**
     * Recalculates prices for all non-discarded jobs using the current set of rules.
     * Updates each job in the database and dispatches the updated jobs to the store.
     *
     * Pass `force: true` to also re-evaluate Invoiced teeth. The pricing engine
     * normally short-circuits Invoiced jobs to avoid changing historical invoice
     * data. Callers should only force-recalculate when a job's invoice-visible
     * state may have changed for other reasons.
     *
     * @param currentRules - The tariff rules to apply during recalculation.
     * @param options      - Optional recalculation options.
     * @param options.force - When `true`, re-evaluates Invoiced jobs as well.
     */
    const recalculateWithRules = async (
        currentRules: TariffRule[],
        options: { force?: boolean } = {}
    ) => {
        const force = options.force === true;
        addLog(t('toast.recalc.start'), 'info');
        setTimeout(async () => {
            try {
                const updatedJobs = jobState.jobs.map(job => {
                     if (job.status === 'Discarded') return job;
                     try {
                         const result = calculateJobPrice(job, currentRules, force);
                         if (!result) {
                             addLog(`Failed to calculate price for job ${job.patientName}`, 'error', 'Invalid job or rules');
                             return job;
                         }
                         return result;
                     } catch (e) {
                         console.error(`Failed to calculate price for job ${job.id}:`, e);
                         addLog(`Failed to calculate price for job ${job.patientName}`, 'error', String(e));
                         return job; // Return original job if calculation fails
                     }
                });

                // Filter out any null results (shouldn't happen due to error handling above, but just in case)
                const validJobs = updatedJobs.filter((job): job is Job => job !== null);

                let changedCount = 0;
                for (const job of validJobs) {
                    await dbService.updateJob(job);
                    changedCount++;
                }

                jobDispatch({ type: 'SET_JOBS', payload: validJobs });
                addLog(t('toast.recalc.success').replace('{count}', String(changedCount)), 'success');
            } catch (e) {
                console.error(e);
                addLog(t('toast.recalc.error'), 'error', String(e));
            }
        }, 100);
    };

    /**
     * Recalculates prices for all non-discarded jobs using an in-progress rule
     * that the user is editing in the rule editor modal. Unlike
     * {@link recalculateWithRules}, this method persists the in-progress rule
     * to IndexedDB first (so it appears in the array passed to
     * `calculateJobPrice`) and does NOT close the editor — the rule editor
     * modal stays open so the user can keep iterating on the rule.
     *
     * The `force` flag is enabled when the rule hides invoice visibility
     * matching the heuristic used by
     * {@link handleSave} so Invoiced teeth are refreshed when relevant.
     *
     * For brand-new rules (where `rule.id` is empty), this method is a no-op:
     * the rule has not been saved yet, so there is nothing to persist and the
     * live `ApplicationList` is recomputed from local form state instead.
     *
     * @param rule - The in-progress tariff rule from the rule editor modal.
     * @param options - Optional recalculation options.
     * @param options.force - When `true`, re-evaluates Invoiced jobs as well.
     * @returns A promise that resolves when the recalculation completes.
     */
    const recalculatePreview = async (
        rule: TariffRule,
        options: { force?: boolean } = {}
    ) => {
        if (!rule.id) {
            // New rule: nothing is persisted yet. The modal's local useMemo
            // recomputes `activeApplications` from the form state directly.
            return;
        }
        try {
            await dbService.updateRule(rule);
        } catch (e) {
            console.error('Failed to persist in-progress rule for preview recalc:', e);
            return;
        }
        dispatch({ type: 'UPDATE_RULE', payload: rule });
        const updatedRules = state.rules.map(r => r.id === rule.id ? rule : r);
        const force = options.force === true;
        await recalculateWithRules(updatedRules, { force });
    };

    /**
     * Validates a batch of imported tariff rules against available materials and types.
     * Returns only the rules that pass validation along with any error messages.
     *
     * @param importedRules - The array of rules to validate.
     * @returns An object containing:
     *   - `errors`: Array of human-readable error strings for invalid rules.
     *   - `validRules`: Array of rules that passed all validation checks.
     */
    const validateImportedRules = (importedRules: TariffRule[]) => {
        const errors: string[] = [];
        const validRules: TariffRule[] = [];
        
        importedRules.forEach(r => {
            if (validateRuleConditions(r, availableMaterials, availableTypes, errors)) {
                validRules.push(r);
            }
        });
        return { errors, validRules };
    };

    /**
     * Selects or deselects all non-system rules in the list.
     *
     * @param checked - `true` to select all non-system rules; `false` to clear the selection.
     */
    const handleSelectAllRules = (checked: boolean) => {
        if (checked) {
            setSelectedRuleIds(new Set(state.rules.filter(r => !r.isSystem).map(r => r.id)));
        } else {
            setSelectedRuleIds(new Set());
        }
    };

    /**
     * Toggles selection of a single rule by its ID.
     *
     * @param id - The ID of the rule to select or deselect.
     * @param checked - `true` to select the rule; `false` to deselect.
     */
    const handleSelectOneRule = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedRuleIds);
        if (checked) newSelected.add(id);
        else newSelected.delete(id);
        setSelectedRuleIds(newSelected);
    };

    /**
     * Deletes all currently selected rules after user confirmation.
     * Filters out system rules, persists the deletion, and triggers a full recalculation.
     */
    const handleDeleteSelectedRules = async () => {
        if (selectedRuleIds.size === 0) return;
        
        const idsToDelete = Array.from(selectedRuleIds).filter(id => {
            const rule = state.rules.find(r => r.id === id);
            return rule && !rule.isSystem;
        });

        if (idsToDelete.length === 0) return;
        
        const confirmed = await confirm({
            title: t('tariff.list.delete'),
            message: `Are you sure you want to delete ${idsToDelete.length} rules?`,
            confirmText: t('tariff.list.delete'),
            severity: 'error'
        });
        
        if (confirmed) {
            await dbService.deleteRules(idsToDelete);
            dispatch({ type: 'DELETE_RULES', payload: idsToDelete });

            setSelectedRuleIds(new Set());
            const remainingRules = state.rules.filter(r => !idsToDelete.includes(r.id));
            // Invoiced jobs are not force-recalculated on bulk delete.
            const force = false;
            await recalculateWithRules(remainingRules, { force });
            addLog(t('toast.rules.deleted').replace('{count}', String(idsToDelete.length)), 'warning');
        }
    };

    /**
     * Returns the next available priority value (current max + 1).
     *
     * @returns The next priority number.
     */
    const getNextPriority = () => {
        if (state.rules.length === 0) return 1;
        return Math.max(...state.rules.map(r => r.priority)) + 1;
    };

    /**
     * Initializes the editor with a blank new rule and opens the edit panel.
     */
    const handleCreate = () => {
        const newRule: TariffRule = {
            id: '',
            name: '',
            label: '',
            priority: getNextPriority(),
            conditions: [{ field: 'material', operator: 'equals', value: '' }],
            action: { value: 0 }
        };
        setEditingRule(newRule);
        setIsEditing(true);
    };

    /**
     * Opens the editor with an existing rule for modification.
     *
     * @param rule - The tariff rule to edit.
     */
    const handleEdit = (rule: TariffRule) => {
        setEditingRule(rule);
        setIsEditing(true);
    };

    /**
     * Handles the end of a drag-and-drop reorder event. Reorders rules, updates
     * their priorities sequentially, persists the new order, and recalculates jobs.
     *
     * @param event - The drag-end event from @dnd-kit containing active and over item IDs.
     */
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = state.rules.findIndex((r) => r.id === active.id);
            const newIndex = state.rules.findIndex((r) => r.id === over.id);

            const newOrder = arrayMove(state.rules, oldIndex, newIndex);
            const reorderedRules = newOrder.map((r, idx) => ({
                ...r,
                priority: idx + 1
            }));

            dispatch({ type: 'REORDER_RULES', payload: reorderedRules });
            await dbService.updateRules(reorderedRules);
            await recalculateWithRules(reorderedRules);
            addLog(t('toast.rules.reordered'), 'info');
        }
    };

    /**
     * Moves a rule one position up in the priority list. Persists the new order
     * and triggers a full recalculation.
     *
     * @param id - The ID of the rule to move up.
     */
    const handleMoveUp = async (id: string) => {
        const index = state.rules.findIndex(r => r.id === id);
        if (index <= 0) return;
        
        const newOrder = arrayMove(state.rules, index, index - 1);
        const reorderedRules = newOrder.map((r, idx) => ({ ...r, priority: idx + 1 }));

        dispatch({ type: 'REORDER_RULES', payload: reorderedRules });
        await dbService.updateRules(reorderedRules);
        await recalculateWithRules(reorderedRules);
    };

    /**
     * Moves a rule one position down in the priority list. Persists the new order
     * and triggers a full recalculation.
     *
     * @param id - The ID of the rule to move down.
     */
    const handleMoveDown = async (id: string) => {
        const index = state.rules.findIndex(r => r.id === id);
        if (index < 0 || index >= state.rules.length - 1) return;
        
        const newOrder = arrayMove(state.rules, index, index + 1);
        const reorderedRules = newOrder.map((r, idx) => ({ ...r, priority: idx + 1 }));

        dispatch({ type: 'REORDER_RULES', payload: reorderedRules });
        await dbService.updateRules(reorderedRules);
        await recalculateWithRules(reorderedRules);
    };

    /**
     * Recalculates all jobs using the currently loaded set of rules.
     */
    const handleRecalculate = async () => {
        await recalculateWithRules(state.rules);
    };

    /**
     * Deletes a single rule after user confirmation. Removes it from the database,
     * updates state, and recalculates all remaining rules.
     *
     * @param id - The ID of the rule to delete.
     */
    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            message: 'Are you sure you want to delete this rule?',
            confirmText: 'Delete',
            severity: 'error'
        });
        if (confirmed) {
            await dbService.deleteRule(id);
            dispatch({ type: 'DELETE_RULE', payload: id });
            const remainingRules = state.rules.filter(r => r.id !== id);
            // Invoiced jobs are not force-recalculated on single-rule delete.
            const force = false;
            await recalculateWithRules(remainingRules, { force });
            addLog(t('toast.rule.deleted'), 'warning');
        }
    };

    /**
     * Saves a tariff rule — either creates a new rule (if `editingRule` has no ID)
     * or updates an existing one. Persists to the database, dispatches the update,
     * and triggers a full recalculation.
     *
     * Invoiced jobs are never force-recalculated on rule save, which is safe
     * because no remaining field on the rule affects Invoiced job state.
     *
     * @param rule - The tariff rule to save (may be new or existing).
     */
    const handleSave = async (rule: TariffRule) => {
        let updatedRules = [...state.rules];
        if (editingRule && editingRule.id) {
            await dbService.updateRule(rule);
            dispatch({ type: 'UPDATE_RULE', payload: rule });
            updatedRules = updatedRules.map(r => r.id === rule.id ? rule : r);
            addLog(t('toast.rule.updated').replace('{name}', rule.name), 'success');
        } else {
            const newRule = { ...rule, id: rule.id || crypto.randomUUID() };
            await dbService.addRule(newRule);
            dispatch({ type: 'ADD_RULE', payload: newRule });
            updatedRules.push(newRule);
            addLog(t('toast.rule.created').replace('{name}', rule.name), 'success');
        }
        setIsEditing(false);
        setEditingRule(null);
        // Invoiced jobs are not force-recalculated on rule save.
        const force = false;
        await recalculateWithRules(updatedRules, { force });
    };

    /**
     * Duplicates an existing tariff rule. Optionally saves the current rule first
     * before creating a clone with a fresh ID and incremented priority.
     *
     * @param rule - The rule to duplicate.
     * @param isSaveCurrent - If `true`, saves changes to the current rule before duplicating.
     */
    const handleDuplicate = async (rule: TariffRule, isSaveCurrent: boolean = false) => {
        let updatedRules = [...state.rules];
        
        if (isSaveCurrent) {
            if (rule.id) {
                await dbService.updateRule(rule);
                dispatch({ type: 'UPDATE_RULE', payload: rule });
                updatedRules = updatedRules.map(r => r.id === rule.id ? rule : r);
                addLog(t('toast.rule.updated').replace('{name}', rule.name), 'success');
            }
        }

        const nameSuffix = t('common.copy') || 'Copy';
        const clonedRule: TariffRule = {
            ...rule,
            id: crypto.randomUUID(),
            name: `${rule.name} (${nameSuffix})`,
            label: rule.label ? `${rule.label} (${nameSuffix})` : '',
            priority: getNextPriority(),
            isSystem: false
        };

        await dbService.addRule(clonedRule);
        dispatch({ type: 'ADD_RULE', payload: clonedRule });
        updatedRules.push(clonedRule);

        // Invoiced jobs are not force-recalculated on duplicate.
        const force = false;
        await recalculateWithRules(updatedRules, { force });

        setEditingRule(clonedRule);
        setIsEditing(true);
        addLog(t('toast.rule.duplicated').replace('{name}', rule.name), 'success');
    };

    /**
     * Exports rules (user-created or system) as a JSON file download.
     *
     * @param type - `'user'` to export non-system rules; `'system'` to export system rules.
     */
    const handleExport = (type: 'user' | 'system') => {
        const rulesToExport = state.rules.filter(r => type === 'system' ? r.isSystem : !r.isSystem);
        const prefix = type === 'system' ? 'system_rules' : 'tariff_rules';
        
        const dataStr = JSON.stringify(rulesToExport, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addLog(t('toast.export.success').replace('{count}', String(rulesToExport.length)).replace('{type}', type), 'info');
    };

    /**
     * Triggers a click on the hidden file input element to open the file picker for import.
     */
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    /**
     * Creates a new rule template pre-populated with conditions derived from a job's
     * material, type, doctor, and patient. Opens the editor with this template.
     *
     * @param material - The material value for the condition (empty string to omit).
     * @param type - The type value for the condition (empty string to omit).
     * @param doctorName - The doctor name for the condition (empty string to omit).
     * @param patientName - The patient name for the condition (empty string to omit).
     */
    const handleUseAsTemplate = (material: string, type: string, doctorName: string, patientName: string) => {
        const parts = [];
        if (doctorName) parts.push(doctorName);
        if (patientName) parts.push(patientName);
        const namePrefix = parts.join('/') || 'Any';
        const ruleName = `Rule for ${namePrefix}, ${material} ${type}`;
        
        const conditions: TariffCondition[] = [];
        if (material) {
            conditions.push({ field: 'material', operator: 'equals', value: material });
        }
        if (type) {
            conditions.push({ field: 'type', operator: 'equals', value: type });
        }
        if (doctorName) {
            conditions.push({ field: 'doctorName', operator: 'equals', value: doctorName });
        }
        if (patientName) {
            conditions.push({ field: 'patientName', operator: 'equals', value: patientName });
        }

        const templateRule: TariffRule = {
            id: '',
            name: ruleName,
            label: ruleName,
            priority: getNextPriority(),
            conditions,
            action: { value: 0 }
        };
        setEditingRule(templateRule);
        setIsEditing(true);
    };

    /**
     * Updates a job in the database and dispatches the change to the store.
     *
     * @param updatedJob - The job object with the applied modifications.
     */
    const handleUpdateJob = async (updatedJob: Job) => {
        await dbService.updateJob(updatedJob);
        jobDispatch({ type: 'UPDATE_JOB', payload: updatedJob });
        setEditingJob(null);
        addLog(t('toast.job.updated').replace('{id}', updatedJob.id), 'success');
    };

    /**
     * Handles the file input change event when a user selects a JSON file for import.
     * Parses the file, validates imported rules, dynamically registers new materials/types,
     * persists valid rules, recalculates jobs, and provides user feedback.
     *
     * @param event - The change event from the hidden file input element.
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedRules = JSON.parse(text) as TariffRule[];

            if (!Array.isArray(importedRules)) {
                addLog(t('toast.import.invalidFormat'), 'error');
                return;
            }

            const { errors: validationErrors, validRules } = validateImportedRules(importedRules);
            if (validationErrors.length > 0) {
                 // Log the errors but do not block the import of valid rules
                 addLog(t('toast.import.blocked').replace('{count}', String(validationErrors.length)), 'warning');
                 validationErrors.forEach((err, index) => {
                     addLog(t('toast.import.errorDetails').replace('{index}', String(index + 1)).replace('{error}', err), 'warning');
                 });
            }

            if (validRules.length === 0) {
                addLog(t('toast.import.invalidFormat'), 'error');
                return;
            }

            // Skip confirmation to avoid browser alert/confirm if validated
            validRules.sort((a, b) => a.priority - b.priority);
            const currentMaxPriority = state.rules.length > 0 ? Math.max(...state.rules.map(r => r.priority)) : 0;
            let nextPriority = currentMaxPriority + 1;

            // Dynamically register any imported materials and types in our metadata store
            const newMaterials = new Set<string>();
            const newTypes = new Set<string>();
            for (const r of validRules) {
                for (const c of r.conditions) {
                    const vals = Array.isArray(c.value) ? c.value : [c.value];
                    for (const v of vals) {
                        if (typeof v === 'string' && v) {
                            if (c.field === 'material') newMaterials.add(v);
                            if (c.field === 'type') newTypes.add(v);
                        }
                    }
                }
            }

            if (newMaterials.size > 0) {
                await dbService.addMetadata('materials', Array.from(newMaterials));
                const updatedMats = await dbService.getMetadata('materials');
                setAvailableMaterials(updatedMats);
            }
            if (newTypes.size > 0) {
                await dbService.addMetadata('types', Array.from(newTypes));
                const updatedTypes = await dbService.getMetadata('types');
                setAvailableTypes(updatedTypes);
            }

            for (const rule of validRules) {
                const newRule = {
                    ...rule,
                    id: crypto.randomUUID(), 
                    priority: nextPriority++ 
                };
                await dbService.addRule(newRule); 
            }
            
            const allRules = await dbService.getAllRules();
            dispatch({ type: 'SET_RULES', payload: allRules });

            // Invoiced jobs are not force-recalculated on import.
            const force = false;
            await recalculateWithRules(allRules, { force });

            addLog(t('toast.import.success').replace('{count}', String(validRules.length)), 'success');
            
        } catch (error) {
            console.error('Import error:', error);
            addLog(t('toast.import.error'), 'error', String(error));
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    /**
     * Removes an exclusion (by rule ID) from a specific job, optionally scoped to a single tooth.
     * Recalculates the job price after removal, persists, and dispatches the update.
     *
     * @param ruleId - The ID of the rule to remove from the exclusion list.
     * @param jobId - The ID of the job to modify.
     * @param toothId - Optional tooth ID (stable identifier); if provided, only that tooth's exclusion is removed.
     */
    const handleRemoveExclusionFromRule = async (ruleId: string, jobId: string, toothId?: string) => {
        const targetJob = jobState.jobs.find(j => j.id === jobId);
        if (!targetJob) return;

        let updatedJob: Job;

        if (toothId !== undefined) {
            const updatedTeeth = targetJob.teeth.map(t => {
                if (t.id === toothId) {
                    return {
                        ...t,
                        excludedRuleIds: (t.excludedRuleIds || []).filter(id => id !== ruleId)
                    };
                }
                return t;
            });
            updatedJob = {
                ...targetJob,
                teeth: updatedTeeth
            };
        } else {
            updatedJob = {
                ...targetJob,
                excludedRuleIds: (targetJob.excludedRuleIds || []).filter(id => id !== ruleId)
            };
        }

        const recalculatedJob = calculateJobPrice(updatedJob, state.rules);
        if (!recalculatedJob) return;

        await dbService.updateJob(recalculatedJob);
        jobDispatch({ type: 'UPDATE_JOB', payload: recalculatedJob });
        addLog(t('toast.job.updated').replace('{id}', targetJob.id), 'success');
    };

    /**
     * Collects all unmatched (pending) units across non-discarded jobs.
     * Each unit pairs a job with a tooth that has a status of "Pending".
     */
    const unmatchedUnits = useMemo(() => {
        const units: { job: Job, tooth: { material: string, type: string } }[] = [];
        
        jobState.jobs.forEach(job => {
            if (job.status === 'Discarded') return;
            
            job.teeth.forEach(tooth => {
                if (tooth.status === 'Pending') {
                    units.push({ job, tooth });
                }
            });
        });
        
        return units;
    }, [jobState.jobs]);

    return {
        isEditing,
        editingRule,
        editingJob,
        availableMaterials,
        availableTypes,
        selectedRuleIds,
        fileInputRef,
        availableDoctors,
        availablePatients,
        hiddenMaterials,
        hiddenTypes,
        hiddenDoctors,
        hiddenPatients,
        unmatchedUnits,
        jobs: jobState.jobs,
        rules: state.rules,
        handleSelectAllRules,
        handleSelectOneRule,
        handleDeleteSelectedRules,
        handleCreate,
        handleEdit,
        handleDragEnd,
        handleMoveUp,
        handleMoveDown,
        handleRecalculate,
        handleDelete,
        handleSave,
        handleDuplicate,
        handleExport,
        handleImportClick,
        handleUseAsTemplate,
        handleUpdateJob,
        handleFileChange,
        handleRemoveExclusionFromRule,
        refreshAttributeLists,
        recalculatePreview,
        setIsEditing,
        setEditingRule,
        setEditingJob,
        confirmDialog
    };
};
