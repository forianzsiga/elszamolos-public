import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, Divider, Typography, Button, TextField, MenuItem, Chip
} from '@mui/material';
import { Add, Save, ContentCopy } from '@mui/icons-material';
import type { TariffRule, TariffCondition, TariffAction, ConditionField, ConditionOperator, TariffRuleKind, Job, Tooth } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { ConditionItem } from '../ConditionItem/ConditionItem';
import { RuleEditorHeader } from '../RuleEditorHeader/RuleEditorHeader';
import { ExclusionList, ApplicationList, RuleFormFields } from '../RuleDetailsForm';
import { processApplications, type ActiveItem } from './RuleEditorUtils';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './RuleEditor-i11n.json';
import './RuleEditor.css';

interface RuleEditorProps {
    initialRule: TariffRule | null;
    onSave: (rule: TariffRule) => void;
    onCancel: () => void;
    onDuplicate?: (rule: TariffRule) => void;
    jobs?: Job[];
    activeJob?: {
        teeth: Tooth[];
        doctorName: string;
        patientName: string;
    } | null;
    onRemoveExclusion?: (ruleId: string, jobId: string, toothId?: string) => void;
    metadata?: {
        materials: string[];
        types: string[];
        doctors: string[];
        patients?: string[];
    };
    hiddenMetadata?: {
        materials: Set<string>;
        types: Set<string>;
        doctors: Set<string>;
        patients?: Set<string>;
    };
    /**
     * Called when the user finishes interacting with a rule editor field —
     * either by closing a dropdown (Select / Autocomplete `onClose`),
     * picking a value from a dropdown (`onChange`), or blurring a plain
     * text/number input. The page is responsible for any persistence /
     * recalculation — the editor only reports the field discriminator and
     * the live in-progress rule snapshot at the time of the change.
     */
    onFieldChange?: (field: 'name' | 'label' | 'condition' | 'action' | 'ruleKind', rule: TariffRule) => void;
    /**
     * When `true`, the preview recalculation triggered by `onFieldChange`
     * is in flight. Used to surface a loading state on the
     * `ApplicationList` panel.
     */
    isRecalculating?: boolean;
}

export const RuleEditor = ({ initialRule, onSave, onCancel, onDuplicate, jobs, activeJob, onRemoveExclusion, metadata, hiddenMetadata, onFieldChange, isRecalculating = false }: RuleEditorProps) => {
    const { t, language } = useLanguage();
    const localT = (key: string, params?: Record<string, string>) => {
        const translations = i11n as Record<'en' | 'hu', Record<string, string>>;
        const translation = translations[language as 'en' | 'hu']?.[key] || key;
        if (!params) return translation;
        return translation.replace(/\{\{(\w+)\}\}/g, (_: string, match: string) => params[match] || '');
    };
    
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [priority, setPriority] = useState<number | undefined>(10);
    const [conditions, setConditions] = useState<TariffCondition[]>([]);
    const [action, setAction] = useState<TariffAction>({ value: undefined, currency: 'HUF' });
    const [ruleKind, setRuleKind] = useState<TariffRuleKind>('base');
    const [isSystem, setIsSystem] = useState(false);

    const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
    const [nameError, setNameError] = useState('');
    const [, setLabelError] = useState('');

    const activeExclusions = useMemo(() => {
        if (!initialRule || !jobs) return [];
        const list: ActiveItem[] = [];

        jobs.forEach(job => {
            if (job.excludedRuleIds?.includes(initialRule.id)) {
                list.push({
                    id: `job-${job.id}`,
                    jobId: job.id,
                    patientName: job.patientName,
                    doctorName: job.doctorName,
                    projectId: job.projectId || 'N/A',
                    type: 'job'
                });
            }
            job.teeth.forEach((tooth, _idx) => {
                if (tooth.excludedRuleIds?.includes(initialRule.id)) {
                    const toothStableId = tooth.id || `stable-${job.id}-${tooth.number}-${_idx}`;
                    list.push({
                        id: `tooth-${job.id}-${toothStableId}`,
                        jobId: job.id,
                        patientName: job.patientName,
                        doctorName: job.doctorName,
                        projectId: job.projectId || 'N/A',
                        toothNumber: tooth.number,
                        toothId: toothStableId,
                        type: 'tooth'
                    });
                }
            });
        });

        return list;
    }, [initialRule, jobs]);

    const activeApplications = useMemo(() => processApplications(initialRule, jobs || []), [initialRule, jobs]);

    /**
     * Snapshot of the in-progress rule, rebuilt from local form state on
     * every change. This is what we hand to the parent on field blur so
     * the live "Applied to" count can refresh without waiting for Save.
     */
    const currentRule = useMemo<TariffRule | null>(() => {
        if (!initialRule) return null;
        return {
            id: initialRule.id,
            name,
            label: label || name,
            priority: priority ?? 0,
            conditions,
            kind: ruleKind,
            action: {
                ...action,
                value: action.value ?? 0
            },
            isSystem
        };
    }, [initialRule, name, label, priority, conditions, ruleKind, action, isSystem]);

    const FIELD_OPTIONS: { label: string; value: ConditionField }[] = useMemo(() => [
        { label: t('jobs.column.material'), value: 'material' },
        { label: t('jobs.column.type'), value: 'type' },
        { label: t('jobs.column.units'), value: 'unitCount' },
        { label: t('jobs.column.doctor'), value: 'doctorName' },
        { label: t('jobs.column.patient'), value: 'patientName' },
        { label: t('teethTable.notes'), value: 'notes' },
        { label: t('jobs.column.screw'), value: 'isScrewRetained' },
        { label: t('jobs.column.projectId'), value: 'projectId' },
        { label: t('teethTable.toothNumber'), value: 'number' },
    ], [t]);

    const OPERATOR_OPTIONS: { label: string; value: ConditionOperator }[] = useMemo(() => [
        { label: t('tariff.operator.equals'), value: 'equals' },
        { label: t('tariff.operator.notEquals'), value: 'notEquals' },
        { label: t('tariff.operator.contains'), value: 'contains' },
        { label: t('tariff.operator.notContains'), value: 'notContains' },
        { label: t('tariff.operator.greaterThan'), value: 'greaterThan' },
        { label: t('tariff.operator.lessThan'), value: 'lessThan' },
        { label: t('tariff.operator.isOneOf'), value: 'isOneOf' },
        { label: t('tariff.operator.notOneOf'), value: 'notOneOf' },
    ], [t]);

    const scopeSummary = useMemo(() => {
        switch (ruleKind) {
            case 'base':
                return t('tariff.editor.scopeSummary.base');
            case 'unitExtra':
                return t('tariff.editor.scopeSummary.unitExtra');
            case 'jobExtra':
                return t('tariff.editor.scopeSummary.jobExtra');
            case 'invalid':
                return t('tariff.editor.scopeSummary.invalid');
            case 'review':
                return t('tariff.editor.scopeSummary.review');
            case 'ignoreUnit':
                return t('tariff.editor.scopeSummary.ignoreUnit') || 'Removes the unit from pricing, invoice, and the job\'s pending count.';
            // Defensive fallback for the legacy `hideAttribute` kind, which
            // is removed from the union but may briefly exist in old rule
            // JSON before the boot-time migration runs.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            case ('hideAttribute' as any):
                return t('tariff.editor.scopeSummary.hideAttribute') || 'Hides matching attributes from selector dropdowns.';
            default:
                return '';
        }
    }, [ruleKind, t]);

    const triggerSummary = useMemo(() => {
        switch (ruleKind) {
            case 'base':
                return t('tariff.editor.triggerSummary.base');
            case 'unitExtra':
                return t('tariff.editor.triggerSummary.unitExtra');
            case 'jobExtra':
                return t('tariff.editor.triggerSummary.jobExtra');
            case 'invalid':
                return t('tariff.editor.triggerSummary.invalid');
            case 'review':
                return t('tariff.editor.triggerSummary.review');
            case 'ignoreUnit':
                return t('tariff.editor.triggerSummary.ignoreUnit') || 'Trigger logic: matched units are excluded from the teeth list, invoice, 3D viewer, and the job\'s pending count.';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            case ('hideAttribute' as any):
                return t('tariff.editor.triggerSummary.hideAttribute') || 'Trigger logic: matching attributes are filtered out.';
            default:
                return '';
        }
    }, [ruleKind, t]);

    useEffect(() => {
        if (initialRule) {
            setName(initialRule.name);
            setLabel(initialRule.label || '');
            setPriority(initialRule.priority);
            setConditions(initialRule.conditions);
            setAction({ value: initialRule.action.value, currency: initialRule.action.currency || 'HUF' });
            setRuleKind(initialRule.kind || 'base');
            setIsSystem(initialRule.isSystem || false);
        } else {
            setName('');
            setLabel('');
            setPriority(1);
            setConditions([{ field: 'material', operator: 'equals', value: '' }]);
            setAction({ value: undefined, currency: 'HUF' });
            setRuleKind('base');
            setIsSystem(false);
        }
        setValidationErrors({});
        setNameError('');
        setLabelError('');
    }, [initialRule]);

    const validateName = () => {
        if (!name.trim()) {
            setNameError(localT('nameRequired'));
            return false;
        }
        setNameError('');
        return true;
    };

    const handleConditionChange = (index: number, field: keyof TariffCondition, value: string | number | string[] | boolean) => {
        const newConditions = [...conditions];
        const currentCondition = newConditions[index];

        if (field === 'field' && value !== currentCondition.field) {
            currentCondition.value = '';
            setValidationErrors(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        }
        
        if (field === 'operator') {
            if (value === 'isOneOf' && !Array.isArray(currentCondition.value)) {
                currentCondition.value = [];
            } else if (value !== 'isOneOf' && Array.isArray(currentCondition.value)) {
                currentCondition.value = '';
            }
        }
        
        newConditions[index] = { ...newConditions[index], [field]: value };
        setConditions(newConditions);
    };

    const validateCondition = (index: number) => {
        const condition = conditions[index];
        let error = '';
        const options = getOptionsForField(condition.field);

        if (condition.operator === 'isOneOf') {
            if (!Array.isArray(condition.value) || condition.value.length === 0) {
                error = localT('selectOption');
            }
        } else if (!condition.value && condition.value !== 0) {
            error = localT('valueEmpty');
        } else if (condition.field === 'unitCount' && isNaN(Number(condition.value))) {
            error = localT('unitCountNumber');
        } else if (
            options.length > 0 &&
            (condition.operator === 'equals' || condition.operator === 'notEquals') &&
            !options.includes(String(condition.value))
        ) {
            error = localT('valueMustBeOption');
        }

        setValidationErrors(prev => ({
            ...prev,
            [index]: error
        }));

        if (onFieldChange && currentRule) {
            onFieldChange('condition', currentRule);
        }

        return !error;
    };

    const getOptionsForField = (field: ConditionField): string[] => {
        if (!metadata) return [];
        switch (field) {
            case 'material': return metadata.materials;
            case 'type': return metadata.types;
            case 'doctorName': return metadata.doctors;
            case 'patientName': return metadata.patients || [];
            default: return [];
        }
    };

    const getHiddenOptionsForField = (field: ConditionField): Set<string> => {
        if (!hiddenMetadata) return new Set();
        switch (field) {
            case 'material': return hiddenMetadata.materials;
            case 'type': return hiddenMetadata.types;
            case 'doctorName': return hiddenMetadata.doctors;
            case 'patientName': return hiddenMetadata.patients || new Set();
            default: return new Set();
        }
    };

    const getStatsForField = (field: ConditionField) => {
        const occurrences = new Map<string, number>();
        const lastUsed = new Map<string, string>();
        if (!jobs) return { occurrences, lastUsed };

        // Sort jobs by date descending for lastUsed
        const sortedJobs = [...jobs].sort((a, b) => {
            const dateA = a.createdAt || '';
            const dateB = b.createdAt || '';
            return dateB.localeCompare(dateA);
        });

        jobs.forEach(job => {
            if (field === 'doctorName' && job.doctorName) {
                occurrences.set(job.doctorName, (occurrences.get(job.doctorName) || 0) + 1);
            }
            if (field === 'patientName' && job.patientName) {
                occurrences.set(job.patientName, (occurrences.get(job.patientName) || 0) + 1);
            }
            if (job.teeth) {
                job.teeth.forEach(tooth => {
                    if (field === 'material' && tooth.material) {
                        occurrences.set(tooth.material, (occurrences.get(tooth.material) || 0) + 1);
                    }
                    if (field === 'type' && tooth.type) {
                        occurrences.set(tooth.type, (occurrences.get(tooth.type) || 0) + 1);
                    }
                });
            }
        });

        sortedJobs.forEach(job => {
            const date = job.createdAt || '';
            if (field === 'doctorName' && job.doctorName && !lastUsed.has(job.doctorName)) {
                lastUsed.set(job.doctorName, date);
            }
            if (field === 'patientName' && job.patientName && !lastUsed.has(job.patientName)) {
                lastUsed.set(job.patientName, date);
            }
            if (job.teeth) {
                job.teeth.forEach(tooth => {
                    if (field === 'material' && tooth.material && !lastUsed.has(tooth.material)) {
                        lastUsed.set(tooth.material, date);
                    }
                    if (field === 'type' && tooth.type && !lastUsed.has(tooth.type)) {
                        lastUsed.set(tooth.type, date);
                    }
                });
            }
        });

        return { occurrences, lastUsed };
    };

    const getJobOccurrencesForField = (field: ConditionField) => {
        const occurrences = new Map<string, number>();
        const appliedJobIds = new Set(activeApplications.map(app => app.jobId));
        const appliedJobs = jobs?.filter(job => appliedJobIds.has(job.id)) || [];

        const aggregateJob = (job: { teeth?: Tooth[]; doctorName?: string; patientName?: string }) => {
            if (field === 'doctorName' && job.doctorName) {
                occurrences.set(job.doctorName, (occurrences.get(job.doctorName) || 0) + 1);
            }
            if (field === 'patientName' && job.patientName) {
                occurrences.set(job.patientName, (occurrences.get(job.patientName) || 0) + 1);
            }
            if (job.teeth) {
                job.teeth.forEach(tooth => {
                    if (field === 'material' && tooth.material) {
                        occurrences.set(tooth.material, (occurrences.get(tooth.material) || 0) + 1);
                    }
                    if (field === 'type' && tooth.type) {
                        occurrences.set(tooth.type, (occurrences.get(tooth.type) || 0) + 1);
                    }
                });
            }
        };

        if (activeJob) {
            aggregateJob(activeJob);
        }

        appliedJobs.forEach(aggregateJob);

        return occurrences;
    };

    const addCondition = () => {
        setConditions([...conditions, { field: 'material', operator: 'equals', value: '' }]);
    };

    const removeCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
        setValidationErrors(prev => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
    };

    const handleSave = () => {
        let isValid = true;
        
        if (!validateName()) {
            isValid = false;
        }

        conditions.forEach((_, index) => {
            if (!validateCondition(index)) {
                isValid = false;
            }
        });

        conditions.forEach((c) => {
             if (((c.operator === 'isOneOf' || c.operator === 'notOneOf') && (!Array.isArray(c.value) || c.value.length === 0)) ||
                 (c.field !== 'isScrewRetained' && !c.value && c.value !== 0) ||
                 (c.field === 'unitCount' && isNaN(Number(c.value)))) {
                 isValid = false;
             }
        });

        if (!isValid) return;

        const rule: TariffRule = {
            id: initialRule?.id || crypto.randomUUID(),
            name,
            label: label || name,
            priority: priority ?? 0,
            conditions,
            kind: ruleKind,
            action: {
                ...action,
                value: action.value ?? 0
            },
            isSystem: isSystem
        };
        onSave(rule);
    };

    const handleDuplicate = () => {
        let isValid = true;
        
        if (!validateName()) {
            isValid = false;
        }

        conditions.forEach((_, index) => {
            if (!validateCondition(index)) {
                isValid = false;
            }
        });

        conditions.forEach((c) => {
             if (((c.operator === 'isOneOf' || c.operator === 'notOneOf') && (!Array.isArray(c.value) || c.value.length === 0)) ||
                 (c.field !== 'isScrewRetained' && !c.value && c.value !== 0) ||
                 (c.field === 'unitCount' && isNaN(Number(c.value)))) {
                 isValid = false;
             }
        });

        if (!isValid) return;

        const rule: TariffRule = {
            id: initialRule?.id || crypto.randomUUID(),
            name,
            label: label || name,
            priority: priority ?? 0,
            conditions,
            kind: ruleKind,
            action: {
                ...action,
                value: action.value ?? 0
            },
            isSystem: isSystem
        };
        
        if (onDuplicate) {
            onDuplicate(rule);
        }
    };

    return (
        <Box className="rule-editor-container">
            <RuleEditorHeader initialRule={initialRule} onCancel={onCancel} />

            <RuleFormFields
                name={name} setName={setName}
                label={label} setLabel={setLabel}
                priority={priority}
                isSystem={isSystem} setIsSystem={setIsSystem}
                t={t} localT={localT}
                nameError={nameError} setNameError={setNameError}
                setLabelError={setLabelError}
                validateName={validateName}
                onNameChange={() => {
                    if (onFieldChange && currentRule) {
                        onFieldChange('name', currentRule);
                    }
                }}
            />

            <Divider textAlign="left" className="margin-bottom-2">
                <Typography variant="caption" color="text.secondary">{t('tariff.editor.conditionsTitle')}</Typography>
            </Divider>

            <Box className="margin-bottom-3">
                {conditions.map((condition, index) => {
                    const stats = getStatsForField(condition.field);
                    const jobOccurrences = getJobOccurrencesForField(condition.field);
                    return (
                        <ConditionItem
                            key={index}
                            condition={condition}
                            index={index}
                            error={validationErrors[index]}
                            fieldOptions={FIELD_OPTIONS}
                            operatorOptions={OPERATOR_OPTIONS}
                            availableOptions={getOptionsForField(condition.field)}
                            hiddenOptions={getHiddenOptionsForField(condition.field)}
                            occurrences={stats.occurrences}
                            jobOccurrences={jobOccurrences}
                            lastUsed={stats.lastUsed}
                            onChange={handleConditionChange}
                            onRemove={removeCondition}
                            onBlur={validateCondition}
                            currentRule={currentRule}
                            onFieldChange={onFieldChange}
                        />
                    );
                })}
                <ResponsiveTooltip title={localT('addConditionTooltip')}>
                    <Button startIcon={<Add />} size="small" onClick={addCondition}>
                        {t('tariff.editor.addCondition')}
                    </Button>
                </ResponsiveTooltip>
            </Box>

            <Divider textAlign="left" className="margin-bottom-2">
                <Typography variant="caption" color="text.secondary">{t('tariff.editor.actionTitle')}</Typography>
            </Divider>

            <Box className="rule-type-action-container" display="flex" gap={2} flexWrap="wrap" alignItems="flex-start">
                <Box className="rule-type-action-group">
                    <TextField
                        select
                        fullWidth
                        label={t('tariff.editor.ruleType')}
                        value={ruleKind}
                        onChange={(e) => {
                            setRuleKind(e.target.value as TariffRuleKind);
                            if (onFieldChange && currentRule) {
                                const newKind = e.target.value as TariffRuleKind;
                                onFieldChange('ruleKind', { ...currentRule, kind: newKind });
                            }
                        }}
                        slotProps={{
                            select: {
                                onClose: () => {
                                    if (onFieldChange && currentRule) {
                                        onFieldChange('ruleKind', currentRule);
                                    }
                                }
                            }
                        }}
                        helperText={scopeSummary}
                        className="margin-bottom-2"
                    >
                        <MenuItem value="base">{t('tariff.editor.ruleType.base')}</MenuItem>
                        <MenuItem value="unitExtra">{t('tariff.editor.ruleType.unitExtra')}</MenuItem>
                        <MenuItem value="jobExtra">{t('tariff.editor.ruleType.jobExtra')}</MenuItem>
                        <MenuItem value="invalid">{t('tariff.editor.ruleType.invalid')}</MenuItem>
                        <MenuItem value="review">{t('tariff.editor.ruleType.review')}</MenuItem>
                        <MenuItem value="ignoreUnit">{t('tariff.editor.ruleType.ignoreUnit') || 'Ignore unit'}</MenuItem>
                    </TextField>
                    <Typography variant="caption" color="text.secondary" display="block" className="margin-bottom-2">
                        {triggerSummary}
                    </Typography>
                </Box>
                {ruleKind !== 'invalid' && ruleKind !== 'review' && ruleKind !== 'ignoreUnit' && (
                    <Box className="rule-type-action-group rule-type-action-group--row">
                        <TextField
                            type="number"
                            label={t('tariff.editor.priceValue')}
                            value={action.value ?? ''}
                            onChange={(e) => setAction({ ...action, value: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                            onBlur={() => {
                                if (onFieldChange && currentRule) {
                                    onFieldChange('action', currentRule);
                                }
                            }}
                            color={action.value === 0 ? "warning" : "primary"}
                            focused={action.value === 0}
                            helperText={action.value === 0 ? localT('priceIsZero') : ""}
                            className="rule-editor-price-value"
                            slotProps={{
                                input: {
                                    endAdornment: action.currency ? (
                                        <ResponsiveTooltip title={localT('removeCurrencyTooltip')}>
                                            <Chip
                                                size="small"
                                                label={action.currency === 'EUR' ? '€' : 'Ft'}
                                                onDelete={() => setAction({ ...action, currency: undefined })}
                                                className="rule-editor-currency-chip"
                                            />
                                        </ResponsiveTooltip>
                                    ) : null,
                                    sx: { color: action.value === 0 ? 'warning.main' : 'inherit' }
                                },
                                formHelperText: {
                                    sx: { color: 'warning.main' }
                                }
                            }}
                        />
                        <TextField
                            select
                            label={t('tariff.editor.currency')}
                            value={action.currency || 'HUF'}
                            onChange={(e) => {
                                setAction({ ...action, currency: e.target.value as 'HUF' | 'EUR' });
                                if (onFieldChange && currentRule) {
                                    const newCurrency = e.target.value as 'HUF' | 'EUR';
                                    onFieldChange('action', { ...currentRule, action: { ...currentRule.action, currency: newCurrency } });
                                }
                            }}
                            slotProps={{
                                select: {
                                    onClose: () => {
                                        if (onFieldChange && currentRule) {
                                            onFieldChange('action', currentRule);
                                        }
                                    }
                                }
                            }}
                            className="rule-editor-currency-select"
                        >
                            <MenuItem value="HUF">Ft</MenuItem>
                            <MenuItem value="EUR">€</MenuItem>
                        </TextField>
                    </Box>
                )}
            </Box>

            {(activeExclusions.length > 0 || activeApplications.length > 0) && (
                <Box className="margin-bottom-3">
                    <Divider textAlign="left" className="margin-bottom-2">
                        <Typography variant="caption" color="text.secondary">{localT('activeTitle')}</Typography>
                    </Divider>
                    
                    {activeExclusions.length > 0 && (
                        <ExclusionList 
                            exclusions={activeExclusions}
                            localT={localT}
                            navigate={navigate}
                            onRemoveExclusion={onRemoveExclusion}
                            initialRule={initialRule}
                        />
                    )}

                    {activeApplications.length > 0 && (
                        <ApplicationList
                            applications={activeApplications}
                            localT={localT}
                            navigate={navigate}
                            ruleKind={ruleKind}
                            isRecalculating={isRecalculating}
                        />
                    )}
                </Box>
            )}

            <Box className="actions-container">
                <ResponsiveTooltip title={localT('cancelTooltip')}>
                    <Button variant="outlined" onClick={onCancel}>{t('common.cancel')}</Button>
                </ResponsiveTooltip>
                {initialRule && onDuplicate && (
                    <ResponsiveTooltip title={localT('duplicateTooltip')}>
                        <Button variant="outlined" color="info" startIcon={<ContentCopy />} onClick={handleDuplicate}>
                            {t('common.duplicate') || 'Duplicate'}
                        </Button>
                    </ResponsiveTooltip>
                )}
                <ResponsiveTooltip title={localT('saveTooltip')}>
                    <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={!name}>
                        {t('tariff.editor.save')}
                    </Button>
                </ResponsiveTooltip>
            </Box>
        </Box>
    );
};
