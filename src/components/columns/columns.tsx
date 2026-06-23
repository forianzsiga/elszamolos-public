/**
 * @file Column definitions for the teeth table within a job view.
 * Provides renderers for tooth number, material, type, status, price,
 * and action columns. Priority and rule count are surfaced elsewhere
 * (priority in the rule list; rule count as a subtitle under the
 * status chip in the Status column).
 */

import { useMemo, useCallback } from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import { Delete, Edit, ContentCopy } from '@mui/icons-material';
import type { ColumnDef } from '../VirtualDataTable';
import type { JobTeethTableEntry } from '../../utils/teethTableUtils';
import { isEntryExcluded } from '../../utils/teethTableUtils';
import { stringToColor } from '../../utils/color';
import { formatCurrency } from '../../utils/text';
import { JobStatusChip } from '../JobStatusChip';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import type { AppliedRuleBreakdown, Tooth } from '../../types';
import i11n from './columns-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import './columns.css';

/**
 * Custom hook that builds column definitions for a teeth table.
 *
 * @param onDeleteTeeth - Optional callback invoked when the user requests deletion
 *                        of one or more teeth entries.
 * @param onEditTeeth   - Optional callback invoked when the user requests editing
 *                        of a single tooth entry.
 * @param onDuplicateTeeth - Optional callback invoked when the user requests
 *                            duplicating a single tooth entry.
 * @param jobExtraRules  - Job-level extra-rule breakdowns. Used by the Rule
 *                         column to count the rules shown in the chevron
 *                         expansion beneath each tooth row.
 * @returns An array of {@link ColumnDef} objects for rendering a
 *          {@link JobTeethTableEntry} data table.
 */
export const useTeethColumnDefs = (
    onDeleteTeeth?: (teeth: Tooth[]) => void,
    onEditTeeth?: (tooth: Tooth) => void,
    onDuplicateTeeth?: (tooth: Tooth) => void,
    jobExtraRules: AppliedRuleBreakdown[] = []
): ColumnDef<JobTeethTableEntry>[] => {
    const { language } = useLanguage();
    const localT = useMemo(() => (key: string) => (i11n[language as 'en' | 'hu'] as Record<string, string>)?.[key] || key, [language]);

    const renderNumber = useCallback((entry: JobTeethTableEntry) => {
        const accentColor = entry.kind === 'jobExtra' ? '#ffffff' : stringToColor(`${entry.tooth.type}-${entry.tooth.material}`);
        const bgColor = entry.kind === 'jobExtra' ? 'rgba(255,255,255,0.16)' : `${accentColor}22`;

        const isJobOrZero = entry.kind === 'jobExtra' || entry.tooth.number === 0;

        if (isJobOrZero) {
            const label = localT('job');
            return (
                <Box
                    className="number-container"
                    {...{ style: { '--accent-color': accentColor } as React.CSSProperties }}
                >
                    <Box
                        className="number-label"
                        {...{ style: { '--number-bg-color': bgColor } as React.CSSProperties }}
                    >
                        {label}
                    </Box>
                </Box>
            );
        }

        // Active/pending tooth row. The previous "excluded base rule" suffix
        // (`<n>.<k>`) and companion-number suffix are gone: the chevron
        // expansion beneath the row surfaces exclusions instead, and there
        // are no synthetic companion teeth to render.
        const label = String(entry.tooth.number);

        return (
            <Box
                className="number-container"
                {...{ style: { '--accent-color': accentColor } as React.CSSProperties }}
            >
                <Box
                    className="number-label"
                    {...{ style: { '--number-bg-color': bgColor } as React.CSSProperties }}
                >
                    {label}
                </Box>
            </Box>
        );
    }, [localT]);

    const renderStatus = useCallback((entry: JobTeethTableEntry) => {
        if (entry.kind === 'tooth' || (entry.kind === 'unitExtra' && !entry.extraRule)) {
            const isHidden = entry.tooth.isIgnored === true;
            const status = (entry.kind === 'unitExtra' && !entry.extraRule) ? 'Calculated' : (entry.tooth.status || 'Pending');

            // Count of rules applied to this unit, mirroring the predicate
            // the chevron-expanded bullet list uses:
            //   1. unit rules on `tooth.appliedRules` filtered to
            //      base / unitExtra / ignoreUnit
            //   2. job-level extra rules passed in via `jobExtraRules`
            // Shown as a small subtitle under the status chip; hidden when 0
            // to keep the cell clean for teeth that haven't been processed.
            let count = 0;
            if (entry.kind === 'tooth') {
                const unitRules = (entry.tooth.appliedRules || [])
                    .filter((rule) => rule.kind === 'base' || rule.kind === 'unitExtra' || rule.kind === 'ignoreUnit');
                count = unitRules.length + jobExtraRules.length;
            }

            return (
                <Box>
                    <JobStatusChip
                        status={status}
                        className="status-chip"
                    />
                    {isHidden && (
                        <Chip label={localT('teethTable.hidden')} className="hidden-chip" />
                    )}
                    {count > 0 && (
                        <Typography variant="caption" color="text.secondary" className="applied-rules-count">
                            {localT('teethTable.appliedRules').replace('{count}', String(count))}
                        </Typography>
                    )}
                </Box>
            );
        }

        return (
            <Chip
                label={localT('extraFee')}
                className="extra-fee-chip"
                variant="outlined"
            />
        );
    }, [localT, jobExtraRules]);

    const renderPrice = useCallback((entry: JobTeethTableEntry) => {
        if (entry.kind === 'tooth') {
            return entry.tooth.basePrice !== undefined ? formatCurrency(entry.tooth.basePrice, entry.tooth.currency) : '-';
        }

        const amount = entry.extraRule ? entry.extraRule.amount : (entry.tooth.price ?? 0);
        return (
            <Typography variant="body2" className="price-text">
                +{formatCurrency(amount, entry.extraRule?.currency || entry.tooth.currency)}
            </Typography>
        );
    }, []);

    return useMemo(() => [
        {
            id: 'number',
            label: localT('teethTable.toothNumber'),
            minWidth: 90,
            renderCell: renderNumber
        },
        {
            id: 'material',
            label: localT('teethTable.material'),
            minWidth: 120,
            flex: 1,
            renderCell: (entry: JobTeethTableEntry) => entry.kind === 'jobExtra' ? '-' : entry.tooth.material
        },
        {
            id: 'type',
            label: localT('teethTable.type'),
            minWidth: 120,
            flex: 1,
            renderCell: (entry: JobTeethTableEntry) => entry.kind === 'jobExtra' ? '-' : entry.tooth.type
        },
        {
            id: 'status',
            label: localT('teethTable.status'),
            minWidth: 120,
            flex: 1,
            align: 'center',
            renderCell: renderStatus
        },
        {
            id: 'price',
            label: localT('teethTable.price'),
            minWidth: 110,
            align: 'right',
            renderCell: renderPrice
        },
        {
            id: 'actions',
            label: localT('jobs.column.actions'),
            minWidth: 140,
            align: 'center',
            sortable: false,
            renderCell: (entry: JobTeethTableEntry) => {
                const isExcluded = isEntryExcluded(entry);
                if (entry.kind === 'unitExtra' || entry.kind === 'jobExtra') {
                    return (
                        <Typography variant="caption" color="text.secondary" className="rule-generated-text">
                            {localT(isExcluded ? 'excludedRule' : 'ruleGeneratedEntry')}
                        </Typography>
                    );
                }
                return (
                    <Box className="actions-container">
                        {onEditTeeth && (
                            <ResponsiveTooltip title={localT('jobs.action.edit')}>
                                <IconButton
                                    size="small"
                                    color="primary"
                                    disabled={isExcluded}
                                    onClick={() => onEditTeeth(entry.tooth)}
                                >
                                    <Edit fontSize="small" />
                                </IconButton>
                            </ResponsiveTooltip>
                        )}
                        {onDuplicateTeeth && (
                            <ResponsiveTooltip title={localT('jobs.action.duplicate')}>
                                <IconButton
                                    size="small"
                                    color="info"
                                    disabled={isExcluded}
                                    onClick={() => onDuplicateTeeth(entry.tooth)}
                                >
                                    <ContentCopy fontSize="small" />
                                </IconButton>
                            </ResponsiveTooltip>
                        )}
                        {onDeleteTeeth && (
                            <ResponsiveTooltip title={localT('jobs.actions.delete')}>
                                <IconButton
                                    size="small"
                                    color="error"
                                    disabled={isExcluded}
                                    onClick={() => onDeleteTeeth([entry.tooth])}
                                >
                                    <Delete fontSize="small" />
                                </IconButton>
                            </ResponsiveTooltip>
                        )}
                    </Box>
                );
            }
        }
    ], [localT, renderNumber, renderStatus, renderPrice, onEditTeeth, onDuplicateTeeth, onDeleteTeeth]);
};
