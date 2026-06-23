import { useState, useRef, type ReactElement, cloneElement } from 'react';
import { 
    Tooltip, Dialog, DialogContent, DialogActions, Button, 
    Zoom, Typography 
} from '@mui/material';
import i11n from './ResponsiveTooltip-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import { useColorMode } from '../../context/ThemeContext';
import './ResponsiveTooltip.css';

interface ResponsiveTooltipProps {
    title: string;
    children: ReactElement;
}

export const ResponsiveTooltip = ({ title, children }: ResponsiveTooltipProps) => {
    const { isMobile } = useColorMode();
    const [open, setOpen] = useState(false);
    
    const { language } = useLanguage();
    const localT = (key: string) => i11n[language as 'en' | 'hu']?.[key as keyof typeof i11n['en']] || key;
    
    // Long press logic
    const timerRef = useRef<number | null>(null);

    const handleTouchStart = () => {
        timerRef.current = window.setTimeout(() => {
            setOpen(true);
        }, 700); // 700ms for long press
    };

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    if (isMobile) {
        return (
            <>
                {cloneElement(children, {
                    onTouchStart: handleTouchStart,
                    onTouchEnd: clearTimer,
                    onTouchMove: clearTimer, // Cancel on scroll
                    // Disable default context menu on long press to avoid double menus
                    onContextMenu: (e: React.MouseEvent) => e.preventDefault()
                })}
                <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs">
                    <DialogContent>
                        <Typography>{title}</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Tooltip title={localT('close')}>
                            <Button onClick={() => setOpen(false)}>{localT('close')}</Button>
                        </Tooltip>
                    </DialogActions>
                </Dialog>
            </>
        );
    }

    return (
        <Tooltip title={title} TransitionComponent={Zoom} arrow enterDelay={1000} enterNextDelay={1000}>
            {children}
        </Tooltip>
    );
};
