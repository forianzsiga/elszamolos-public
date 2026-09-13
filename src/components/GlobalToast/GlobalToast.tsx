/** @file GlobalToast – Application-level toast notification overlay.
 *  Renders transient log entries as animated, auto-dismissing alert toasts
 *  with action buttons (edit rule / view log) and a progress bar. */

import { useEffect, useState } from 'react';
import { Alert, Button, Box, LinearProgress, IconButton, Collapse, Slide } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useLogs } from '../../context/LogContext';
import { useLanguage } from '../../context/LanguageContext';
import { TransitionGroup } from 'react-transition-group';
import type { LogEntry } from '../../context/LogContext';
import { TOAST_DURATION, TOAST_TICK } from '../../utils/constants';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './GlobalToast-i11n.json';
import './GlobalToast.css';

/** Props consumed by the internal {@link ToastItem} component.
 * @param log    – The log entry to render as a toast.
 * @param onRemove – Callback fired when the toast should be removed (receives the log id).
 * @param in     – Whether the toast is entering the view (passed by TransitionGroup).
 * @param onExited – Callback fired after the exit animation completes. */
interface ToastItemProps {
    log: LogEntry;
    onRemove: (id: string) => void;
    in?: boolean;
    onExited?: () => void;
}

/** Renders a single animated toast for a log entry.
 *  Shows a severity-coloured Alert, a progress bar counting down to auto-dismiss,
 *  and contextual action buttons (edit rule / view log).
 *  Hovering pauses the countdown; the toast collapses after the slide-out animation.
 * @param props – {@link ToastItemProps}.
 * @returns A Collapse > Slide > Box element containing the Alert and LinearProgress. */
const ToastItem = ({ log, onRemove, in: inProp, onExited }: ToastItemProps) => {
    const navigate = useNavigate();
    const { language } = useLanguage();
    
    type I18nKey = 'edit' | 'viewLog' | 'editTooltip' | 'viewLogTooltip' | 'closeTooltip';
    type I18n = Record<I18nKey, string>;
    const typedI11n = i11n as Record<'en' | 'hu', I18n>;
    
    const localT = (key: I18nKey) => {
        if (language === 'debug') return key;
        const lang = language as 'en' | 'hu';
        return typedI11n[lang]?.[key] || key;
    };
    
    const [remaining, setRemaining] = useState(TOAST_DURATION);
    const [paused, setPaused] = useState(false);
    
    // Animation States
    const [slideOpen, setSlideOpen] = useState(true);
    const [collapseOpen, setCollapseOpen] = useState(true);

    // Sync with TransitionGroup
    useEffect(() => {
        if (inProp) {
            setSlideOpen(true);
            setCollapseOpen(true);
        } else {
            setSlideOpen(false);
        }
    }, [inProp]);

    const handleSlideExited = () => {
        setCollapseOpen(false);
    };

    const handleCollapseExited = () => {
        if (onExited) onExited();
    };

    useEffect(() => {
        if (paused || remaining <= 0) return;
        const interval = setInterval(() => setRemaining(p => p - TOAST_TICK), TOAST_TICK);
        return () => clearInterval(interval);
    }, [paused, remaining]);

    useEffect(() => {
        if (remaining <= 0) {
            onRemove(log.id);
        }
    }, [remaining, log.id, onRemove]);

    /** Maps a log severity to a MUI LinearProgress colour.
     * @param severity – The log severity ('error' | 'warning' | 'success' | undefined).
     * @returns The matching MUI colour key ('error' | 'warning' | 'success' | 'primary'). */
    const getProgressBarColor = (severity: string | undefined) => {
        if (severity === 'error') return 'error';
        if (severity === 'warning') return 'warning';
        if (severity === 'success') return 'success';
        return 'primary';
    };

    const progress = ((TOAST_DURATION - remaining) / TOAST_DURATION) * 100;

    return (
        <Collapse in={collapseOpen} onExited={handleCollapseExited}>
            <Slide direction="right" in={slideOpen} onExited={handleSlideExited}>
                <Box 
                    className="toast-item-container"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    <Alert
                        severity={log.severity || 'info'}
                        variant="filled"
                        className="toast-alert"
                        action={
                            <Box className="toast-action-container">
                                {log.details && log.details.startsWith('rule:') ? (
                                    <ResponsiveTooltip title={localT('editTooltip')}>
                                        <Button 
                                            color="inherit" 
                                            size="small" 
                                            onClick={() => {
                                                onRemove(log.id);
                                                const ruleId = log.details?.split(':')[1];
                                                navigate('/tariffs', { state: { editRuleId: ruleId } });
                                            }}
                                            className="toast-edit-button"
                                        >
                                            {localT('edit')}
                                        </Button>
                                    </ResponsiveTooltip>
                                ) : (
                                    <ResponsiveTooltip title={localT('viewLogTooltip')}>
                                        <Button 
                                            color="inherit" 
                                            size="small" 
                                            onClick={() => {
                                                onRemove(log.id);
                                                navigate('/logs');
                                            }}
                                            className="toast-log-button"
                                        >
                                            {localT('viewLog')}
                                        </Button>
                                    </ResponsiveTooltip>
                                )}
                                <ResponsiveTooltip title={localT('closeTooltip')}>
                                    <IconButton size="small" color="inherit" onClick={() => onRemove(log.id)}>
                                        <Close fontSize="small" />
                                    </IconButton>
                                </ResponsiveTooltip>
                            </Box>
                        }
                    >
                        {log.message}
                    </Alert>
                    <LinearProgress 
                        variant="determinate" 
                        value={progress} 
                        color={getProgressBarColor(log.severity)}
                        className="toast-progress"
                    />
                </Box>
            </Slide>
        </Collapse>
    );
};

/** Application-wide toast notification overlay.
 *  Reads the current toast queue from LogContext and renders each entry as an
 *  animated {@link ToastItem} inside a MUI TransitionGroup.
 *  @returns A fixed-position container holding all active toasts. */
export const GlobalToast = () => {
    const { state, removeToast } = useLogs();
    
    return (
        <Box className="global-toast-container">
            <TransitionGroup component={null}>
                {state.toasts.map(log => (
                    <ToastItem key={log.id} log={log} onRemove={removeToast} />
                ))}
            </TransitionGroup>
        </Box>
    );
};
