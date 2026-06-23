/**
 * @file JobMetadataFooter.tsx
 *
 * Footer component that displays job metadata (status, ID, project ID, hash)
 * with duplicate and modification indicators. Provides a "Find Duplicates"
 * action for duplicate jobs.
 *
 * @author System
 */

import React from 'react';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { Box, Typography, Divider } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';
import type { Job } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { generateJobHash } from '../../utils/hash';
import i11n from './JobMetadataFooter-i11n.json';
import './JobMetadataFooter.css';

/**
 * Props for the JobMetadataFooter component.
 *
 * @interface JobMetadataFooterProps
 */
interface JobMetadataFooterProps {
    /** The job object whose metadata is displayed. */
    job: Job;
    /** Whether the job has been modified from its original state. */
    isModified?: boolean;
    /** Whether the job is flagged as a duplicate. */
    isDuplicate?: boolean;
    /** Callback invoked when the user clicks "Find Duplicates"; receives the original hash. */
    onFindDuplicates?: (hash: string) => void;
    /** Additional MUI system styles to merge into the root box. */
    sx?: SxProps<Theme>;
}

/**
 * Renders a footer bar displaying the current job's status badge (original /
 * modified / duplicate), job ID, project ID, and a truncated hash. For
 * duplicate jobs a "Find Duplicates" action button is shown. For modified
 * jobs the original hash is also displayed.
 *
 * @param props                     - Component props.
 * @param props.job                 - The job whose metadata to display.
 * @param props.isModified          - Whether the job differs from its original.
 * @param props.isDuplicate         - Whether the job is a suspected duplicate.
 * @param props.onFindDuplicates    - Callback to find jobs sharing the same hash.
 * @param props.sx                  - Additional MUI sx overrides.
 * @returns The rendered footer element.
 */
export const JobMetadataFooter: React.FC<JobMetadataFooterProps> = ({
    job,
    isModified = false,
    isDuplicate = false,
    onFindDuplicates,
    ...other
}) => {
    const { language } = useLanguage();
    const localT = (key: string) => {
        const lang = (language === 'en' || language === 'hu') ? language : 'en';
        return (i11n as Record<'en' | 'hu', Record<string, string>>)[lang][key] || key;
    };

    let stateTooltip = localT('status.original');

    if (isDuplicate) {
        stateTooltip = localT('status.duplicate');
    } else if (isModified) {
        stateTooltip = localT('status.modified');
    }

    return (
        <Box 
            className="job-metadata-footer"
            {...other}
        >
            <Box className="job-metadata-footer-status">
                <InfoOutlined
                    className={(() => {
                        if (isDuplicate) return 'job-metadata-footer-status-icon is-duplicate';
                        if (isModified) return 'job-metadata-footer-status-icon is-modified';
                        return 'job-metadata-footer-status-icon';
                    })()}
                    fontSize="small"
                />
                <Typography className="job-metadata-footer-status-text" variant="caption" fontWeight="bold">
                    {stateTooltip}
                </Typography>
            </Box>

            {isDuplicate && job.originalHash && onFindDuplicates && (
                <>
                    <Divider orientation="vertical" flexItem />
                    <ResponsiveTooltip title={localT('action.findDuplicatesTooltip')}>
                        <Box 
                            className="job-metadata-footer-action"
                            onClick={() => onFindDuplicates(job.originalHash!)} 
                        >
                            {localT('action.findDuplicates')}
                        </Box>
                    </ResponsiveTooltip>
                </>
            )}

            <Divider orientation="vertical" flexItem />

            <Typography variant="caption">
                {localT('label.jobId')} <Box component="span" className="job-metadata-footer-monospace">{job.id || '-'}</Box>
            </Typography>

            <Divider orientation="vertical" flexItem />

            <Typography variant="caption">
                {localT('label.projectId')} <Box component="span" className="job-metadata-footer-monospace">{job.projectId || '-'}</Box>
            </Typography>

            <Divider orientation="vertical" flexItem />

            <Typography variant="caption">
                {localT('label.hash')} <Box component="span" className="job-metadata-footer-hash-monospace">{generateJobHash(job).substring(0, 12)}...</Box>
            </Typography>

            {isModified && job.originalHash && (
                <>
                    <Divider orientation="vertical" flexItem />
                    <Typography variant="caption">
                        {localT('label.orig')} <Box component="span" className="job-metadata-footer-hash-monospace">{job.originalHash.substring(0, 12)}...</Box>
                    </Typography>
                </>
            )}
        </Box>
    );
};
