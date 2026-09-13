/**
 * @file JobStatusChip.tsx
 *
 * A colored chip component that visually represents the current processing status
 * of a dental job. Supports all {@link JobStatus} variants (Pending, Calculated,
 * Review, Invalid, Discarded, Invoiced, Manual) with a distinct colour per status.
 *
 * When a job is in the "Pending" state and `showProgress` is enabled, the chip
 * renders a horizontal gradient bar that reflects the ratio of teeth that have
 * already been matched versus the total visible teeth count.
 *
 * Labels are automatically translated via the project's {@link useLanguage}
 * context using the bundled `JobStatusChip-i11n.json` locale file.
 */

import React, { useLayoutEffect, useRef } from 'react';
import { Chip, type ChipProps, type SxProps, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Job, JobStatus } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './JobStatusChip-i11n.json';
import './JobStatusChip.css';

/**
 * Props accepted by the {@link JobStatusChip} component.
 *
 * @remarks
 * Omit the built-in `color` and `label` props from MUI's `ChipProps` because
 * both are computed internally based on the job status.
 */
interface JobStatusChipProps extends Omit<ChipProps, 'color' | 'label'> {
    job?: Job;
    status?: JobStatus | string;
    showProgress?: boolean;
}

/**
 * Renders an MUI {@link Chip} whose colour, label, and (optionally) gradient
 * progress bar are driven by the current status of a dental {@link Job}.
 *
 * @param props          - Standard component props.
 * @param props.job      - The full {@link Job} object. When provided its
 *                         `.status` field takes precedence over the standalone
 *                         `status` prop.
 * @param props.status   - A standalone status string used only when `job` is
 *                         not supplied. Falls back to `"Pending"` when both are
 *                         omitted.
 * @param props.showProgress - When `true` and the job status is `"Pending"`,
 *                         the chip renders a green gradient whose fill level
 *                         reflects the ratio of non-pending teeth to total
 *                         visible teeth. Defaults to `true`.
 * @param props.sx       - Optional MUI system style overrides merged into the
 *                         chip's `sx` prop after the computed status colours.
 * @param props          - Any additional valid MUI {@link ChipProps} forwarded
 *                         onto the underlying `<Chip>` element.
 * @returns An MUI `<Chip>` element with status-driven visual styling and an
 *          optionally translated and progress-aware label.
 */
export const JobStatusChip: React.FC<JobStatusChipProps> = ({ job, status, showProgress = true, sx: consumerSx, ...props }) => {
    const { language } = useLanguage();
    const theme = useTheme();
    const chipRef = useRef<HTMLDivElement>(null);
    
    const localT = (key: keyof typeof i11n.en) => i11n[language as 'en' | 'hu']?.[key] || key;

    const progressMainColor = theme.palette.success.dark;

    /**
     * Maps an internal status string to its translated label using the
     * {@link i11n} locale dictionary.
     *
     * @param status - The raw status string (e.g. `"Calculated"`, `"Review"`).
     * @returns The translated label for the active language, or the raw status
     *          string itself if no matching key is found.
     */
    const getStatusLabelTranslated = (status: string): string => {
        const keyMap: Record<string, keyof typeof i11n.en> = {
            'Calculated': 'status.applied',
            'Review': 'status.review',
            'Invalid': 'status.invalid',
            'Discarded': 'status.ignored',
            'Invoiced': 'status.invoiced',
            'Manual': 'status.manual',
            'Pending': 'status.pending',
        };
        const key = keyMap[status];
        return key ? localT(key) : status;
    };

    const currentStatus = job ? job.status : status || 'Pending';

    let bgColor = '';
    let borderColor = '';
    let textColor = '';
    let label = '';
    let className = 'job-status-chip';
    let chipSx: SxProps = {};

    // 1. Pending with Progress
    if (showProgress && job && job.status === 'Pending' && job.unitCount > 0) {
        const visibleTeeth = job.teeth ? job.teeth.filter(t => !t.isIgnored) : [];
        const total = visibleTeeth.length;
        const matched = visibleTeeth.filter(t => t.status && t.status !== 'Pending').length;
        const percent = total > 0 ? Math.min(100, (matched / total) * 100) : 0;

        const mainColor = progressMainColor;
        const emptyColor = alpha(mainColor, 0.3);
        
        bgColor = `linear-gradient(90deg, ${mainColor} ${percent}%, ${emptyColor} ${percent}%)`;
        borderColor = alpha(mainColor, 0.5);
        label = `${localT('status.pending')} (${matched}/${total})`;
        className += ' job-status-chip-filled';
        chipSx = {
            background: bgColor,
            borderColor,
            ...(consumerSx as object),
        };
    } else if (currentStatus === 'Calculated') {
        bgColor = progressMainColor;
        borderColor = alpha(progressMainColor, 0.5);
        textColor = '#fff';
        label = getStatusLabelTranslated(currentStatus);
        className += ' job-status-chip-filled';
        chipSx = {
            background: bgColor,
            borderColor,
            ...(consumerSx as object),
        };
    } else {
        // Determine Color based on Status
        let color: string;
        switch (currentStatus) {
            case 'Review':
            case 'Invalid':
                color = theme.palette.warning.main;
                break;
            case 'Discarded':
                color = theme.palette.error.main;
                break;
            case 'Invoiced':
                color = theme.palette.primary.main;
                break;
            case 'Manual':
                color = '#e91e63';
                break;
            case 'Pending':
            default:
                color = theme.palette.text.primary;
                break;
        }
        bgColor = alpha(color, 0.12);
        borderColor = alpha(color, 0.5);
        textColor = color;
        label = getStatusLabelTranslated(currentStatus);
        chipSx = {
            bgcolor: bgColor,
            borderColor,
            color: textColor,
            ...(consumerSx as object),
        };
    }

    useLayoutEffect(() => {
        const el = chipRef.current;
        if (!el) return;
        el.style.setProperty('--chip-bg', bgColor);
        el.style.setProperty('--chip-border-color', borderColor);
        el.style.setProperty('--chip-color', textColor);
    }, [bgColor, borderColor, textColor]);

    return (
        <Chip 
            ref={chipRef}
            className={className}
            label={label}
            size="small"
            variant="outlined"
            sx={chipSx}
            {...props}
        />
    );
};


