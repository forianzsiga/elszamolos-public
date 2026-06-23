/** @file JobManagerHeader.tsx
 * @brief Header component for the Job Manager, providing action buttons and a job status summary.
 *
 * This component displays the "Jobs" title alongside a {@link JobStatusSummary},
 * then renders configurable action buttons (Add Manual, Import/Export JSON,
 * Import Folder, Recalculate) depending on developer mode and import state.
 */

import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { CloudUpload, Calculate, DataObject, Add } from '@mui/icons-material';
import { JobStatusSummary } from '../JobStatusSummary/JobStatusSummary';
import { useLanguage } from '../../context/LanguageContext';
import type { Job } from '../../types';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './JobManagerHeader-i11n.json';
import './JobManagerHeader.css';

/** Props for the {@link JobManagerHeader} component. */
interface JobManagerHeaderProps {
    /** The full list of jobs used to render a status summary. */
    jobs: Job[];
    /** When true, developer-only buttons (Import/Export JSON) are shown. */
    isDeveloperMode: boolean;
    /** When true, the Import Folder button is disabled and shows a scanning label. */
    importing: boolean;
    /** Callback fired when the "Import JSON" button is clicked. */
    onImportJsonClick: () => void;
    /** Callback fired when the "Export JSON" button is clicked. */
    onExportJobs: () => void;
    /** Callback fired when the "Import Folder" button is clicked. */
    onImport: () => void;
    /** Callback fired when the "Recalculate" button is clicked. */
    onRecalculate: () => void;
    /** Callback fired when the "Add Manual" button is clicked. */
    onAddManual: () => void;
}

/**
 * Header bar for the Job Manager page.
 *
 * Renders a title row with a {@link JobStatusSummary} and a toolbar of contextual
 * action buttons. The "Add Manual" button is always visible; the Import/Export JSON
 * buttons appear only when {@link JobManagerHeaderProps.isDeveloperMode | isDeveloperMode}
 * is enabled; the "Import Folder" button reflects the current
 * {@link JobManagerHeaderProps.importing | importing} state.
 *
 * @param props - Component props.
 * @param props.jobs - The full job list (used by the status summary).
 * @param props.isDeveloperMode - Whether developer-mode buttons are visible.
 * @param props.importing - Whether an import operation is in progress.
 * @param props.onImportJsonClick - Handler for the Import JSON button.
 * @param props.onExportJobs - Handler for the Export JSON button.
 * @param props.onImport - Handler for the Import Folder button.
 * @param props.onRecalculate - Handler for the Recalculate button.
 * @param props.onAddManual - Handler for the Add Manual button.
 * @returns A React element containing the header title, status summary, and action buttons.
 */
export const JobManagerHeader: React.FC<JobManagerHeaderProps> = ({
    jobs,
    isDeveloperMode,
    importing,
    onImportJsonClick,
    onExportJobs,
    onImport,
    onRecalculate,
    onAddManual
}) => {
    const { language } = useLanguage();
    const typedI11n = i11n as Record<'en' | 'hu', Record<string, string>>;
    const langKey = (language === 'en' || language === 'hu') ? language : 'en';
    const localT = (key: string) => typedI11n[langKey]?.[key] || key;

    const actionButtonClassName = "job-manager-action-button";

    return (
        <Box className="job-manager-header">
            <Box>
                <Typography variant="h4" className="job-manager-header-title">{localT('jobs.title')}</Typography>
                <Box className="job-manager-header-status">
                    <JobStatusSummary jobs={jobs} />
                </Box>
            </Box>

            <Box
                className={`job-manager-header-actions ${isDeveloperMode ? 'is-developer' : ''}`}
            >
                <ResponsiveTooltip title={localT('jobs.actions.addManualTooltip')}>
                    <Button 
                        variant="outlined" 
                        startIcon={<Add />}
                        onClick={onAddManual}
                        className={actionButtonClassName}
                    >
                        {localT('jobs.actions.addManual')}
                    </Button>
                </ResponsiveTooltip>
                {isDeveloperMode && (
                    <>
                        <ResponsiveTooltip title={localT('jobs.actions.importJsonTooltip')}>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DataObject />}
                                onClick={onImportJsonClick}
                                className={actionButtonClassName}
                            >
                                {localT('jobs.actions.importJson')}
                            </Button>
                        </ResponsiveTooltip>
                        <ResponsiveTooltip title={localT('jobs.actions.exportJsonTooltip')}>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DataObject />}
                                onClick={onExportJobs}
                                className={actionButtonClassName}
                            >
                                {localT('jobs.actions.exportJson')}
                            </Button>
                        </ResponsiveTooltip>
                    </>
                )}
                <ResponsiveTooltip title={localT('jobs.actions.importFolderTooltip')}>
                    <Button 
                        variant="contained"  
                        startIcon={<CloudUpload />} 
                        onClick={onImport}
                        disabled={importing}
                        className={actionButtonClassName}
                    >
                        {importing ? localT('jobs.actions.scanning') : localT('jobs.actions.importFolder')}
                    </Button>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('jobs.actions.recalculateTooltip')}>
                    <Button 
                        variant="outlined" 
                        startIcon={<Calculate />} 
                        onClick={onRecalculate}
                        className={actionButtonClassName}
                    >
                        {localT('jobs.actions.recalculate')}
                    </Button>
                </ResponsiveTooltip>
            </Box>
        </Box>
    );
};
