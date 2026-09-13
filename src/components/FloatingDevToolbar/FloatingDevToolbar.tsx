import { useEffect, useState } from 'react';
import { IconButton, Paper } from '@mui/material';
import { Layers, Mouse } from '@mui/icons-material';
import { useDeveloperMode } from '../../context/DeveloperContext';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './FloatingDevToolbar-i11n.json';
import './FloatingDevToolbar.css';

export const FloatingDevToolbar = () => {
    const { 
        isDeveloperMode, 
        showContainerBorders, 
        toggleContainerBorders, 
        showReactComponentHover, 
        toggleReactComponentHover 
    } = useDeveloperMode();
    const { language } = useLanguage();
    const [isObstructed, setIsObstructed] = useState(false);

    useEffect(() => {
        const isElementVisible = (el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0'
            );
        };

        const checkObstruction = () => {
            const dialogs = document.querySelectorAll('.MuiDialog-root, .MuiModal-root:not(.MuiDrawer-modal)');
            let hasVisibleDialog = false;
            for (const dialog of dialogs) {
                const paper = dialog.querySelector('.MuiPaper-root, .MuiDialog-paper') || dialog;
                if (paper instanceof HTMLElement && isElementVisible(paper)) {
                    hasVisibleDialog = true;
                    break;
                }
            }
            setIsObstructed(hasVisibleDialog);
        };

        // Check immediately on mount
        checkObstruction();

        // Observe document.body for modal/dialog additions/removals and transition style/class changes
        const observer = new MutationObserver(() => {
            checkObstruction();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        return () => {
            observer.disconnect();
        };
    }, []);

    if (!isDeveloperMode || !isObstructed) return null;

    const localT = (key: string) => {
        const lang = (language === 'en' || language === 'hu') ? language : 'en';
        return (i11n as Record<'en' | 'hu', Record<string, string>>)[lang][key] || key;
    };

    return (
        <Paper
            elevation={16}
            className="floating-dev-toolbar-container"
        >
            <ResponsiveTooltip title={localT('tooltip.borders')}>
                <IconButton 
                    size="small" 
                    onClick={toggleContainerBorders}
                    color={showContainerBorders ? "primary" : "default"}
                    className={showContainerBorders ? 'dev-toolbar-button-active' : ''}
                >
                    <Layers fontSize="small" />
                </IconButton>
            </ResponsiveTooltip>
            <ResponsiveTooltip title={localT('tooltip.reactHover')}>
                <IconButton 
                    size="small" 
                    onClick={toggleReactComponentHover}
                    color={showReactComponentHover ? "primary" : "default"}
                    className={`react-hover-toggle-button ${showReactComponentHover ? 'dev-toolbar-button-active' : ''}`}
                >
                    <Mouse fontSize="small" />
                </IconButton>
            </ResponsiveTooltip>
        </Paper>
    );
};
