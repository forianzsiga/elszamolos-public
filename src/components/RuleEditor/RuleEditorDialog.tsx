/**
 * @file RuleEditorDialog.tsx
 * @brief Reusable modal wrapper around the {@link RuleEditor} component.
 *
 * Owns the full editor surface state (open / rule / save / cancel / duplicate /
 * live preview recalc) by reusing the existing `useTariffEditor` hook. Lets
 * any caller — for example, the JobTeethTable's "jump to rule" affordance —
 * open the rule editor IN PLACE (as a modal overlay) without navigating to
 * the `/tariffs` page.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog } from '@mui/material';
import type { Tooth, TariffRule, TariffRuleKind } from '../../types';
import { useTariffEditor } from '../../hooks/useTariffEditor';
import { RuleEditor } from './RuleEditor';

/**
 * Props for the {@link RuleEditorDialog} component.
 */
export interface RuleEditorDialogProps {
    /** Whether the dialog is open. When `false` the rule editor is unmounted. */
    open: boolean;
    /**
     * ID of the rule to edit. When `null` (or unknown) the dialog stays
     * closed even if `open` is `true`. Setting this to a real rule id and
     * flipping `open` to `true` opens the editor for that rule.
     */
    ruleId: string | null;
    /** Fired when the user dismisses the dialog (close button, backdrop, cancel). */
    onClose: () => void;
    /**
     * Optional active-job context, used by the rule editor's
     * `ApplicationList` / `ExclusionList` to highlight the teeth of the
     * current job. When omitted the rule editor still works, it just
     * won't narrow its applied/excluded view to a specific job.
     */
    activeJob?: {
        teeth: Tooth[];
        doctorName: string;
        patientName: string;
    } | null;
}

/**
 * Modal dialog that hosts the rule editor. Self-contained: it pulls the
 * full rule-editor state and handlers from {@link useTariffEditor}, so the
 * caller only needs to provide which rule to open (`ruleId`) and a close
 * callback.
 *
 * @param props - {@link RuleEditorDialogProps}
 * @returns The rendered dialog.
 */
export const RuleEditorDialog = ({ open, ruleId, onClose, activeJob = null }: RuleEditorDialogProps) => {
    const {
        isEditing,
        editingRule,
        setIsEditing,
        setEditingRule,
        jobs,
        rules,
        availableMaterials,
        availableTypes,
        availableDoctors,
        availablePatients,
        hiddenMaterials,
        hiddenTypes,
        hiddenDoctors,
        hiddenPatients,
        handleSave,
        handleDuplicate,
        handleRemoveExclusionFromRule,
        recalculatePreview,
        handleEdit,
        confirmDialog
    } = useTariffEditor();

    /**
     * `true` while a preview recalculation triggered by `onFieldChange` is
     * in flight. Surfaced on the `ApplicationList` as a loading state.
     * Mirrors the same flag in `TariffEditor.tsx`.
     */
    const [isRecalculating, setIsRecalculating] = useState(false);

    /**
     * Tracks the last rule kind that was actually recalculated, so that
     * cheap kinds (`ignoreUnit`, `unitExtra`) don't re-trigger when the
     * user changes an unrelated field without changing the kind. Mirrors
     * the same ref in `TariffEditor.tsx`.
     */
    const lastRecalcedKindRef = useRef<TariffRuleKind | undefined>(undefined);

    /**
     * When `open` flips to `true` with a valid `ruleId`, look the rule up
     * in the hook's `rules` collection and seed the editor via
     * `handleEdit`. This is the in-place analogue of
     * `TariffEditor.tsx:184-189` which reads `state.editRuleId` from
     * navigation state and calls `handleEdit`.
     */
    useEffect(() => {
        if (!open || !ruleId) {
            return;
        }
        const ruleToEdit = rules.find((r) => r.id === ruleId);
        if (ruleToEdit) {
            handleEdit(ruleToEdit);
        }
    }, [open, ruleId, rules, handleEdit]);

    /**
     * Internal close handler. Resets the editor state in the hook and
     * fires the parent's `onClose`.
     */
    const handleClose = useCallback(() => {
        setIsEditing(false);
        setEditingRule(null);
        onClose();
    }, [onClose, setIsEditing, setEditingRule]);

    /**
     * Handler for `RuleEditor`'s `onFieldChange`. Mirrors the exact
     * gating + recalculation logic in `TariffEditor.tsx:144-162` so the
     * in-place dialog behaves identically to the page.
     */
    const handleFieldChange = useCallback((_field: 'name' | 'label' | 'condition' | 'action' | 'ruleKind', rule: TariffRule) => {
        const kind: TariffRuleKind = rule.kind || 'base';
        const isCheapKind = kind === 'ignoreUnit' || kind === 'unitExtra';
        if (isCheapKind && lastRecalcedKindRef.current === kind) {
            return;
        }
        if (!rule.id) {
            // Brand-new rule: nothing is persisted yet; the modal
            // recomputes `activeApplications` from local form state.
            lastRecalcedKindRef.current = kind;
            return;
        }
        setIsRecalculating(true);
        recalculatePreview(rule).finally(() => {
            setIsRecalculating(false);
            lastRecalcedKindRef.current = kind;
        });
    }, [recalculatePreview]);

    /**
     * `true` only when we have a loaded rule to render. The hook's
     * `isEditing` is also `true` for brand-new rules created via
     * `handleCreate`; we only render when we have an actual rule object.
     */
    const dialogOpen = open && isEditing && editingRule !== null;

    return (
        <>
            <Dialog
                open={dialogOpen}
                onClose={handleClose}
                maxWidth="xl"
                fullWidth
                PaperProps={{ variant: 'outlined', elevation: 0 }}
            >
                {dialogOpen && (
                    <RuleEditor
                        initialRule={editingRule}
                        onSave={async (rule) => {
                            await handleSave(rule);
                            onClose();
                        }}
                        onCancel={handleClose}
                        onDuplicate={(rule) => handleDuplicate(rule, true)}
                        jobs={jobs}
                        activeJob={activeJob}
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
            {confirmDialog}
        </>
    );
};
