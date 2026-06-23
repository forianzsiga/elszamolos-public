/** 
 * @file JobEditModal.tsx
 * @description Modal dialog component for viewing, editing, creating, and duplicating
 *              individual dental jobs. Provides form fields for job metadata, a teeth table
 *              for managing dental units, a dental chart visualizer, a 3D model viewer,
 *              and developer debug information.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import {
    Dialog, DialogTitle, DialogContent,
    TextField, Box, Typography,
    Paper,
    Accordion, AccordionSummary, AccordionDetails, Button,
    CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import type { Job, Tooth as OriginalTooth } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { dbService } from '../../services/db';
import { calculateJobPrice } from '../../services/pricingEngine';
import { useTariffs } from '../../context/TariffContext';
import { AutocompleteWithHide } from '../AutocompleteWithHide';
import JobEditModalActions from '../JobEditModalActions/JobEditModalActions';
import { JobTeethTable } from '../JobTeethTable';
import { TeethVisualizer } from '../TeethVisualizer';
import { generateJobHash } from '../../utils/hash';
import { scanAndParseFolder } from '../../services/fileScanner';
import { JobMetadataFooter } from '../JobMetadataFooter';
import i11n from './JobEditModal-i11n.json';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import './JobEditModal.css';

const ModelViewer3D = lazy(() => import('../ModelViewer3D').then(m => ({ default: m.ModelViewer3D })));

/** Represents a tooth entry with a temporary client-side identifier for tracking unsaved changes. */
type LocalTooth = OriginalTooth & { _tempId: string };
/** Partial job form state used during editing, where teeth may include temporary client-side identifiers (_tempId). */
type JobFormState = Omit<Partial<Job>, 'teeth'> & { teeth?: LocalTooth[] };
/** Keys on OriginalTooth that are replaced during tooth updates within the modal. */
type ToothUpdateFields = '_tempId' | 'price' | 'status' | 'appliedRule';
/** Tooth data submitted for create/edit operations, excluding fields managed internally by the modal. */
type ToothUpdate = Omit<OriginalTooth, ToothUpdateFields>;

/**
 * Toggles a rule ID in the given list — removes it if present, adds it if absent.
 */
const toggleExclusion = (ids: string[] | undefined, ruleId: string): string[] => {
    const list = ids || [];
    return list.includes(ruleId) ? list.filter(id => id !== ruleId) : [...list, ruleId];
};

/**
 * Applies a tooth-level rule exclusion toggle, updating the matching
 * tooth's `excludedRuleIds` in place. Returns the rebuilt teeth list and
 * whether the rule was previously excluded for the matching tooth.
 *
 * The previous design also inserted / removed a companion "new" tooth for
 * `ignoreUnit` exclusions; that pattern is removed — the original tooth is
 * kept in place and the engine prices it normally when the rule is
 * excluded for it.
 */
const applyToothExclusionToggle = (
    teeth: LocalTooth[],
    toothId: string,
    ruleId: string
): { teeth: LocalTooth[]; wasExcluded: boolean } => {
    let wasExcluded = false;
    const updatedTeeth = teeth.map((tooth) => {
        if (tooth.id !== toothId) return tooth;
        const wasAlreadyExcluded = (tooth.excludedRuleIds || []).includes(ruleId);
        const nextExcluded = toggleExclusion(tooth.excludedRuleIds, ruleId);
        if (wasAlreadyExcluded) {
            wasExcluded = true;
        }
        return { ...tooth, excludedRuleIds: nextExcluded };
    });
    return { teeth: updatedTeeth, wasExcluded };
};

// --- Helper Components ---

/** Props for the {@link JobFormFields} sub-component containing date, patient, and doctor fields. */
interface JobFormFieldsProps {
    localT: (key: keyof typeof i11n.en, params?: Record<string, string>) => string;
    formData: JobFormState;
    allPatients: string[];
    allDoctors: string[];
    handleChange: (field: keyof Job, value: string | number) => void;
    handleFinalizeField: (field: 'doctorName' | 'patientName', value: string) => void;
    onAttrListChange?: () => void;
}

/**
 * Renders the form row with date picker, patient autocomplete, and doctor autocomplete fields.
 *
 * @param localT - Localization function for translating i18n keys.
 * @param formData - Current job form state containing date, patient, and doctor fields.
 * @param allPatients - List of all known patient names for autocomplete suggestions.
 * @param allDoctors - List of all known doctor names for autocomplete suggestions.
 * @param handleChange - Callback to update a job form field value.
 * @param handleFinalizeField - Callback to finalize a doctor or patient name entry, triggering metadata validation.
 * @param onAttrListChange - Optional callback invoked when the user hides/restores a dropdown option.
 * @return The form fields JSX element.
 */
const JobFormFields = ({ localT, formData, allPatients, allDoctors, handleChange, handleFinalizeField, onAttrListChange }: JobFormFieldsProps) => (
    <Box className="job-edit-modal-row">
        <DatePicker
            label={localT('date')}
            value={formData.createdAt ? dayjs(formData.createdAt) : null}
            onChange={(newValue) => handleChange('createdAt', newValue ? newValue.toISOString() : '')}
            slotProps={{ textField: { fullWidth: true } }}
        />
        <AutocompleteWithHide
            category="patientName"
            freeSolo
            options={allPatients}
            value={formData.patientName || ''}
            onChange={(_, newValue) => {
                handleChange('patientName', newValue || '');
                handleFinalizeField('patientName', newValue || '');
            }}
            onInputChange={(_, newInputValue) => {
                handleChange('patientName', newInputValue);
            }}
            onHiddenChange={onAttrListChange}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={localT('patient')}
                    onBlur={(e) => handleFinalizeField('patientName', e.target.value)}
                />
            )}
            fullWidth
        />
        <AutocompleteWithHide
            category="doctorName"
            freeSolo
            options={allDoctors}
            value={formData.doctorName || ''}
            onChange={(_, newValue) => {
                handleChange('doctorName', newValue || '');
                handleFinalizeField('doctorName', newValue || '');
            }}
            onInputChange={(_, newInputValue) => {
                handleChange('doctorName', newInputValue);
            }}
            onHiddenChange={onAttrListChange}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={localT('doctor')}
                    onBlur={(e) => handleFinalizeField('doctorName', e.target.value)}
                />
            )}
            fullWidth
        />
    </Box>
);

/** Props for the {@link TeethSection} sub-component containing the teeth table and visualizer. */
interface TeethSectionProps {
    formData: JobFormState;
    hoveredTooth: string | null;
    setHoveredTooth: (id: string | null) => void;
    hoveredRowId: string | null;
    setHoveredRowId: (id: string | null) => void;
    setFormData: React.Dispatch<React.SetStateAction<JobFormState>>;
    handleEditTooth: (editingUnit: OriginalTooth, updatedUnit: ToothUpdate) => Promise<void>;
    handleDuplicateTooth: (tooth: OriginalTooth) => void;
    handleAddTooth: (newUnit: ToothUpdate) => Promise<void>;
    allMaterials: string[];
     allTypes: string[];
     localT: (key: keyof typeof i11n.en, params?: Record<string, string>) => string;
     onExcludeFromRule?: (ruleId: string, projectId: string, toothId?: string) => void;
     onAttrListChange?: () => void;
}

/**
 * Renders the teeth table alongside the dental chart visualizer.
 *
 * @param formData - Current job form state containing the teeth list and job metadata.
 * @param hoveredTooth - ID of the currently hovered tooth for cross-highlighting, or null.
 * @param setHoveredTooth - Setter to update the currently hovered tooth ID.
 * @param hoveredRowId - ID of the currently hovered table row, or null.
 * @param setHoveredRowId - Setter to update the currently hovered table row ID.
 * @param setFormData - State setter for updating the job form state.
 * @param handleEditTooth - Callback to edit an existing tooth with updated fields.
 * @param handleDuplicateTooth - Callback to duplicate an existing tooth entry.
 * @param handleAddTooth - Callback to add a new tooth entry to the form.
 * @param allMaterials - List of all known material names for tooth configuration.
 * @param allTypes - List of all known tooth type names for tooth configuration.
 * @param localT - Localization function for translating i18n keys.
 * @param onExcludeFromRule - Optional callback to toggle rule exclusion for a specific tooth or job.
 * @return The teeth section JSX element.
 */
const TeethSection = ({
    formData,
    hoveredTooth,
    setHoveredTooth,
    hoveredRowId,
    setHoveredRowId,
    setFormData,
    handleEditTooth,
    handleDuplicateTooth,
     handleAddTooth,
     allMaterials,
     allTypes,
     localT,
     onExcludeFromRule,
     onAttrListChange
}: TeethSectionProps) => (
    <Box className="job-edit-modal-row-stretch">
        <Box className="teeth-table-container">
            <Paper variant="outlined" className="teeth-table-paper">
                <Box className="teeth-table-wrapper">
                    <JobTeethTable 
                        teeth={formData.teeth as OriginalTooth[] || []} 
                        notes={formData.notes}
                        hoveredTooth={hoveredTooth}
                        onHoverTooth={setHoveredTooth}
                        hoveredRowId={hoveredRowId}
                        onHoverRowId={setHoveredRowId}
                        jobExtraRules={formData.appliedJobRules}
                        fullHeight={true}
                        jobId={formData.id}
                        onDeleteTeeth={(teethToDelete) => {
                            setFormData((prev: JobFormState) => {
                                const currentTeeth = prev.teeth || [];
                                const deleteTempIds = new Set(teethToDelete.map(t => (t as LocalTooth)._tempId || t.id).filter(Boolean));
                                const deleteNumbers = new Set(teethToDelete.filter(t => !(t as LocalTooth)._tempId && !t.id).map(t => t.number));
                                const newTeeth = currentTeeth.filter(t => {
                                    const tid = t._tempId || t.id;
                                    if (tid) return !deleteTempIds.has(tid);
                                    return !deleteNumbers.has(t.number);
                                });
                                return {
                                    ...prev,
                                    teeth: newTeeth,
                                    unitCount: newTeeth.length
                                };
                            });
                        }}
                        onEditTeeth={handleEditTooth}
                        onDuplicateTeeth={handleDuplicateTooth}
                        onAddUnit={handleAddTooth}
                        materials={allMaterials}
                        types={allTypes}
                        doctorName={formData.doctorName}
                        patientName={formData.patientName}
                        onExcludeFromRule={onExcludeFromRule}
                        projectId={formData.projectId}
                        onAttrListChange={onAttrListChange}
                    />
                </Box>
            </Paper>
        </Box>

        <Box className="visualizer-container">
            <Typography variant="h6" gutterBottom component="div" align="center" className="visualizer-title">
                {localT('chart')}
            </Typography>
            <TeethVisualizer 
                teeth={formData.teeth as OriginalTooth[] || []} 
                hoveredTooth={hoveredTooth}
                onHoverTooth={setHoveredTooth}
            />
        </Box>
    </Box>
);

/** Props for the {@link ViewerSection} sub-component containing the 3D model viewer accordion. */
interface ViewerSectionProps {
    localT: (key: keyof typeof i11n.en, params?: Record<string, string>) => string;
    is3DExpanded: boolean;
    setIs3DExpanded: (expanded: boolean) => void;
    stlUnits: LocalTooth[];
    formData: JobFormState;
    activeSuffixIndex: number;
    setActiveSuffixIndex: (index: number) => void;
    handleLoadLocalFiles: () => Promise<void>;
}

/**
 * Renders an accordion section containing the 3D model viewer or an empty state with a load button.
 *
 * @param localT - Localization function for translating i18n keys.
 * @param is3DExpanded - Whether the 3D viewer accordion is currently expanded.
 * @param setIs3DExpanded - Setter to toggle the expanded state of the 3D viewer accordion.
 * @param stlUnits - List of teeth entries representing linked STL 3D model files.
 * @param formData - Current job form state containing the file name and teeth data.
 * @param activeSuffixIndex - Index of the currently active STL suffix/material in the viewer.
 * @param setActiveSuffixIndex - Setter to update the active STL suffix index.
 * @param handleLoadLocalFiles - Callback to scan and load local STL files into the job.
 * @return The viewer section JSX element.
 */
const ViewerSection = ({ 
    localT, 
    is3DExpanded, 
    setIs3DExpanded, 
    stlUnits, 
    formData, 
    activeSuffixIndex, 
    setActiveSuffixIndex, 
    handleLoadLocalFiles 
}: ViewerSectionProps) => (
    <Accordion 
        expanded={is3DExpanded} 
        onChange={(_, expanded) => setIs3DExpanded(expanded)}
        variant="outlined" 
        className="accordion-container"
    >
        <ResponsiveTooltip title={localT('viewerTitleTooltip')}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="bold">{localT('viewerTitle')}</Typography>
            </AccordionSummary>
        </ResponsiveTooltip>
        <AccordionDetails>
            {stlUnits.length > 0 ? (
                <Suspense fallback={
                    <Box className="viewer-loading-box">
                        <CircularProgress size={28} />
                        <Typography variant="body2" color="text.secondary">{localT('viewerLoading')}</Typography>
                    </Box>
                }>
                    <ModelViewer3D
                        fileName={formData.fileName || ''}
                        modelSuffixes={stlUnits.map((u) => u.material)}
                        activeSuffixIndex={activeSuffixIndex}
                        onChangeSuffixIndex={setActiveSuffixIndex}
                        jobId={formData.id}
                    />

                </Suspense>
            ) : (
                <Box className="viewer-empty-box">
                    <Typography variant="body1" color="text.secondary">
                        {localT('viewerEmpty')}
                    </Typography>
                    <ResponsiveTooltip title={localT('viewerLoadButtonTooltip')}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleLoadLocalFiles}
                        >
                            {localT('viewerLoadButton')}
                        </Button>
                    </ResponsiveTooltip>
                </Box>
            )}
        </AccordionDetails>
    </Accordion>
);

/** Props for the {@link DebugSection} sub-component that displays developer information. */
interface DebugSectionProps {
    isDeveloperMode?: boolean;
    localT: (key: keyof typeof i11n.en, params?: Record<string, string>) => string;
    allMaterials: string[];
    allTypes: string[];
}

/**
 * Renders developer debug information, showing all known materials and types.
 *
 * @param isDeveloperMode - Whether developer mode is enabled; the section renders nothing when false.
 * @param localT - Localization function for translating i18n keys.
 * @param allMaterials - List of all known material names to display.
 * @param allTypes - List of all known tooth type names to display.
 * @return The debug section JSX element, or null if developer mode is disabled.
 */
const DebugSection = ({ isDeveloperMode, localT, allMaterials, allTypes }: DebugSectionProps) => (
    isDeveloperMode && (
        <Box className="debug-box">
            <Typography variant="subtitle2" color="text.secondary">{localT('debugTitle')}</Typography>
            <Box display="flex" gap={4} mt={1}>
                <Box>
                    <Typography variant="caption" fontWeight="bold">{localT('debugMaterials')} ({allMaterials.length}):</Typography>
                    <Typography variant="caption" display="block" className="monospace-text">
                        {allMaterials.join(', ')}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="caption" fontWeight="bold">{localT('debugTypes')} ({allTypes.length}):</Typography>
                    <Typography variant="caption" display="block" className="monospace-text">
                        {allTypes.join(', ')}
                    </Typography>
                </Box>
            </Box>
        </Box>
    )
);

// --- Main Component ---

/** Props for the {@link JobEditModal} component. */
interface JobEditModalProps {
    open: boolean;
    job: Job | null;
    onClose: () => void;
    onSave: (updatedJob: Job) => void;
    onDelete?: (id: string) => void;
    isNew?: boolean;
    materials: string[];
    types: string[];
    doctors?: string[];
    patients?: string[];
    isDeveloperMode?: boolean;
    onMetadataChange?: (type: 'materials' | 'types' | 'doctors' | 'patients', value: string) => void;
    onExcludeFromRule?: (ruleId: string, projectId: string, toothId?: string) => void;
    /**
     * Optional callback invoked when the user hides/restores a dropdown
     * option in any of the autocomplete fields. The parent should re-fetch
     * its metadata lists so that the partition is consistent elsewhere.
     */
    onAttrListChange?: () => void;
}

/**
 * Modal dialog for creating, editing, or duplicating a dental job.
 *
 * Provides form fields for job metadata (date, patient, doctor), a teeth table for managing
 * dental units, a dental chart visualizer, a 3D model viewer section, a notes field, and
 * optional developer debug information. Manages temporary client-side identifiers for teeth
 * and validates new metadata entries (materials, types, doctors, patients) before persisting them.
 *
 * @param open - Whether the modal is open.
 * @param job - The active job being edited or viewed.
 * @param onClose - Callback function triggered when closing the modal.
 * @param onSave - Callback function triggered when saving the job changes.
 * @param onDelete - Optional callback function triggered when deleting the job.
 * @param isNew - Optional flag specifying if the job is newly created.
 * @param materials - List of available materials.
 * @param types - List of available tooth types.
 * @param doctors - List of available doctors.
 * @param patients - List of available patients.
 * @param isDeveloperMode - Flag to toggle developer debug information display.
 * @param onMetadataChange - Optional callback function when metadata changes are verified.
 * @return The modal dialog JSX element, or null if no job is provided.
 */
export const JobEditModal = ({
    onAttrListChange,

    open, 
    job, 
    onClose, 
    onSave,
    onDelete,
    isNew,
    materials,
    types,
    doctors = [],
    patients = [],
    isDeveloperMode = false,
    onMetadataChange
}: JobEditModalProps) => {
    const { language } = useLanguage();
    const { state: tariffState } = useTariffs();
    /**
     * Translates a localization key from the i18n JSON using the active language,
     * optionally interpolating parameterized values.
     *
     * @param key - The key of the translation text.
     * @param params - Optional key-value pairs for string interpolation.
     * @return The translated and interpolated string.
     */
    const localT = useCallback((key: keyof typeof i11n.en, params?: Record<string, string>) => {
        let text = (i11n[language as 'en' | 'hu'] || i11n['en'])[key] || key;
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, v);
            });
        }
        return text;
    }, [language]);
    const [formData, setFormData] = useState<JobFormState>({});
    const [newMaterials, setNewMaterials] = useState<string[]>([]);
    const [newTypes, setNewTypes] = useState<string[]>([]);
    const [newDoctors, setNewDoctors] = useState<string[]>([]);
    const [newPatients, setNewPatients] = useState<string[]>([]);
    const isConfirmingRef = useRef(false);
    const [hoveredTooth, setHoveredTooth] = useState<string | null>(null);
    const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
    const [is3DExpanded, setIs3DExpanded] = useState(false);
    const [activeSuffixIndex, setActiveSuffixIndex] = useState(0);

    const isModified = useMemo(() => {
        if (!job) return false;
        const currentJob = { ...job, ...formData, teeth: formData.teeth?.map((t) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { _tempId, ...rest } = t;
            return rest;
        }) } as Job;
        return !!job.originalHash && generateJobHash(currentJob) !== job.originalHash;
    }, [job, formData]);

    const isDuplicate = useMemo(() => {
        return job?.status === ('Duplicate' as unknown);
    }, [job]);

    useEffect(() => {
        if (job) {
            const teethWithIds = job.teeth.map((tooth, index) => ({
                ...tooth,
                _tempId: `${Date.now()}-${index}`
            }));
            const formDataWithTempIds: JobFormState = {
                ...job,
                teeth: teethWithIds
            };
            setFormData(formDataWithTempIds);
            setNewMaterials([]);
            setNewTypes([]);
            setNewDoctors([]);
            setNewPatients([]);
        }
    }, [job]);

    /**
     * Updates a single field in the job form state.
     *
     * @param field - The job property key to update.
     * @param value - The new value to assign to the field.
     */
    const handleChange = (field: keyof Job, value: string | number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    /**
     * General-purpose metadata validator that verifies if a given value is already known,
     * and if not, prompts the user to confirm adding it as new metadata.
     *
     * @param value - The metadata value to validate.
     * @param field - The target metadata collection ('materials' or 'types').
     * @param knownValues - List of already registered values.
     * @param newValues - List of newly added values in the current session.
     * @param setNewValues - State setter to update the list of newly added values.
     * @param confirmKey - Localization translation key for the confirmation dialog.
     * @param alertKey - Localization translation key for the success alert dialog.
     * @return A Promise resolving to true if the value is known/confirmed, or false if rejected.
     */
    const validateMetadata = useCallback(async (
        value: string | undefined,
        field: 'materials' | 'types',
        knownValues: string[],
        newValues: string[],
        setNewValues: React.Dispatch<React.SetStateAction<string[]>>,
        confirmKey: keyof typeof i11n.en,
        alertKey: keyof typeof i11n.en
    ) => {
        if (!value || value.trim() === '') return true;
        const val = value.trim();
        const isKnown = knownValues.includes(val) || newValues.includes(val);
        if (!isKnown) {
            const confirmed = window.confirm(localT(confirmKey, { value: val }));
            if (confirmed) {
                setNewValues(current => [...current, val]);
                await dbService.addMetadata(field, [val]);
                onMetadataChange?.(field, val);
                window.alert(localT(alertKey, { value: val }));
                return true;
            } else {
                return false;
            }
        }
        return true;
    }, [localT, onMetadataChange]);

    /**
     * Adds a new tooth entry to the form, validates any new material or type metadata,
     * and recalculates the job price.
     *
     * @param newUnit - The tooth data for the new entry, excluding internal fields managed by the modal.
     */
    const handleAddTooth = async (newUnit: ToothUpdate) => {
        const { material, type } = newUnit;

        if (!(await validateMetadata(material, 'materials', materials, newMaterials, setNewMaterials, 'confirmNewMaterial', 'alertNewMaterial'))) return;
        if (!(await validateMetadata(type, 'types', types, newTypes, setNewTypes, 'confirmNewType', 'alertNewType'))) return;

        setFormData((prev: JobFormState) => {
            const currentTeeth = prev.teeth || [];
            const newTooth: LocalTooth = {
                ...newUnit,
                id: crypto.randomUUID(),
                _tempId: `${Date.now()}-new`,
            };
            const newTeethList = [...currentTeeth, newTooth];
            const updatedJob = {
                ...prev,
                teeth: newTeethList,
                unitCount: newTeethList.length
            };
            const recalculatedJob = calculateJobPrice(updatedJob as Job, tariffState.rules);
            if (recalculatedJob) {
                return { ...updatedJob, ...recalculatedJob, teeth: recalculatedJob.teeth as LocalTooth[] };
            }
            return updatedJob;
        });
    };

    /**
     * Edits an existing tooth entry by matching it via temp ID, persistent ID, or tooth number,
     * validates any new material or type metadata, and recalculates the job price.
     *
     * @param editingUnit - The original tooth entry to be edited.
     * @param updatedUnit - The updated tooth fields to apply.
     */
    const handleEditTooth = async (editingUnit: OriginalTooth, updatedUnit: ToothUpdate) => {
        const { material, type } = updatedUnit;

        if (!(await validateMetadata(material, 'materials', materials, newMaterials, setNewMaterials, 'confirmNewMaterial', 'alertNewMaterial'))) return;
        if (!(await validateMetadata(type, 'types', types, newTypes, setNewTypes, 'confirmNewType', 'alertNewType'))) return;

        setFormData((prev: JobFormState) => {
            if (!prev.teeth) return prev;
            const targetTempId = (editingUnit as LocalTooth)._tempId;
            const targetId = editingUnit.id;
            const newTeeth = prev.teeth.map(tooth => {
                if (targetTempId && tooth._tempId === targetTempId) {
                    return { ...tooth, ...updatedUnit };
                }
                if (targetId && tooth.id === targetId) {
                    return { ...tooth, ...updatedUnit };
                }
                if (!targetTempId && !targetId && tooth.number === editingUnit.number) {
                    return { ...tooth, ...updatedUnit };
                }
                return tooth;
            });
            const updatedJob = { ...prev, teeth: newTeeth };
            const recalculatedJob = calculateJobPrice(updatedJob as Job, tariffState.rules);
            if (recalculatedJob) {
                return { ...updatedJob, ...recalculatedJob, teeth: recalculatedJob.teeth as LocalTooth[] };
            }
            return updatedJob;
        });
    };

    /**
     * Duplicates an existing tooth entry with a new unique ID and temp ID,
     * appends it to the teeth list, and recalculates the job price.
     *
     * @param tooth - The tooth entry to duplicate.
     */
    const handleDuplicateTooth = (tooth: OriginalTooth) => {
        setFormData((prev: JobFormState) => {
            const currentTeeth = prev.teeth || [];
            const duplicated: LocalTooth = {
                ...tooth,
                id: crypto.randomUUID(),
                _tempId: `${Date.now()}-dup`,
            };
            const newTeethList = [...currentTeeth, duplicated];
            const updatedJob = {
                ...prev,
                teeth: newTeethList,
                unitCount: newTeethList.length
            };
            const recalculatedJob = calculateJobPrice(updatedJob as Job, tariffState.rules);
            if (recalculatedJob) {
                return { ...updatedJob, ...recalculatedJob, teeth: recalculatedJob.teeth as LocalTooth[] };
            }
            return updatedJob;
        });
    };

    /**
     * Scans the local file system for STL files matching the current job prefix
     * and links any unlinked 3D model entries into the teeth list.
     */
    const handleLoadLocalFiles = async () => {
        try {
            await scanAndParseFolder([]);
            const projectPrefix = (job?.fileName || '').toLowerCase().replace('.dentalproject', '');
            const registry = window.localFileHandles || {};
            
            const matchingKeys = Object.keys(registry).filter(key => {
                const k = key.toLowerCase();
                return k.startsWith(projectPrefix + '-') && k.endsWith('.stl');
            });

            if (matchingKeys.length === 0) {
                window.alert(localT('alertNoStl'));
                return;
            }

            setFormData((prev: JobFormState) => {
                const currentTeeth = [...(prev.teeth || [])];
                for (const key of matchingKeys) {
                    const suffix = key.slice(projectPrefix.length + 1, -4);
                    const exists = currentTeeth.some(t => t.number === 0 && t.type === '3D Model' && t.material === suffix);
                    if (!exists) {
                        currentTeeth.push({
                            id: crypto.randomUUID(),
                            number: 0,
                            type: '3D Model',
                            material: suffix,
                            status: 'Calculated',
                            price: 0
                        } as LocalTooth);
                    }
                }
                return {
                    ...prev,
                    teeth: currentTeeth,
                    unitCount: currentTeeth.length
                };
            });

            // Save to IndexedDB assets store!
            for (const key of matchingKeys) {
                const suffix = key.slice(projectPrefix.length + 1, -4);
                const fileHandle = registry[key] as FileSystemFileHandle | File;
                if (!fileHandle) continue;
                try {
                    const fileObj = 'getFile' in fileHandle ? await fileHandle.getFile() : fileHandle;
                    const assetId = `${job?.id}-${suffix}`;
                    const existingAssets = await dbService.getAssetsByJob(job?.id || '');
                    if (!existingAssets.some(a => a.fileName === key)) {
                        await dbService.addAsset({
                            id: assetId,
                            jobId: job?.id || '',
                            fileName: key,
                            mimeType: 'model/stl',
                            size: fileObj.size
                        }, fileObj);
                        console.log(`Saved asset ${key} to IndexedDB for job ${job?.id}`);
                    }
                } catch (err) {
                    console.error(`Failed to save asset ${key} to IndexedDB:`, err);
                }
            }
            
            window.alert(localT('alertStlLinked', { count: matchingKeys.length.toString() }));
        } catch (e) {
            console.error("Error loading local files:", e);
        }
    };

    const stlUnits = useMemo(() => {
        return (formData.teeth || []).filter(t => t.number === 0 && t.type === '3D Model' && !t.isIgnored);
    }, [formData.teeth]);

    useEffect(() => {
        if (activeSuffixIndex >= stlUnits.length) {
            setActiveSuffixIndex(Math.max(0, stlUnits.length - 1));
        }
    }, [stlUnits.length, activeSuffixIndex]);


    /**
     * Toggles a pricing rule exclusion for a specific tooth or the entire job.
     * Instantly triggers job price recalculation for the draft.
     *
     * The companion-tooth pattern is gone: the matching tooth's
     * `excludedRuleIds` is updated in place, and the engine handles the
     * visible/hidden state via the `ignoreUnit` rule evaluation pass.
     *
     * @param ruleId - The unique identifier of the pricing rule to toggle.
     * @param _projectId - The project identifier (unused, included for interface matching).
     * @param toothId - Optional identifier of a specific tooth. If omitted, toggles exclusion for the entire job.
     */
    const handleExcludeFromRule = useCallback((ruleId: string, _projectId: string, toothId?: string) => {
        setFormData((prev: JobFormState) => {
            let updatedJob: JobFormState;
            if (toothId !== undefined) {
                const { teeth: updatedTeeth } = applyToothExclusionToggle(
                    prev.teeth || [],
                    toothId,
                    ruleId
                );
                updatedJob = { ...prev, teeth: updatedTeeth };
            } else {
                updatedJob = {
                    ...prev,
                    excludedRuleIds: toggleExclusion(prev.excludedRuleIds, ruleId)
                };
            }

            // Recalculate price instantly for the draft!
            const recalculatedJob = calculateJobPrice(updatedJob as Job, tariffState.rules);
            if (recalculatedJob) {
                return { ...updatedJob, ...recalculatedJob, teeth: recalculatedJob.teeth as LocalTooth[] };
            }
            return updatedJob;
        });
    }, [tariffState.rules]);

    /**
     * Saves the current job form changes, strips client-side temporary identifiers,
     * triggers the onSave callback, and closes the modal.
     */
    const handleSave = () => {
        if (job && formData) {
            const teethToSave = formData.teeth?.map((t) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { _tempId, ...rest } = t;
                return rest;
            });
            const jobToSave: Job = { ...job, ...formData, teeth: teethToSave } as Job;
            onSave(jobToSave);
            onClose();
        }
    };

    /**
     * Deletes the current job by triggering the onDelete callback and closing the modal.
     */
    const handleDelete = () => {
        if (job && onDelete) {
            onDelete(job.id);
            onClose();
        }
    };

    const allMaterials = useMemo(() => Array.from(new Set([...materials, ...newMaterials])).sort(), [materials, newMaterials]);
    const allTypes = useMemo(() => Array.from(new Set([...types, ...newTypes])).sort(), [types, newTypes]);
    const allDoctors = useMemo(() => Array.from(new Set([...doctors, ...newDoctors])).sort(), [doctors, newDoctors]);
    const allPatients = useMemo(() => Array.from(new Set([...patients, ...newPatients])).sort(), [patients, newPatients]);

    /**
     * Callback to handle metadata validation and auto-saving for doctor or patient names.
     * Prompt-confirms new, unseen metadata values before committing them to indexedDB.
     *
     * @param field - The name of the field to finalize ('doctorName' or 'patientName').
     * @param value - The input value to validate and finalize.
     */
    const handleFinalizeField = useCallback(async (field: 'doctorName' | 'patientName', value: string) => {
        const val = value.trim();
        if (!val || isConfirmingRef.current) return;

        if (field === 'doctorName') {
            const isKnown = allDoctors.includes(val);
            if (!isKnown) {
                isConfirmingRef.current = true;
                const confirmed = window.confirm(localT('confirmNewDoctor', { value: val }));
                isConfirmingRef.current = false;
                if (confirmed) {
                    setNewDoctors(current => [...current, val]);
                    await dbService.addMetadata('doctors', [val]);
                    onMetadataChange?.('doctors', val);
                } else {
                    handleChange('doctorName', '');
                }
            }
        } else if (field === 'patientName') {
            const isKnown = allPatients.includes(val);
            if (!isKnown) {
                isConfirmingRef.current = true;
                const confirmed = window.confirm(localT('confirmNewPatient', { value: val }));
                isConfirmingRef.current = false;
                if (confirmed) {
                    setNewPatients(current => [...current, val]);
                    await dbService.addMetadata('patients', [val]);
                    onMetadataChange?.('patients', val);
                } else {
                    handleChange('patientName', '');
                }
            }
        }
    }, [allDoctors, allPatients, localT, onMetadataChange]);



    if (!job) return null;
    const isNewManual = isNew !== undefined ? isNew : (job.status === 'Manual' && !onDelete);

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="xl" 
            fullWidth
            PaperProps={{ variant: 'outlined', elevation: 0 }}
        >
            <DialogTitle>{isNewManual ? localT('manualTitle') : localT('editTitle')}</DialogTitle>
            <DialogContent>
                <Box className="job-edit-modal-content">
                    <JobFormFields
                        localT={localT}
                        formData={formData}
                        allPatients={allPatients}
                        allDoctors={allDoctors}
                        handleChange={handleChange}
                        handleFinalizeField={handleFinalizeField}
                        onAttrListChange={onAttrListChange}
                    />
                    
                    <TeethSection 
                        formData={formData} 
                        hoveredTooth={hoveredTooth} 
                        setHoveredTooth={setHoveredTooth}
                        hoveredRowId={hoveredRowId}
                        setHoveredRowId={setHoveredRowId}
                        setFormData={setFormData}
                        handleEditTooth={handleEditTooth}
                        handleDuplicateTooth={handleDuplicateTooth}
                        handleAddTooth={handleAddTooth}
                        allMaterials={allMaterials}
                        allTypes={allTypes}
                        localT={localT}
                        onExcludeFromRule={handleExcludeFromRule}
                    />

                    <ViewerSection 
                        localT={localT} 
                        is3DExpanded={is3DExpanded} 
                        setIs3DExpanded={setIs3DExpanded} 
                        stlUnits={stlUnits} 
                        formData={formData} 
                        activeSuffixIndex={activeSuffixIndex} 
                        setActiveSuffixIndex={setActiveSuffixIndex} 
                        handleLoadLocalFiles={handleLoadLocalFiles} 
                    />

                    <JobMetadataFooter 
                        job={job}
                        isModified={isModified}
                        isDuplicate={isDuplicate}
                    />

                    <TextField
                        label={localT('notes')}
                        value={formData.notes || ''}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                    />

                    <DebugSection 
                        isDeveloperMode={isDeveloperMode} 
                        localT={localT} 
                        allMaterials={allMaterials} 
                        allTypes={allTypes} 
                    />
                </Box>
            </DialogContent>
            <JobEditModalActions onClose={onClose} onSave={handleSave} onDelete={onDelete ? handleDelete : undefined} isManual={isNewManual} />
        </Dialog>
    );
};
