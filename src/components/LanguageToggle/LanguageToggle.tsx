/**
 * @file LanguageToggle – A language selection button that opens a menu
 *       to switch between available locales (English, Magyar, debug).
 */

import { IconButton, Menu, MenuItem } from '@mui/material';
import { Language } from '@mui/icons-material';
import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useDeveloperMode } from '../../context/DeveloperContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip/ResponsiveTooltip';
import i11n from './LanguageToggle-i11n.json';
import './LanguageToggle.css';

/** Properties for the {@link LanguageToggle} component. */
interface LanguageToggleProps {
    /** When `true`, displays the currently selected language code next to the icon. */
    showCode?: boolean;
}

/** Shape of the imported i11n JSON mapping locale codes to key–value pairs. */
interface I11nData {
    /** English translations. */
    en: Record<string, string>;
    /** Hungarian translations. */
    hu: Record<string, string>;
}

/**
 * A language-toggle button displayed in the app bar. Shows the current
 * language code and opens a menu to switch between English, Hungarian, or
 * the debug locale (when developer mode is active).
 *
 * @param props - Component properties.
 * @returns A fragment containing the icon button and the language menu.
 */
export const LanguageToggle = ({ showCode = true }: LanguageToggleProps) => {
    const { language, setLanguage } = useLanguage();
    const { isDeveloperMode } = useDeveloperMode();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    /**
     * Look up a translation key for the current language, falling back to the key itself.
     * @param key - The translation key to look up in the i11n JSON.
     * @returns The translated string for the current language, or the key itself if not found.
     */
    const localT = (key: string) => (i11n as I11nData)[language as 'en' | 'hu']?.[key] || key;

    /**
     * Open the language menu by anchoring it to the clicked element.
     * @param event - The click event on the icon button.
     */
    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    /** Close the language menu. */
    const handleClose = () => {
        setAnchorEl(null);
    };

    /**
     * Handle language selection from the menu.
     * @param lang - The language code to switch to ('en', 'hu', or 'debug').
     */
    const handleSelect = (lang: 'en' | 'hu' | 'debug') => {
        setLanguage(lang);
        handleClose();
    };

    return (
        <>
            <ResponsiveTooltip title={localT('changeLanguage')}>
                <IconButton
                    size="small"
                    aria-label={localT('changeLanguage')}
                    aria-controls="menu-appbar"
                    aria-haspopup="true"
                    onClick={handleMenu}
                    color="inherit"
                >
                    <Language />
                    {showCode && (
                        <span className="language-code">
                            {language.toUpperCase()}
                        </span>
                    )}
                </IconButton>
            </ResponsiveTooltip>
            <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                <ResponsiveTooltip title={localT('selectEnglish')}>
                    <MenuItem onClick={() => handleSelect('en')}>{localT('english')}</MenuItem>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('selectMagyar')}>
                    <MenuItem onClick={() => handleSelect('hu')}>{localT('magyar')}</MenuItem>
                </ResponsiveTooltip>
                {isDeveloperMode && (
                    <ResponsiveTooltip title={localT('selectDebug')}>
                        <MenuItem onClick={() => handleSelect('debug')}>{localT('debug')}</MenuItem>
                    </ResponsiveTooltip>
                )}
            </Menu>
        </>
    );
};
