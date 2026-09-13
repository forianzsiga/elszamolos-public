/** @file JobRowActions - Action buttons (edit, discard, delete) for a single job row. */

import React from 'react';
import { Box, IconButton } from '@mui/material';
import { Edit, DoDisturbOn, Delete } from '@mui/icons-material';
import type { Job } from '../../types';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './JobRowActions-i11n.json';
import './JobRowActions.css';

/** Properties for the {@link JobRowActions} component. */
interface JobRowActionsProps {
    /** The job that this row of actions belongs to. */
    job: Job;
    /** Callback invoked when the user triggers the edit action. */
    onEdit: (job: Job) => void;
    /** Callback invoked when the user triggers the discard action. */
    onDiscard: (job: Job) => void;
    /** Callback invoked when the user triggers the delete action. Receives the job id. */
    onDelete: (id: string) => void;
}

/**
 * Action buttons rendered inside a job table row.
 *
 * Provides three contextual actions: Edit, Discard, and Delete. Each button
 * is wrapped in a {@link ResponsiveTooltip} and displays a translated label
 * from the component's i18n resource bundle.
 *
 * @param props         Component properties.
 * @param props.job     The job entity the actions operate on.
 * @param props.onEdit  Handler called when the edit button is clicked.
 * @param props.onDiscard  Handler called when the discard button is clicked.
 * @param props.onDelete   Handler called when the delete button is clicked.
 * @returns A JSX element containing three action icon buttons.
 */
export const JobRowActions: React.FC<JobRowActionsProps> = ({ job, onEdit, onDiscard, onDelete }) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;

    return (
        <Box className="job-row-actions">
            <ResponsiveTooltip title={localT('jobs.action.edit')}>
                <IconButton aria-label={localT('jobs.action.edit')} onClick={() => onEdit(job)} size="small" color="primary">
                    <Edit fontSize="small" />
                </IconButton>
            </ResponsiveTooltip>

            <ResponsiveTooltip title={localT('jobs.action.discard')}>
                <span>
                    <IconButton
                        aria-label={localT('jobs.action.discard')}
                        onClick={() => onDiscard(job)}
                        size="small"
                        color="error"
                        disabled={job.status === 'Discarded'}
                        className={job.status === 'Discarded' ? 'discard-action-discarded' : ''}
                    >
                        <DoDisturbOn fontSize="small" />
                    </IconButton>
                </span>
            </ResponsiveTooltip>

            <ResponsiveTooltip title={localT('jobs.actions.delete')}>
                <IconButton aria-label={localT('jobs.actions.delete')} onClick={() => onDelete(job.id)} size="small" color="error">
                    <Delete fontSize="small" />
                </IconButton>
            </ResponsiveTooltip>
        </Box>
    );
};

export default JobRowActions;
