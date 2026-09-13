/**
 * @file TariffEditor.tsx
 * Page component for managing tariff (pricing) rules.
 * Provides a full editor view with search, filtering, CRUD operations,
 * drag-and-drop reordering, import/export, and job unmatched-unit handling.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Box, Paper, Dialog } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { RuleEditor } from '../../components/RuleEditor';
import { JobEditModal } from '../../components/JobEditModal/JobEditModal';
import { TariffEditorHeader } from '../../components/TariffEditorHeader';
import { RuleList } from '../../components/RuleList';
import { UnmatchedUnits } from '../../components/UnmatchedUnits';
import { useTariffEditor } from '../../hooks/useTariffEditor';
import type { TariffRule, TariffRuleKind, Tooth } from '../../types';
import './TariffEditor.css';

/**
 * Checks whether a given tariff rule matches a search term.
 * The search is case-insensitive and checks the rule's name, label,
 * and all condition fields, operators, and values.
 * @param r - The tariff rule to test.
 * @param lower - The search term in lower case.
 * @returns `true` if the rule matches the search term, `false` otherwise.
 */
const ruleMatchesSearch = (r: TariffRule, lower: string): boolean => {
    if (r.name.toLowerCase().includes(lower)) return true;
    if (r.label && r.label.toLowerCase().includes(lower)) return true;
    
    for (const c of r.conditions) {
        if (c.field.toLowerCase().includes(lower)) return true;
        if (c.operator.toLowerCase().includes(lower)) return true;
        
        if (Array.isArray(c.value)) {
            if (c.value.some(v => String(v).toLowerCase().includes(lower))) return true;
        } else if (String(c.value).toLowerCase().includes(lower)) {
            return true;
        }
    }
    return false;
};

/**
 * Main page component for the tariff (pricing) rule editor.
 *
 * Integrates the rule list, inline rule editor, job editing modal,
 * unmatched-units panel, and import/export functionality.
 *
 * Handles navigation state to pre-select a rule for editing or to
 * create a new rule from a template (material/type/doctor/patient).
 *
 * @remarks The component delegates most state and business logic to the
 * {@link useTariffEditor} hook. Search filtering of rules is managed
 * locally via `useState` and `useMemo`.
 */
export const TariffEditorPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    const {
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
        jobs,
        rules,
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
    } = useTariffEditor();

    const [searchTerm, setSearchTerm] = useState('');
    const [activeJobData, setActiveJobData] = useState<{
        teeth: Tooth[];
        doctorName: string;
        patientName: string;
    } | null>(null);
    /**
     * `true` while the preview recalculation triggered by a dropdown close
     * (or value change) is in flight. Used to dim the page background and
     * surface a loading state on the `ApplicationList` panel inside the
     * rule editor modal. No debounce — the trigger is a discrete event.
     */
    const [isRecalculating, setIsRecalculating] = useState(false);

    const handleCloseEditor = () => {
        setIsEditing(false);
        setEditingRule(null);
        setActiveJobData(null);
    };

    /**
     * Tracks the last rule kind that was actually recalculated, so that
     * cheap kinds (`ignoreUnit`, `unitExtra`) don't re-trigger when the
     * user changes an unrelated field without changing the kind.
     */
    const lastRecalcedKindRef = useRef<TariffRuleKind | undefined>(undefined);

    /**
     * Handler for `RuleEditor`'s `onFieldChange`. Fires immediately on
     * dropdown close / value change (no debounce — the trigger is already
     * a discrete event). Gating rules:
     *  - Brand-new rules (no id) skip the persist+recalc — the modal's
     *    local `activeApplications` is recomputed from form state directly.
     *  - For cheap kinds (`ignoreUnit`, `unitExtra`), skip if the kind has
     *    not changed since the last recalc.
     *
     *  Toggles `isRecalculating` around the awaited `recalculatePreview` so
     *  the page can dim and the `ApplicationList` can show a spinner.
     */
    const handleFieldChange = useCallback((_field: 'name' | 'label' | 'condition' | 'action' | 'ruleKind', rule: TariffRule) => {
        const kind: TariffRuleKind = rule.kind || 'base';
        const isCheapKind = kind === 'ignoreUnit' || kind === 'unitExtra';
        if (isCheapKind && lastRecalcedKindRef.current === kind) {
            return;
        }
        if (!rule.id) {
            // New rule: no persistence or recalc runs, so the loading state
            // must NOT be set. The modal recomputes `activeApplications`
            // from local form state directly.
            lastRecalcedKindRef.current = kind;
            return;
        }
        setIsRecalculating(true);
        recalculatePreview(rule).finally(() => {
            setIsRecalculating(false);
            lastRecalcedKindRef.current = kind;
        });
    }, [recalculatePreview]);

    // Handle navigation state to edit or create a specific rule
    useEffect(() => {
        if (location.state) {
            const state = location.state as { 
                editRuleId?: string; 
                templateMaterial?: string; 
                templateType?: string; 
                doctorName?: string;
                patientName?: string;
                jobTeeth?: Tooth[];
            };
            
            if (state.jobTeeth || state.doctorName || state.patientName) {
                setActiveJobData({
                    teeth: state.jobTeeth || [],
                    doctorName: state.doctorName || '',
                    patientName: state.patientName || ''
                });
            }
            
            if (state.editRuleId) {
                const ruleId = state.editRuleId;
                const ruleToEdit = rules.find(r => r.id === ruleId);
                if (ruleToEdit) {
                    handleEdit(ruleToEdit);
                }
                navigate(location.pathname, { replace: true, state: null });
            } else if (state.templateMaterial || state.templateType) {
                handleUseAsTemplate(
                    state.templateMaterial || '',
                    state.templateType || '',
                    state.doctorName || '',
                    state.patientName || ''
                );
                navigate(location.pathname, { replace: true, state: null });
            }
        }
    }, [location.state, rules, handleEdit, handleUseAsTemplate, navigate, location.pathname]);

    const filteredRules = useMemo(() => {
        if (!searchTerm) return rules;
        const lower = searchTerm.toLowerCase();
        return rules.filter(r => ruleMatchesSearch(r, lower));
    }, [rules, searchTerm]);

    return (
        <Box className="tariff-editor-container">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden-file-input"
                accept=".json" 
                onChange={handleFileChange} 
            />
            <Paper variant="outlined" className="tariff-editor-paper" sx={{ position: 'relative' }}>
                <TariffEditorHeader
                    jobs={jobs}
                    isEditing={false}
                    onRecalculate={handleRecalculate}
                    onImportClick={handleImportClick}
                    onExport={handleExport}
                    onCreate={handleCreate}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    isRecalculating={isRecalculating}
                />
                
                <Box className="rule-editor-wrapper">
                    <RuleList
                        rules={filteredRules}
                        selectedRuleIds={selectedRuleIds}
                        onSelectAllRules={handleSelectAllRules}
                        onSelectOneRule={handleSelectOneRule}
                        onDeleteSelectedRules={handleDeleteSelectedRules}
                        onDragEnd={handleDragEnd}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onDuplicate={(rule) => handleDuplicate(rule, false)}
                        jobs={jobs}
                        isRecalculating={isRecalculating}
                    />
                </Box>
            </Paper>

            <Dialog
                open={isEditing}
                onClose={handleCloseEditor}
                maxWidth="xl"
                fullWidth
                PaperProps={{ variant: 'outlined', elevation: 0 }}
            >
                {isEditing && (
                    <RuleEditor
                        initialRule={editingRule}
                        onSave={handleSave}
                        onCancel={handleCloseEditor}
                        onDuplicate={(rule) => handleDuplicate(rule, true)}
                        jobs={jobs}
                        activeJob={activeJobData}
                        onRemoveExclusion={handleRemoveExclusionFromRule}
                        metadata={{
                            materials: availableMaterials,
                            types: availableTypes,
                            doctors: availableDoctors,
                            patients: availablePatients
                        }}
                        hiddenMetadata={{
                            materials: hiddenMaterials,
                            types: hiddenTypes,
                            doctors: hiddenDoctors,
                            patients: hiddenPatients
                        }}
                        onFieldChange={handleFieldChange}
                        isRecalculating={isRecalculating}
                    />
                )}
            </Dialog>

            <UnmatchedUnits
                unmatchedUnits={unmatchedUnits}
                onUseAsTemplate={(material, type, doctorName, patientName, jobTeeth) => {
                    setActiveJobData({
                        teeth: jobTeeth,
                        doctorName,
                        patientName
                    });
                    handleUseAsTemplate(material, type, doctorName, patientName);
                }}
                onEditJob={setEditingJob}
            />

            <JobEditModal
                open={!!editingJob}
                job={editingJob}
                onClose={() => setEditingJob(null)}
                onSave={handleUpdateJob}
                isNew={false}
                materials={availableMaterials}
                types={availableTypes}
                onAttrListChange={refreshAttributeLists}
            />
            {confirmDialog}
        </Box>
    );
};
