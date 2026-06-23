/** @file JobEditModalActions.tsx - Actions bar rendered inside the Job Edit modal. Provides save, cancel, and optional delete buttons with tooltips and i18n support. */

import type { FC } from 'react';
import { DialogActions, Button, Box } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './JobEditModalActions-i11n.json';
import './JobEditModalActions.css';

/** Properties for the {@link JobEditModalActions} component. */
interface JobEditModalActionsProps {
    onClose: () => void;
    onSave: () => void;
    onDelete?: () => void;
    isManual: boolean;
}

/** Shape of the embedded translation JSON for the two supported languages (en, hu). */
interface TranslationSchema {
    en: Record<string, string>;
    hu: Record<string, string>;
}

/**
 * Actions bar rendered inside the DialogActions slot of the Job Edit modal.
 * Displays a delete button (when `onDelete` is provided), a cancel button, and a
 * save/create button whose label depends on the `isManual` flag.
 *
 * @param props - Component properties.
 * @param props.onClose - Callback invoked when the cancel action is triggered.
 * @param props.onSave - Callback invoked when the save/create action is triggered.
 * @param props.onDelete - Optional callback invoked when the delete action is triggered. The delete button is hidden when omitted.
 * @param props.isManual - If `true` the save button reads "Create"; otherwise it reads "Save Changes".
 * @returns The rendered dialog actions fragment.
 */
export const JobEditModalActions: FC<JobEditModalActionsProps> = ({ onClose, onSave, onDelete, isManual }) => {
    const { language } = useLanguage();
    /**
     * Resolves a translation key against the current language from the embedded JSON.
     * Falls back to the key itself when no translation is found.
     *
     * @param key - Dot-notation key to look up in the translation map (e.g. `"common.cancel"`).
     * @returns The translated string or the key as a fallback.
     */
    const localT = (key: string) => (i11n as TranslationSchema)[language as 'en' | 'hu']?.[key] || key;

    return (
        <DialogActions className={`job-edit-modal-actions ${onDelete ? 'has-delete' : ''}`}>
            {onDelete && (
                <ResponsiveTooltip title={localT('common.deleteTooltip')}>
                    <Button onClick={onDelete} color="error" variant="outlined">
                        {localT('common.delete')}
                    </Button>
                </ResponsiveTooltip>
            )}
            <Box className="action-buttons-container">
                <ResponsiveTooltip title={localT('common.cancelTooltip')}>
                    <Button onClick={onClose}>{localT('common.cancel')}</Button>
                </ResponsiveTooltip>
                {isManual ? (
                    <ResponsiveTooltip title={localT('jobEdit.createTooltip')}>
                        <Button onClick={onSave} variant="contained" color="primary">
                            {localT('jobEdit.create')}
                        </Button>
                    </ResponsiveTooltip>
                ) : (
                    <ResponsiveTooltip title={localT('jobEdit.saveChangesTooltip')}>
                        <Button onClick={onSave} variant="contained" color="primary">
                            {localT('jobEdit.saveChanges')}
                        </Button>
                    </ResponsiveTooltip>
                )}
            </Box>
        </DialogActions>
    );
};

/** Default export – alias for the named {@link JobEditModalActions} component. */
export default JobEditModalActions;
