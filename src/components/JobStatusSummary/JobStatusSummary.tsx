/** @file JobStatusSummary - Renders a horizontal bar of summary items showing job counts by status. */

import { memo } from 'react';
import { Box } from '@mui/material';
import { CheckCircle, Pending, Info, DoDisturbOn, Receipt } from '@mui/icons-material';
import type { Job } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { JobStatusSummaryItem } from '../JobStatusSummaryItem';
import i11n from './JobStatusSummary-i11n.json';
import './JobStatusSummary.css';

/**
 * Internal component that aggregates job statuses and renders a row of status summary items.
 *
 * @param props - Component props.
 * @param props.jobs - Array of jobs to summarize.
 * @returns A Box containing one JobStatusSummaryItem per status category.
 */
const JobStatusSummaryComponent = ({ jobs }: { jobs: Job[] }) => {
    const { language } = useLanguage();
    const i11nTyped: Record<'en' | 'hu', Record<string, string>> = i11n;
    const localT = (key: string) => i11nTyped[language as 'en' | 'hu']?.[key] || key;

    const invoicedJobs = jobs.filter(j => j.status === 'Invoiced').length;
    const appliedJobs = jobs.filter(j => j.status === 'Calculated').length;
    const pendingJobs = jobs.filter(j => j.status === 'Pending').length;
    const ignoredJobs = jobs.filter(j => j.status === 'Discarded').length;
    const reviewJobs = jobs.filter(j => j.status === 'Review' || j.status === 'Invalid').length;

    const statusMap: { key: string; count: number; icon: React.ReactNode; label: string; tooltip: string; colorKey: 'primary' | 'success' | 'warning' | 'error' | 'default' }[] = [
        { 
            key: 'invoiced', 
            count: invoicedJobs, 
            icon: <Receipt />, 
            label: localT('status.invoiced'),
            tooltip: localT('statusTooltip.invoiced'),
            colorKey: 'primary'
        },
        { 
            key: 'applied', 
            count: appliedJobs, 
            icon: <CheckCircle />, 
            label: localT('status.applied'),
            tooltip: localT('statusTooltip.applied'),
            colorKey: 'success'
        },
        { 
            key: 'pending', 
            count: pendingJobs, 
            icon: <Pending />, 
            label: localT('status.pending'),
            tooltip: localT('statusTooltip.pending'),
            colorKey: 'default' 
        },
        { 
            key: 'review', 
            count: reviewJobs, 
            icon: <Info />, 
            label: localT('status.review'),
            tooltip: localT('statusTooltip.review'),
            colorKey: 'warning'
        },
        { 
            key: 'ignored', 
            count: ignoredJobs, 
            icon: <DoDisturbOn />, 
            label: localT('status.ignored'),
            tooltip: localT('statusTooltip.ignored'),
            colorKey: 'error'
        },
    ];

    return (
        <Box
            className="job-status-summary-container"
        >
            {statusMap.map((status) => (
                <JobStatusSummaryItem
                    key={status.key}
                    icon={status.icon}
                    label={status.label}
                    count={status.count}
                    tooltip={status.tooltip}
                    colorKey={status.colorKey}
                />
            ))}
        </Box>
    );
};

/**
 * Memoized summary component that displays a row of job status counts with icons, labels, and tooltips.
 *
 * @remarks
 * Wraps {@link JobStatusSummaryComponent} with React.memo to avoid unnecessary re-renders when
 * the jobs array reference does not change.
 */
export const JobStatusSummary = memo(JobStatusSummaryComponent);
