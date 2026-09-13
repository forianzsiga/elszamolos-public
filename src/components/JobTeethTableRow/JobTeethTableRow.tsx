/** @file JobTeethTableRow.tsx
 *  @brief Defines a single row component for the job teeth table.
 *
 *  Renders a row representing a tooth entry within a virtualized data table.
 *  Supports a chevron toggle that expands a bulleted list of applied rules
 *  beneath the row. Each rule bullet has jump-to-rule, exclude, and
 *  reinclude actions.
 */

import React from 'react';
import {
    Box, Chip, Collapse, IconButton, List, ListItem,
    Typography
} from '@mui/material';
import {
    Block as BlockIcon,
    ChevronRight as ChevronRightIcon,
    KeyboardArrowDown as KeyboardArrowDownIcon,
    ArrowBack as ArrowBackIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import type { AppliedRuleBreakdown, Tooth } from '../../types';
import type { ColumnDef } from '../VirtualDataTable';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { formatCurrency } from '../../utils/text';
import i11n from './JobTeethTableRow-i11n.json';
import './JobTeethTableRow.css';

/**
 * Discriminated union of the possible row entry kinds.
 * - `'tooth'`: Standard tooth row.
 * - `'unitExtra'`: Extra rule applied to a specific tooth.
 * - `'jobExtra'`: Extra rule applied to the whole job.
 * - `'hiddenHeader'`: Placeholder header row for hidden teeth.
 */
export type JobTeethTableEntryKind = 'tooth' | 'unitExtra' | 'jobExtra' | 'hiddenHeader';

/**
 * Describes a single entry (row) in the job teeth table.
 *
 * @property id      - Unique row identifier.
 * @property kind    - Category of the row entry.
 * @property tooth   - The tooth data associated with this row.
 * @property extraRule - Optional applied-rule breakdown (present for extra rows).
 */
export interface JobTeethTableEntry {
    id: string;
    kind: JobTeethTableEntryKind;
    tooth: Tooth;
    extraRule?: AppliedRuleBreakdown;
}

/**
 * Per-row callback signatures. The chevron expansion beneath each unit
 * row exposes exclude/reinclude affordances. The pair of callbacks lets
 * the parent decide whether the action targets the unit (per-tooth
 * `excludedRuleIds`) or the job (`job.excludedRuleIds` for `jobExtra`).
 */
type UnitRuleAction = (ruleId: string) => void;
type JobRuleAction = (ruleId: string) => void;

/**
 * Props for the {@link JobTeethTableRow} component.
 */
interface JobTeethTableRowProps {
    entry: JobTeethTableEntry;
    gridTemplateColumns: string;
    columnDefs: ColumnDef<JobTeethTableEntry>[];
    visibleColumns: Record<string, boolean>;
    hoveredTooth: string | null;
    onHoverTooth: (toothNum: string | null) => void;
    hoveredRowId: string | null;
    onHoverRowId: (rowId: string | null) => void;
    /** Whether the chevron expansion beneath this row is open. */
    expanded?: boolean;
    /** Toggle the chevron expansion beneath this row. */
    onToggleExpand?: () => void;
    /** Navigate to the rule editor for a given rule id. */
    onJumpToRule?: (ruleId: string) => void;
    /** Exclude a unit-scoped rule for this unit. */
    onExcludeRuleForUnit?: UnitRuleAction;
    /** Re-include a previously excluded unit-scoped rule for this unit. */
    onReincludeRuleForUnit?: UnitRuleAction;
    /** Exclude a job-scoped rule (jobExtra) for the whole job. */
    onExcludeRuleForJob?: JobRuleAction;
    /** Re-include a previously excluded job-scoped rule. */
    onReincludeRuleForJob?: JobRuleAction;
    /**
     * Job-level extra rule breakdowns. When the row is expanded these
     * entries are appended to the per-unit rule list so the user can see
     * the job-level extras in the same context. Exclude/reinclude of a
     * `jobExtra` rule always targets the job, not the unit.
     */
    jobExtraRules?: AppliedRuleBreakdown[];
    /** Optional set of rule IDs already excluded at the job level. */
    jobExcludedRuleIds?: string[];
}

type SupportedLanguage = 'en' | 'hu';

const localT = (language: string, key: string): string => {
    const lang = (language === 'debug' ? 'en' : language) as SupportedLanguage;
    return (i11n[lang] as Record<string, string>)?.[key] || key;
};

/**
 * Renders a single row inside the job teeth virtualized data table.
 *
 * The row is wrapped in a fragment that yields:
 *  1. The main row `Box` (grid cells via `columnDefs`).
 *  2. A `Collapse` block underneath that contains a bulleted list of
 *     applied rules (when `expanded` is true and the entry kind supports
 *     expansion).
 */
export const JobTeethTableRow = React.memo(function JobTeethTableRow({
    entry,
    gridTemplateColumns,
    columnDefs,
    visibleColumns,
    hoveredTooth,
    onHoverTooth,
    hoveredRowId,
    onHoverRowId,
    expanded = false,
    onToggleExpand,
    onJumpToRule,
    onExcludeRuleForUnit,
    onReincludeRuleForUnit,
    onExcludeRuleForJob,
    onReincludeRuleForJob,
    jobExtraRules = [],
    jobExcludedRuleIds = []
}: JobTeethTableRowProps) {
    const { language } = useLanguage();
    const t = (key: string) => localT(language, key);
    const tooth = entry.tooth;
    const isHovered = hoveredRowId === entry.id || hoveredTooth === String(tooth.number);
    const isHidden = tooth.isIgnored === true;
    const isExtraRow = entry.kind !== 'tooth';
    const isJobExtraRow = entry.kind === 'jobExtra';

    const getRowBackground = () => {
        if (isHovered) return 'action.hover';
        if (isHidden) return 'action.disabled';
        return 'inherit';
    };
    const rowBackground = getRowBackground();

    const isRowExcluded = !!tooth.isExcluded;

    // The unit-scoped rules that show up in the expanded list. We only
    // expand `tooth` rows so the chevron is hidden for `unitExtra`,
    // `jobExtra`, and `hiddenHeader` rows.
    const canExpand = entry.kind === 'tooth';
    const unitRules = (tooth.appliedRules || []).filter((rule) => rule.kind === 'base' || rule.kind === 'unitExtra' || rule.kind === 'ignoreUnit');

    const handleMouseEnter = () => {
        if (entry.kind === 'tooth') {
            onHoverTooth(String(tooth.number));
            onHoverRowId(entry.id);
        }
    };
    const handleMouseLeave = () => {
        if (entry.kind === 'tooth') {
            onHoverTooth(null);
            onHoverRowId(null);
        }
    };

    return (
        <>
            <Box
                className={`job-teeth-table-row${isRowExcluded ? ' is-excluded' : ''}${isJobExtraRow ? ' is-job-extra' : ''}${isExtraRow ? ' is-extra-row' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...{
                    style: {
                        '--row-grid-columns': gridTemplateColumns,
                        '--row-background': rowBackground,
                        '--row-opacity': isHidden && !isExtraRow ? 0.7 : 1
                    } as React.CSSProperties
                }}
            >
                {/* Chevron toggle cell - first column, 48px wide. Width must match
                 *  `CHEVRON_COLUMN_WIDTH` in `JobTeethTable.tsx` so the row grid and
                 *  the header grid stay aligned. */}
                <Box className="flex-cell chevron-cell">
                    {canExpand && onToggleExpand ? (
                        <ResponsiveTooltip title={expanded ? t('collapseRules') : t('expandRules')}>
                            <IconButton
                                size="small"
                                aria-label={expanded ? t('collapseRules') : t('expandRules')}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExpand();
                                }}
                                className="expand-chevron"
                            >
                                {expanded ? <KeyboardArrowDownIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                            </IconButton>
                        </ResponsiveTooltip>
                    ) : (
                        <Box className="expand-chevron-placeholder" />
                    )}
                </Box>
                {columnDefs.filter(col => visibleColumns[col.id] !== false).map(col => {
                    const isExcluded = isRowExcluded;

                    const getJustification = () => {
                        if (col.align === 'center') return 'center';
                        if (col.align === 'right') return 'flex-end';
                        return 'flex-start';
                    };

                    const isStrikethroughCol = col.id === 'material' || col.id === 'type' || col.id === 'status';

                    return (
                        <Box
                            key={col.id}
                            className={`flex-cell row-cell${col.id === 'number' ? ' is-number-col' : ''}`}
                            {...{
                                style: {
                                    '--cell-justify': getJustification(),
                                    '--cell-color': isExtraRow ? 'text.secondary' : 'inherit'
                                } as React.CSSProperties
                            }}
                        >
                            <Box
                                className={`inner-content${(isExcluded && isStrikethroughCol) ? ' is-strikethrough' : ''}`}
                                data-vdt-measure-col={col.id}
                            >
                                {col.renderCell ? col.renderCell(entry, 0) : null}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
            {canExpand && (
                <Collapse
                    in={expanded}
                    timeout={150}
                    unmountOnExit
                    className="applied-rules-chevron-content"
                >
                    <Box className="applied-rules-panel">
                        {unitRules.length === 0 && jobExtraRules.length === 0 ? (
                            <Typography variant="caption" color="text.secondary" className="applied-rules-empty">
                                {t('noAppliedRules')}
                            </Typography>
                        ) : (
                            <List dense className="applied-rules-list">
                                {unitRules.map((rule) => (
                                    <AppliedRuleBullet
                                        key={`unit-${rule.id}`}
                                        rule={rule}
                                        kind="unit"
                                        onJumpToRule={onJumpToRule}
                                        onExclude={() => onExcludeRuleForUnit?.(rule.id)}
                                        onReinclude={() => onReincludeRuleForUnit?.(rule.id)}
                                        t={t}
                                    />
                                ))}
                                {jobExtraRules.map((rule) => {
                                    const isJobExcluded = jobExcludedRuleIds.includes(rule.id);
                                    return (
                                        <AppliedRuleBullet
                                            key={`job-${rule.id}`}
                                            rule={rule}
                                            kind="job"
                                            isExcluded={isJobExcluded}
                                            onJumpToRule={onJumpToRule}
                                            onExclude={() => onExcludeRuleForJob?.(rule.id)}
                                            onReinclude={() => onReincludeRuleForJob?.(rule.id)}
                                            t={t}
                                        />
                                    );
                                })}
                            </List>
                        )}
                    </Box>
                </Collapse>
            )}
        </>
    );
}, (prev, next) =>
    prev.entry === next.entry &&
    prev.hoveredTooth === next.hoveredTooth &&
    prev.hoveredRowId === next.hoveredRowId &&
    prev.columnDefs === next.columnDefs &&
    prev.expanded === next.expanded &&
    prev.jobExtraRules === next.jobExtraRules &&
    prev.jobExcludedRuleIds === next.jobExcludedRuleIds
);

/**
 * A single bullet in the expanded rule list. Renders the rule name, a
 * kind chip, the incurred cost, and the two icon-only actions.
 */
interface AppliedRuleBulletProps {
    rule: AppliedRuleBreakdown;
    kind: 'unit' | 'job';
    /** Already-excluded state for the bullet. For `unit` bullets the
     * parent derives this from the rule's own `isExcluded` flag. For
     * `job` bullets the parent derives it from the job's
     * `excludedRuleIds` set. */
    isExcluded?: boolean;
    onJumpToRule?: (ruleId: string) => void;
    onExclude?: () => void;
    onReinclude?: () => void;
    t: (key: string) => string;
}

const ruleKindChipColor = (kind: string): 'primary' | 'warning' | 'secondary' | 'error' | 'info' | 'success' => {
    if (kind === 'base') return 'primary';
    if (kind === 'unitExtra') return 'warning';
    if (kind === 'jobExtra') return 'secondary';
    if (kind === 'ignoreUnit') return 'success';
    if (kind === 'invalid') return 'error';
    if (kind === 'review') return 'info';
    return 'default' as 'primary';
};

const AppliedRuleBullet = ({ rule, kind, isExcluded, onJumpToRule, onExclude, onReinclude, t }: AppliedRuleBulletProps) => {
    const localIsExcluded = isExcluded ?? !!rule.isExcluded;
    const ruleKind = rule.kind;
    return (
        <ListItem
            disableGutters
            className={`applied-rule-bullet${localIsExcluded ? ' is-excluded' : ''}`}
            secondaryAction={
                <Box className="applied-rule-actions">
                    <ResponsiveTooltip title={t('editRule')}>
                        <span>
                            <IconButton
                                size="small"
                                edge="end"
                                aria-label={t('editRule')}
                                onClick={() => onJumpToRule?.(rule.id)}
                                className="applied-rule-action-button applied-rule-edit"
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </ResponsiveTooltip>
                    <ResponsiveTooltip title={t(localIsExcluded ? 'reincludeRule' : 'excludeRule')}>
                        <span>
                            <IconButton
                                size="small"
                                edge="end"
                                aria-label={t(localIsExcluded ? 'reincludeRule' : 'excludeRule')}
                                disabled={localIsExcluded || !onExclude}
                                onClick={onExclude}
                                className="applied-rule-action-button applied-rule-exclude"
                            >
                                <BlockIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </ResponsiveTooltip>
                    <ResponsiveTooltip title={t('reincludeRule')}>
                        <span>
                            <IconButton
                                size="small"
                                edge="end"
                                aria-label={t('reincludeRule')}
                                disabled={!localIsExcluded || !onReinclude}
                                onClick={onReinclude}
                                className="applied-rule-action-button applied-rule-reinclude"
                            >
                                <ArrowBackIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </ResponsiveTooltip>
                </Box>
            }
        >
            <Box className="applied-rule-bullet-marker" aria-hidden="true" />
            <Box className="applied-rule-bullet-primary">
                <Typography
                    variant="body2"
                    component="span"
                    className={`applied-rule-name${localIsExcluded ? ' is-excluded' : ''}`}
                >
                    {rule.name}
                </Typography>
                <Chip
                    size="small"
                    label={t(`ruleKind.${ruleKind}`)}
                    color={ruleKindChipColor(ruleKind)}
                    variant="outlined"
                    className="applied-rule-kind-chip"
                />
                {kind === 'job' && (
                    <Chip
                        size="small"
                        label={t('jobScope')}
                        color="secondary"
                        variant="outlined"
                        className="applied-rule-scope-chip"
                    />
                )}
                <Typography variant="caption" component="span" className="applied-rule-cost">
                    {rule.amount > 0 ? `+${formatCurrency(rule.amount, rule.currency)}` : formatCurrency(0, rule.currency)}
                </Typography>
            </Box>
        </ListItem>
    );
};

export default JobTeethTableRow;
