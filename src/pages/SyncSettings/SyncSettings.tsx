/**
 * @file SyncSettings.tsx
 * @description Google Drive sync settings page component.
 * Provides UI for signing in to Google Drive, creating backups of
 * jobs/rules/invoices/metadata, and restoring from a previous backup.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
    Box, Typography, Button, Paper, Alert, CircularProgress, 
    List, ListItem, ListItemIcon, ListItemText, Divider, Chip, IconButton 
} from '@mui/material';
import { 
    CloudUpload, CloudDownload, Google, CheckCircle, 
    Settings, Warning, Close 
} from '@mui/icons-material';
import { ResponsiveTooltip } from '../../components/ResponsiveTooltip';
import { googleDriveService, type DriveFile } from '../../services/googleDrive';
import { dbService } from '../../services/db';
import { useJobs } from '../../context/JobContext';
import { useTariffs } from '../../context/TariffContext';
import { useLanguage } from '../../context/LanguageContext';
import type { Job, Invoice } from '../../types';
import i11n from './SyncSettings-i11n.json';
import './SyncSettings.css';

/** Type definition for the localization JSON shape keyed by language code. */
type I11n = {
    [key in 'en' | 'hu']: {
        [key: string]: string;
    };
};

const typedI11n = i11n as I11n;

/** Union type representing an optional status alert with a severity level and message text. */
type StatusMsg = { type: 'success'|'error'|'info', text: string } | null;

/**
 * Renders the setup/configuration prompt shown when Google Drive is not configured.
 * Displays instructions for setting up required environment variables.
 * @param localT - Localization function mapping keys to translated strings.
 * @return A React element containing the setup instructions UI.
 */
const SetupView = ({ localT }: { localT: (key: string) => string }) => (
    <Paper variant="outlined" className="sync-setup-paper">
        <Box className="sync-setup-header">
            <Settings fontSize="large" color="disabled" />
            <Typography variant="h5">{localT('sync.setup')}</Typography>
        </Box>
        <Alert severity="warning" icon={false} className="sync-alert">
            <Warning className="sync-warning-icon sync-warning-icon-color" />
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {localT('sync.notConfigured')}
            </Typography>
            <Typography variant="body2" gutterBottom>
                {localT('sync.notConfiguredDesc')}
            </Typography>

            <Box className="sync-config-box">
                <Typography variant="subtitle2" fontWeight="bold">
                    {localT('sync.selfDeployed.question')}
                </Typography>
                <Typography variant="body2" className="sync-config-hint">
                    {localT('sync.selfDeployed.hint')}
                </Typography>
                
                <Box className="sync-env-box">
                    VITE_GOOGLE_CLIENT_ID=...<br/>
                    VITE_GOOGLE_API_KEY=...
                </Box>
            </Box>
        </Alert>
    </Paper>
);

/** Props for the SyncContent component. */
interface SyncContentProps {
    /** Whether the user is currently signed in to Google Drive. */
    signedIn: boolean;
    /** Current status alert to display, or null. */
    statusMsg: StatusMsg;
    /** Callback to update the status alert. */
    setStatusMsg: (msg: StatusMsg) => void;
    /** Whether a backup/restore operation is in progress. */
    loading: boolean;
    /** Localization function mapping keys to translated strings. */
    localT: (key: string) => string;
    /** Handler invoked when the user clicks Sign In. */
    handleSignIn: () => Promise<void>;
    /** Handler invoked when the user clicks Backup. */
    handleBackup: () => Promise<void>;
    /** Handler invoked when the user clicks Restore. */
    handleRestore: () => Promise<void>;
    /** The most recent Drive backup file, or null if none exists. */
    lastBackup: DriveFile | null;
}

/**
 * Renders the main sync panel: sign-in prompt or backup/restore controls.
 *
 * When the user is not signed in, shows a Google sign-in button. Once
 * signed in, displays backup and restore controls with status feedback.
 *
 * @param signedIn - Whether the user is currently signed in to Google Drive.
 * @param statusMsg - Current status alert to display, or null if none.
 * @param setStatusMsg - Callback to update or clear the status alert.
 * @param loading - Whether a backup or restore operation is in progress.
 * @param localT - Localization function mapping keys to translated strings.
 * @param handleSignIn - Handler invoked when the user clicks the Sign In button.
 * @param handleBackup - Handler invoked when the user clicks the Backup button.
 * @param handleRestore - Handler invoked when the user clicks the Restore button.
 * @param lastBackup - The most recent Drive backup file, or null if none exists.
 * @return A React element containing the sync UI.
 */
const SyncContent = ({ 
    signedIn, statusMsg, setStatusMsg, loading, localT, 
    handleSignIn, handleBackup, handleRestore, lastBackup 
}: SyncContentProps) => (
    <Box className="sync-main-container">
        <Paper variant="outlined" className="sync-main-paper">
            <Box className="sync-header">
                <Typography variant="h5" className="sync-title">
                    <Google color={signedIn ? "primary" : "disabled"} />
                    {localT('sync.title')}
                </Typography>
                {signedIn && (
                    <Chip 
                        label={localT('sync.connected')}
                        color="success" 
                        variant="outlined" 
                        icon={<CheckCircle />} 
                    />
                )}
            </Box>

            {statusMsg && (
                <Alert 
                    severity={statusMsg.type} 
                    action={
                        <ResponsiveTooltip title={localT('sync.closeTooltip')}>
                            <IconButton onClick={() => setStatusMsg(null)} color="inherit" size="small">
                                <Close fontSize="inherit" />
                            </IconButton>
                        </ResponsiveTooltip>
                    } 
                    className="sync-status-alert"
                >
                    {statusMsg.text}
                </Alert>
            )}

            {!signedIn ? (
                <Box className="sync-signin-box">
                    <Typography color="text.secondary" paragraph>
                        {localT('sync.signInDesc')}
                    </Typography>
                    <ResponsiveTooltip title={localT('sync.signInTooltip')}>
                        <Button 
                            variant="contained" 
                            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Google />}
                            onClick={handleSignIn}
                            disabled={loading}
                        >
                            {localT('sync.signIn')}
                        </Button>
                    </ResponsiveTooltip>
                </Box>
            ) : (
                <Box>
                    <List>
                        <ListItem>
                            <ListItemIcon><CloudUpload /></ListItemIcon>
                            <ListItemText 
                                primary={localT('sync.backup')} 
                                secondary={localT('sync.backupDesc')} 
                            />
                            <ResponsiveTooltip title={localT('sync.backupActionTooltip')}>
                                <Button 
                                    variant="contained" 
                                    onClick={handleBackup}
                                    disabled={loading}
                                >
                                    {localT('sync.backupAction')}
                                </Button>
                            </ResponsiveTooltip>
                        </ListItem>
                        <Divider variant="inset" component="li" />
                        <ListItem>
                            <ListItemIcon><CloudDownload /></ListItemIcon>
                            <ListItemText 
                                primary={localT('sync.restore')} 
                                secondary={lastBackup ? `${localT('sync.lastBackup')}${new Date(lastBackup.modifiedTime).toLocaleString()}` : localT('sync.noBackup')} 
                            />
                            <ResponsiveTooltip title={localT('sync.restoreActionTooltip')}>
                                <Button 
                                    variant="outlined" 
                                    onClick={handleRestore}
                                    disabled={loading || !lastBackup}
                                    color="warning"
                                >
                                    {localT('sync.restoreAction')}
                                </Button>
                            </ResponsiveTooltip>
                        </ListItem>
                    </List>
                    
                    <Box className="sync-note-box">
                        <Typography variant="caption" color="text.secondary" className="sync-note-text">
                            <Warning fontSize="small" />
                            <b>{localT('sync.note')}</b> {localT('sync.restoreWarning')}
                        </Typography>
                    </Box>
                </Box>
            )}
        </Paper>
    </Box>
);

/**
 * SyncSettings page component.
 *
 * Provides the full Google Drive synchronization flow:
 * - Detects whether Drive credentials are configured.
 * - If not configured, renders a setup prompt (SetupView).
 * - If configured, allows the user to sign in, create a backup of all
 *   local data (jobs, rules, invoices, metadata, settings), or restore
 *   from a previously uploaded backup file.
 *
 * @return A React element representing the complete sync settings page.
 */
export const SyncSettings = () => {
    const { dispatch: jobDispatch } = useJobs();
    const { dispatch: tariffDispatch } = useTariffs();
    const { language, setLanguage } = useLanguage();
    
    const localT = useCallback((key: string) => typedI11n[language as 'en' | 'hu']?.[key] || key, [language]);

    const [loading, setLoading] = useState(false);
    const [signedIn, setSignedIn] = useState(false);
    const [lastBackup, setLastBackup] = useState<DriveFile | null>(null);
    const [statusMsg, setStatusMsg] = useState<StatusMsg>(null);
    const [isConfigured, setIsConfigured] = useState(false);

    useEffect(() => {
        const configured = googleDriveService.isConfigured();
        setIsConfigured(configured);
        
        if (configured) {
            setLoading(true);
            googleDriveService.loadScripts()
                .then(() => setLoading(false))
                .catch(err => {
                    console.error(err);
                    setStatusMsg({ type: 'error', text: localT('sync.loadScriptsError') });
                    setLoading(false);
                });
        }
    }, [localT]);

    /**
     * Initiates Google Drive sign-in via the {@link googleDriveService}.
     *
     * On success, marks the user as signed in and checks for an existing
     * backup. On failure, displays a localized error status message.
     *
     * @return A promise that resolves when the sign-in flow completes.
     */
    const handleSignIn = async () => {
        try {
            await googleDriveService.signIn();
            setSignedIn(true);
            checkBackupStatus();
        } catch (err) {
            console.error(err);
            setStatusMsg({ type: 'error', text: localT('sync.signInError') });
        }
    };

    /**
     * Queries Google Drive for the most recent backup file.
     *
     * Updates the {@link lastBackup} state with the found file, or leaves
     * it unchanged on error. Errors are logged to the console but not
     * surfaced to the user.
     *
     * @return A promise that resolves when the lookup completes.
     */
    const checkBackupStatus = async () => {
        try {
            const file = await googleDriveService.findBackup();
            setLastBackup(file);
        } catch (err) {
            console.error(err);
        }
    };

    /**
     * Creates a full backup of all local data and uploads it to Google Drive.
     *
     * Collects jobs, rules, invoices, materials metadata, types metadata,
     * and the current language setting into a versioned backup object, then
     * uploads it via {@link googleDriveService.uploadBackup}. On success a
     * localized success message is displayed; on failure an error message is
     * shown instead. The loading indicator is always cleared afterwards.
     *
     * @return A promise that resolves when the backup operation completes.
     */
    const handleBackup = async () => {
        setLoading(true);
        try {
            const jobs = await dbService.getAllJobs();
            const rules = await dbService.getAllRules();
            const invoices = await dbService.getAllInvoices();
            const materials = await dbService.getMetadata('materials');
            const types = await dbService.getMetadata('types');

            const backupData = {
                version: 1,
                timestamp: new Date().toISOString(),
                jobs,
                rules,
                invoices,
                metadata: { materials, types },
                settings: { language }
            };

            await googleDriveService.uploadBackup(backupData);
            setStatusMsg({ type: 'success', text: localT('sync.success') });
            await checkBackupStatus();
        } catch (err) {
            console.error(err);
            setStatusMsg({ type: 'error', text: localT('sync.error') });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Restores all local data from the most recent Google Drive backup.
     *
     * Prompts the user for confirmation, downloads the backup file, and
     * overwrites local jobs, rules, invoices, metadata, and language
     * settings. Redux state is refreshed afterward so the UI reflects the
     * restored data. Aborts silently if no backup exists or the user
     * cancels the confirmation dialog.
     *
     * @return A promise that resolves when the restore operation completes.
     */
    const handleRestore = async () => {
        if (!lastBackup) return;
        if (!window.confirm(localT('sync.restoreWarning'))) return;

        setLoading(true);
        try {
            const data = await googleDriveService.downloadBackup(lastBackup.id);
            
            if (!data.jobs || !data.rules) {
                throw new Error('Invalid backup file format');
            }

            if (data.jobs && data.jobs.length > 0) {
                await Promise.all(data.jobs.map((job: Job) => dbService.updateJob(job)));
            }

            if (data.rules && data.rules.length > 0) {
                 await dbService.updateRules(data.rules);
            }

            if (data.invoices && data.invoices.length > 0) {
                await Promise.all(data.invoices.map((inv: Invoice) => dbService.addInvoice(inv)));
            }

            if (data.metadata) {
                await dbService.addMetadata('materials', data.metadata.materials || []);
                await dbService.addMetadata('types', data.metadata.types || []);
            }

            if (data.settings && data.settings.language) {
                setLanguage(data.settings.language);
            }

            const allJobs = await dbService.getAllJobs();
            const allRules = await dbService.getAllRules();
            
            jobDispatch({ type: 'SET_JOBS', payload: allJobs });
            tariffDispatch({ type: 'SET_RULES', payload: allRules });

            setStatusMsg({ type: 'success', text: localT('sync.success') });
        } catch (err) {
            console.error(err);
            setStatusMsg({ type: 'error', text: localT('sync.error') });
        } finally {
            setLoading(false);
        }
    };

    if (!isConfigured) {
        return <SetupView localT={localT} />;
    }

    return (
        <SyncContent 
            signedIn={signedIn} 
            statusMsg={statusMsg} 
            setStatusMsg={setStatusMsg} 
            loading={loading} 
            localT={localT}
            handleSignIn={handleSignIn}
            handleBackup={handleBackup}
            handleRestore={handleRestore}
            lastBackup={lastBackup}
        />
    );
};
