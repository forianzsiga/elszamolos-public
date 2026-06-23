/**
 * @file JobRow.tsx
 * @description Renders a single job row in the jobs list table, including expandable
 *   collapsible content with teeth tables, a teeth visualizer, a 3D model viewer, and
 *   job metadata footer. Supports selection, editing, duplication detection, and
 *   per-column visibility.
 */

import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { Box, Typography, Checkbox, IconButton } from '@mui/material';
import { InfoOutlined, Check, Close, OpenInFull } from '@mui/icons-material';
import type { Job } from '../../types';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { generateJobHash } from '../../utils/hash';
import { GridCell } from '../GridCell';
import { formatCurrency, formatMixedCurrency, getDominantValueSummary } from '../../utils/text';
import { MaterialCell } from '../MaterialCell';
import { JobStatusChip } from '../JobStatusChip';
import { useLanguage } from '../../context/LanguageContext';
import { JobRowActions } from '../JobRowActions';
import { dbService } from '../../services/db';
import './JobRow.css';
import i11n from './JobRow-i11n.json';

/**
 * Localised string lookup table for this component.
 * @interface I11n
 */
interface I11n {
    en: Record<string, string>;
    hu: Record<string, string>;
}

const i11nTyped = i11n as I11n;

/**
 * Props for the {@link JobRow} component.
 * @interface JobRowProps
 */
interface JobRowProps {
    /** The job to render. */
    job: Job;
    /** Whether this row is currently selected. */
    selected: boolean;
    /** Callback fired when the selection checkbox is toggled. */
    onSelectionChange: (id: string, selected: boolean) => void;
    /** Callback to open the job editor. */
    onEdit: (job: Job) => void;
    /** Callback to discard changes and revert the job. */
    onDiscard: (job: Job) => void;
    /** Callback to delete the job by its id. */
    onDelete: (id: string) => void;
    /** Map of column identifiers to their visibility. */
    visibleColumns: Record<string, boolean>;
    /** CSS `grid-template-columns` value for the row grid. */
    gridTemplateColumns: string;
    /** Whether this job is flagged as a duplicate. */
    isDuplicate?: boolean;
}

/**
 * Formats an ISO date string to a short locale date.
 * @param {string} v - ISO date string.
 * @returns {string} Locale-formatted date.
 */
const dateFormatter = (v: string) => new Date(v).toLocaleDateString();

/**
 * `JobRow` renders a single job as a row in the jobs list. Each row shows
 * selection checkbox, creation date, status, type, material, unit count, price,
 * and action buttons. When expanded, the row reveals a collapsible section
 * containing a teeth table, a teeth visualiser, an optional 3D model viewer,
 * and a metadata footer.
 *
 * The component is wrapped in `React.memo` and only re-renders when `job`,
 * `selected`, `visibleColumns`, `gridTemplateColumns`, or `isDuplicate`
 * change.
 *
 * @param {JobRowProps} props - Component props.
 * @returns {JSX.Element} The job row element.
 */
export const JobRow = React.memo(({ job, selected, onSelectionChange, onEdit, onDiscard, onDelete, visibleColumns, gridTemplateColumns, isDuplicate }: JobRowProps) => {
    const { language, t } = useLanguage();
    const localT = (key: string) => i11nTyped[language as 'en' | 'hu']?.[key] || key;
    
    // Memoize expensive calculations
    const isModified = useMemo(() => {
        return !!job.originalHash && generateJobHash(job) !== job.originalHash;
    }, [job]); 

    const materialSummary = useMemo(() => getDominantValueSummary(job.teeth, 'material'), [job.teeth]);
    const typeSummary = useMemo(() => getDominantValueSummary(job.teeth, 'type'), [job.teeth]);

    const rowRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (rowRef.current) {
            rowRef.current.style.setProperty('--grid-template-columns', gridTemplateColumns);
        }
    }, [gridTemplateColumns]);

    const stlUnits = useMemo(() => {
        return (job.teeth || []).filter(t => t.number === 0 && t.type === '3D Model' && !t.isIgnored);
    }, [job.teeth]);

    const statusTooltipTitle = useMemo(() => {
        if (job.status === 'Pending' && job.unitCount > 0) {
            const visibleTeeth = job.teeth ? job.teeth.filter(t => !t.isIgnored) : [];
            const total = visibleTeeth.length;
            const matched = visibleTeeth.filter(t => t.status && t.status !== 'Pending').length;
            const pending = total - matched;
            return t('statusTooltip.pendingDetail')
                .replace('{matched}', String(matched))
                .replace('{pending}', String(pending));
        }
        if (job.status === 'Calculated') return t('statusTooltip.applied');
        const statusKey = job.status ? job.status.toLowerCase() : '';
        return t(`statusTooltip.${statusKey}`) || t(`status.${statusKey}`) || job.status || '';
    }, [job.status, job.unitCount, job.teeth, t]);

    const displayUnitCount = useMemo(() => {
        if (!job.teeth || !Array.isArray(job.teeth)) {
            return job.unitCount || 0;
        }
        const visibleCount = job.teeth.filter(t => !t.isIgnored).length;
        if (visibleCount !== job.unitCount) {
             return `${visibleCount} (${(job.unitCount || 0) - visibleCount})`;
        }
        return job.unitCount;
    }, [job.teeth, job.unitCount]);

    const displayPrice = useMemo(() => {
        if (!job.price) return '-';
        if (job.currency === 'MIXED') return formatMixedCurrency([job]);
        return formatCurrency(job.price, job.currency);
    }, [job]);

    const [isHovered, setIsHovered] = useState(false);
    const [isStlMissing, setIsStlMissing] = useState(false);

    useEffect(() => {
        let active = true;
        const checkStlAvailability = async () => {
            const projectPrefix = (job.fileName || '').toLowerCase().replace('.dentalproject', '');
            const registry = window.localFileHandles || {};
            
            const hasInMemory = Object.keys(registry).some(key => {
                const k = key.toLowerCase();
                return k.startsWith(projectPrefix + '-') && k.endsWith('.stl');
            });

            if (hasInMemory) {
                if (active) setIsStlMissing(false);
                return;
            }

            try {
                const assets = await dbService.getAssetsByJob(job.id);
                const hasInDb = assets.some(a => {
                    const fname = a.fileName.toLowerCase();
                    return fname.startsWith(projectPrefix + '-') && fname.endsWith('.stl');
                });
                if (active) setIsStlMissing(!hasInDb);
            } catch (err) {
                console.error(err);
                if (active) setIsStlMissing(true);
            }
        };

        checkStlAvailability();
        return () => {
            active = false;
        };
    }, [job]);

    const getStateInfo = () => {
        if (isDuplicate) return { tooltip: t('jobs.status.duplicate'), color: '#ffd700' };
        if (isModified) return { tooltip: t('jobs.status.modified'), color: 'cyan' };
        return { tooltip: t('jobs.status.original'), color: 'action.disabled' };
    };
    const { tooltip: stateTooltip } = getStateInfo();

    const tooltip3d = isStlMissing 
        ? localT('stlMissingTooltip')
        : (t('jobs.3dAvailable') || '3D Models available. Expand row to view.');

    let stateClass: string;
    if (isDuplicate) stateClass = 'duplicate';
    else if (isModified) stateClass = 'modified';
    else stateClass = 'original';

    return (
        <ResponsiveTooltip title={localT('editJob')}>
            <Box
                id={`job-row-${job.id}`}
                className={`job-row ${selected ? 'Mui-selected' : ''} ${isHovered ? 'hovered' : ''}`}
                tabIndex={0}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target && target.closest && target.closest('button, a, input, textarea, select, [role="button"], .MuiCheckbox-root')) {
                        return;
                    }
                    onEdit(job);
                }}
                onKeyDown={(e) => {
                    const key = e.key;
                    if (key === 'Enter' || key === ' ') {
                        const target = e.target as HTMLElement;
                        if (target && target.closest && target.closest('button, a, input, textarea, select, [role="button"]')) {
                            return;
                        }
                        e.preventDefault();
                        onEdit(job);
                    }
                }}
                ref={rowRef}
            >
                <GridCell align="center" measure={false}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <ResponsiveTooltip title={localT('selectJob')}>
                            <Checkbox 
                                checked={selected}
                                onChange={(e) => onSelectionChange(job.id, e.target.checked)}
                                size="small"
                            />
                        </ResponsiveTooltip>
                        <ResponsiveTooltip title={localT('editJob')}>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(job);
                                }}
                            >
                                <OpenInFull fontSize="small" />
                            </IconButton>
                        </ResponsiveTooltip>
                    </Box>
                </GridCell>

                {visibleColumns.createdAt && (
                    <GridCell colId="createdAt">
                        {dateFormatter(job.createdAt)}
                    </GridCell>
                )}
                
                {visibleColumns.status && (
                    <GridCell colId="status">
                        <ResponsiveTooltip title={statusTooltipTitle}>
                            <Box>
                                <JobStatusChip job={job} />
                            </Box>
                        </ResponsiveTooltip>
                    </GridCell>
                )}
                {visibleColumns.state && (
                    <GridCell colId="state" align="center">
                        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                            <ResponsiveTooltip title={stateTooltip}>
                                <InfoOutlined 
                                    className={`state-icon ${stateClass}`}
                                />
                            </ResponsiveTooltip>
                            {stlUnits.length > 0 && (
                                <ResponsiveTooltip title={tooltip3d}>
                                    <Box className="threed-label">
                                        {localT('3d')}{isStlMissing ? '*' : ''}
                                    </Box>
                                </ResponsiveTooltip>
                            )}
                        </Box>
                    </GridCell>
                )}
            {visibleColumns.patientName && (
                <GridCell colId="patientName">
                    <Typography variant="body2" noWrap title={job.patientName}>{job.patientName}</Typography>
                </GridCell>
            )}
            {visibleColumns.doctorName && (
                <GridCell colId="doctorName">
                    <Typography variant="body2" noWrap title={job.doctorName}>{job.doctorName}</Typography>
                </GridCell>
            )}
            {visibleColumns.projectId && (
                <GridCell colId="projectId">
                    <Typography variant="body2" noWrap title={job.projectId}>{job.projectId || '-'}</Typography>
                </GridCell>
            )}
            {visibleColumns.originalHash && (
                <GridCell colId="originalHash">
                    <Typography variant="caption" noWrap title={job.originalHash}>{job.originalHash ? job.originalHash.substring(0, 8) + '...' : '-'}</Typography>
                </GridCell>
            )}
            {visibleColumns.type && (
                <GridCell colId="type">
                    <MaterialCell summary={typeSummary} />
                </GridCell>
            )}
            {visibleColumns.material && (
                <GridCell colId="material">
                    <MaterialCell summary={materialSummary} />
                </GridCell>
            )}
            {visibleColumns.unitCount && (
                <GridCell colId="unitCount" align="right">
                    {displayUnitCount}
                </GridCell>
            )}
            {visibleColumns.isScrewRetained && (
                <GridCell colId="isScrewRetained" align="center">
                    {job.teeth.some(t => t.isScrewRetained) ? (
                        <Check fontSize="small" color="success" />
                    ) : (
                        <Close fontSize="small" color="disabled" />
                    )}
                </GridCell>
            )}
            {visibleColumns.price && (
                <GridCell colId="price" align="right">
                    {displayPrice}
                </GridCell>
            )}
            
            {visibleColumns.actions && (
                <GridCell colId="actions" align="right" noBorder>
                    <JobRowActions 
                        job={job} 
                        onEdit={onEdit} 
                        onDiscard={onDiscard} 
                        onDelete={onDelete} 
                    />
                </GridCell>
            )}
        </Box>
        </ResponsiveTooltip>
    );
}, (prev, next) => {
    return prev.job === next.job && 
           prev.selected === next.selected &&
           prev.visibleColumns === next.visibleColumns &&
           prev.gridTemplateColumns === next.gridTemplateColumns &&
           prev.isDuplicate === next.isDuplicate;
});
