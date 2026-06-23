/** @file A reusable confirmation dialog component with imperative hook support. */
/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button
} from '@mui/material';
import i11n from './ConfirmDialog-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import './ConfirmDialog.css';
import { ResponsiveTooltip } from '../ResponsiveTooltip';

/** Severity variants that determine the confirm button's color. */
type ConfirmDialogSeverity = 'default' | 'error' | 'warning';

/**
 * Props for the {@link ConfirmDialog} component.
 *
 * @property open        - Whether the dialog is visible.
 * @property title       - Optional title text (defaults to a translation key).
 * @property message     - Body text displayed in the dialog.
 * @property confirmText - Optional label for the confirm button.
 * @property cancelText  - Optional label for the cancel button.
 * @property onConfirm   - Callback invoked when the user clicks confirm.
 * @property onCancel    - Callback invoked when the user clicks cancel.
 * @property severity    - Visual style variant (defaults to `'default'`).
 */
interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    severity?: ConfirmDialogSeverity;
}

/**
 * A reusable Material-UI confirmation dialog with accessible aria attributes
 * and tooltip-wrapped action buttons.
 *
 * @param props          - {@link ConfirmDialogProps}
 * @param props.open     - Whether the dialog is visible.
 * @param props.title    - Optional title text (defaults to a translation key).
 * @param props.message  - Body text displayed in the dialog.
 * @param props.confirmText - Optional label for the confirm button.
 * @param props.cancelText  - Optional label for the cancel button.
 * @param props.onConfirm   - Callback invoked when the user clicks confirm.
 * @param props.onCancel    - Callback invoked when the user clicks cancel.
 * @param props.severity    - Visual style variant (defaults to `'default'`).
 * @returns A controlled MUI `<Dialog>` element.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    severity = 'default'
}) => {
    const { language } = useLanguage();
    const localT = (key: 'confirm' | 'cancel' | 'title' | 'confirmTooltip' | 'cancelTooltip') => i11n[language as 'en' | 'hu']?.[key] || key;

    let confirmColor: 'error' | 'warning' | 'primary' = 'primary';
    if (severity === 'error') {
        confirmColor = 'error';
    } else if (severity === 'warning') {
        confirmColor = 'warning';
    }

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
        >
            <DialogTitle id="confirm-dialog-title">{title || localT('title')}</DialogTitle>
            <DialogContent>
                <DialogContentText id="confirm-dialog-description">
                    {message}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <ResponsiveTooltip title={localT('cancelTooltip')}>
                    <Button onClick={onCancel} color="secondary" autoFocus>
                        {cancelText || localT('cancel')}
                    </Button>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('confirmTooltip')}>
                    <Button onClick={onConfirm} color={confirmColor} variant="contained">
                        {confirmText || localT('confirm')}
                    </Button>
                </ResponsiveTooltip>
            </DialogActions>
        </Dialog>
    );
};

/**
 * Hook for using confirm dialog imperatively
 * Returns a function that shows the dialog and returns a Promise
 * @returns {{ confirm: (config: object) => Promise<boolean>, dialog: JSX.Element | null }}
 */
export function useConfirmDialog() {
    const [open, setOpen] = React.useState(false);
    const [config, setConfig] = React.useState<{
        title?: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        severity?: ConfirmDialogSeverity;
    } | null>(null);
    const resolveRef = React.useRef<(value: boolean) => void>(() => {});

    const confirm = React.useCallback((config: {
        title?: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        severity?: ConfirmDialogSeverity;
    }): Promise<boolean> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setConfig(config);
            setOpen(true);
        });
    }, []);

    const handleConfirm = React.useCallback(() => {
        setOpen(false);
        resolveRef.current(true);
    }, []);

    const handleCancel = React.useCallback(() => {
        setOpen(false);
        resolveRef.current(false);
    }, []);

    const dialog = config ? (
        <ConfirmDialog
            open={open}
            title={config.title}
            message={config.message}
            confirmText={config.confirmText}
            cancelText={config.cancelText}
            severity={config.severity}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    ) : null;

    return { confirm, dialog };
}
