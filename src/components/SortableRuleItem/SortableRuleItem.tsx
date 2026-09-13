import { memo, useMemo, useLayoutEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Paper, IconButton, Typography, Checkbox, Chip } from '@mui/material';
import { Edit, Delete, DragIndicator, ArrowUpward, ArrowDownward, ContentCopy, Lock } from '@mui/icons-material';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import type { TariffRule, Job } from '../../types';
import i11n from './SortableRuleItem-i11n.json';
import './SortableRuleItem.css';

interface SortableRuleItemProps {
    rule: TariffRule;
    selected: boolean;
    onSelect: (selected: boolean) => void;
    onEdit: (rule: TariffRule) => void;
    onDelete: (id: string) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onDuplicate?: (rule: TariffRule) => void;
    jobs?: Job[];
    /**
     * When `true`, the item is rendered in "system" mode:
     *   - No checkbox, no drag handle, no steppers, no duplicate button.
     *   - The kind chip is replaced with a lock chip.
     *   - The card is not draggable (uses `useSortable({ disabled: true })`).
     *   - The card has a yellow left border and `data-is-system="true"`.
     */
    isSystem?: boolean;
}

type SupportedLanguage = 'en' | 'hu';

export const SortableRuleItem = memo(({ rule, selected, onSelect, onEdit, onDelete, onMoveUp, onMoveDown, onDuplicate, jobs, isSystem = false }: SortableRuleItemProps) => {
    const { language } = useLanguage();
    const itemRef = useRef<HTMLDivElement>(null);

    const localT = (key: string) => {
        const lang = (language === 'debug' ? 'en' : language) as SupportedLanguage;
        return (i11n[lang] as Record<string, string>)[key] || key;
    };

    const getRuleKindColor = (kind: string): 'primary' | 'warning' | 'secondary' | 'error' | 'info' | 'success' => {
        if (kind === 'base') return 'primary';
        if (kind === 'unitExtra') return 'warning';
        if (kind === 'invalid') return 'error';
        if (kind === 'review') return 'info';
        if (kind === 'ignoreUnit') return 'success';
        return 'secondary';
    };

    const exclusionCount = useMemo(() => {
        if (!jobs) return 0;
        let count = 0;
        jobs.forEach(job => {
            if (job.excludedRuleIds?.includes(rule.id)) {
                count++;
            }
            job.teeth.forEach(tooth => {
                if (tooth.excludedRuleIds?.includes(rule.id)) {
                    count++;
                }
            });
        });
        return count;
    }, [jobs, rule.id]);

    const { appliedUnitsCount, appliedJobsCount } = useMemo(() => {
        if (!jobs) return { appliedUnitsCount: 0, appliedJobsCount: 0 };
        let unitsCount = 0;
        const jobIds = new Set<string>();

        for (const job of jobs) {
            const isJobExtraApplied = job.appliedJobRules?.some(r => r.id === rule.id && !r.isExcluded);
            if (isJobExtraApplied) {
                jobIds.add(job.id);
            }

            for (const tooth of job.teeth) {
                const isToothApplied = tooth.appliedRuleId === rule.id || tooth.appliedRules?.some(r => r.id === rule.id && !r.isExcluded);
                if (isToothApplied) {
                    unitsCount++;
                    jobIds.add(job.id);
                }
            }
        }

        return {
            appliedUnitsCount: unitsCount,
            appliedJobsCount: jobIds.size
        };
    }, [jobs, rule.id]);

    const ruleKind = rule.kind || 'base';

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: rule.id, disabled: isSystem });

    useLayoutEffect(() => {
        if (itemRef.current) {
            itemRef.current.style.setProperty('--dnd-transform', CSS.Transform.toString(transform) || 'none');
            itemRef.current.style.setProperty('--dnd-transition', transition || 'none');
            itemRef.current.style.setProperty('--dnd-opacity', isDragging ? '0.5' : '1');
            itemRef.current.style.setProperty('--dnd-z-index', isDragging ? '1' : 'auto');
        }
    }, [transform, transition, isDragging]);

    const handleRef = (node: HTMLDivElement | null) => {
        // @ts-expect-error -- dnd-kit's setNodeRef type is too narrow
        itemRef.current = node;
        setNodeRef(node);
    };

    const cardClassName = `sortable-rule-item ${isDragging ? 'is-dragging' : ''}${isSystem ? ' sortable-rule-item--system' : ''}`;

    return (
        <Paper
            ref={handleRef}
            variant="outlined"
            className={cardClassName}
            data-is-system={isSystem ? 'true' : 'false'}
            tabIndex={0}
            onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target && target.closest && target.closest('button, a, input, textarea, select, [role="button"], .MuiCheckbox-root, .drag-handle')) {
                    return;
                }
                onEdit(rule);
            }}
            onKeyDown={(e) => {
                const key = e.key;
                if (key === 'Enter' || key === ' ') {
                    const target = e.target as HTMLElement;
                    if (target && target.closest && target.closest('button, a, input, textarea, select, [role="button"], .drag-handle')) {
                        return;
                    }
                    e.preventDefault();
                    onEdit(rule);
                }
            }}
        >
            {!isSystem && (
                <ResponsiveTooltip title={localT('select')}>
                    <Checkbox
                        checked={selected}
                        onChange={(e) => onSelect(e.target.checked)}
                        size="small"
                        className="rule-checkbox"
                    />
                </ResponsiveTooltip>
            )}

            {!isSystem && (
                /* Drag Handle & Steppers */
                <Box display="flex" alignItems="center" mr={2}>
                     <ResponsiveTooltip title={localT('dragHandle')}>
                        <Box
                            className="drag-handle"
                            {...attributes}
                            {...listeners}
                        >
                            <DragIndicator fontSize="small" />
                        </Box>
                    </ResponsiveTooltip>

                    <Box className="stepper-container">
                        <ResponsiveTooltip title={localT('moveUp')}>
                            <IconButton
                                size="small"
                                onClick={() => onMoveUp(rule.id)}
                                className="stepper-button"
                            >
                                <ArrowUpward className="stepper-icon" />
                            </IconButton>
                        </ResponsiveTooltip>

                        <ResponsiveTooltip title={localT('moveDown')}>
                            <IconButton
                                size="small"
                                onClick={() => onMoveDown(rule.id)}
                                className="stepper-button"
                            >
                                <ArrowDownward className="stepper-icon" />
                            </IconButton>
                        </ResponsiveTooltip>
                    </Box>
                </Box>
            )}

            {/* Content */}
            <Box className="rule-content-container">
                <Box className="rule-info-container">
                    <Typography variant="subtitle1" fontWeight="medium" noWrap>
                        {rule.name}
                    </Typography>
                    <Box className="rule-details-container" color="text.secondary">
                        <Box className="rule-info-row">
                            <Typography variant="inherit">
                                {localT('priority')} <strong>{rule.priority}</strong>
                            </Typography>
                            <Typography variant="inherit">
                                {localT('label')} <strong>{rule.label || localT('notSet')}</strong>
                            </Typography>
                            {isSystem ? (
                                <Chip
                                    size="small"
                                    icon={<Lock fontSize="small" />}
                                    label={localT('system')}
                                    color="warning"
                                    variant="outlined"
                                    className="rule-kind-chip rule-system-chip"
                                />
                            ) : (
                                <ResponsiveTooltip title={localT(`ruleTypeTooltip.${ruleKind}`)}>
                                        <Chip
                                            size="small"
                                            label={localT(`scopeLabel.${ruleKind}`)}
                                            color={getRuleKindColor(ruleKind)}
                                            variant="outlined"
                                            className="rule-kind-chip"
                                        />

                                </ResponsiveTooltip>
                            )}

                        </Box>

                        <Box display="flex" flexWrap="wrap" gap={1}>
                            {rule.conditions.map((c, idx) => (
                                <Typography key={idx} variant="caption" className="condition-chip">
                                    <span className="condition-field">{c.field}</span>
                                    <span className="condition-operator">{c.operator}</span>
                                    <span>
                                        {Array.isArray(c.value) ? `[${c.value.join(', ')}]` : String(c.value)}
                                    </span>
                                </Typography>
                            ))}
                            {rule.conditions.length === 0 && <Typography variant="caption" fontStyle="italic">{localT('noConditions')}</Typography>}
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* Stats */}
            <Box className="rule-stats-container">
                <Typography variant="caption" className="stats-applied-text">
                    {(() => {
                        if (ruleKind === 'jobExtra') {
                            return localT('appliedStats.jobExtra').replace('{jobs}', String(appliedJobsCount));
                        }
                        if (ruleKind === 'ignoreUnit') {
                            return localT('appliedStats.ignoreUnit')
                                .replace('{units}', String(appliedUnitsCount))
                                .replace('{jobs}', String(appliedJobsCount));
                        }
                        return localT('appliedStats.tooth')
                            .replace('{units}', String(appliedUnitsCount))
                            .replace('{jobs}', String(appliedJobsCount));
                    })()}
                </Typography>
                {exclusionCount > 0 && (
                    <Typography variant="caption" className="stats-excluded-text">
                        {localT('excludedStats').replace('{exclusions}', String(exclusionCount))}
                    </Typography>
                )}
            </Box>

            {/* Actions */}
            <Box className="actions-container">
                <ResponsiveTooltip title={localT('edit')}>
                    <IconButton onClick={() => onEdit(rule)} color="primary" size="small">
                        <Edit fontSize="small" />
                    </IconButton>
                </ResponsiveTooltip>
                {!isSystem && onDuplicate && (
                    <ResponsiveTooltip title={localT('duplicate')}>
                        <IconButton onClick={() => onDuplicate(rule)} color="info" size="small">
                            <ContentCopy fontSize="small" />
                        </IconButton>
                    </ResponsiveTooltip>
                )}
                <ResponsiveTooltip title={localT('delete')}>
                    <IconButton onClick={() => onDelete(rule.id)} color="error" size="small">
                        <Delete fontSize="small" />
                    </IconButton>
                </ResponsiveTooltip>
            </Box>
        </Paper>
    );
}, (prevProps: SortableRuleItemProps, nextProps: SortableRuleItemProps) => {
    return (
        prevProps.selected === nextProps.selected &&
        prevProps.rule === nextProps.rule &&
        prevProps.jobs === nextProps.jobs &&
        prevProps.isSystem === nextProps.isSystem
    );
});
