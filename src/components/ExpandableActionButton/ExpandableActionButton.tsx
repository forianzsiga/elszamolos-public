/**
 * @file ExpandableActionButton.tsx
 * A compact button component that expands on hover/focus to reveal a text label.
 * It supports theming, multiple color variants, and i18n-based tooltip labels.
 */

import { Box, Typography, useTheme, type SxProps, type Theme } from '@mui/material';
import { useState } from 'react';
import i11n from './ExpandableActionButton-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import './ExpandableActionButton.css';

/**
 * Props for the ExpandableActionButton component.
 */
interface ExpandableActionButtonProps {
    /** The icon element displayed in the button. */
    icon: React.ReactNode;
    /** The text label shown when the button expands. */
    label: string;
    /** Click handler invoked on button activation (click, Enter, or Space). */
    onClick: (e: React.MouseEvent) => void;
    /** Theme color variant used for the border, text, and icon. Defaults to `'primary'`. */
    color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
    /** Additional MUI system sx overrides applied to the container Box. */
    sx?: SxProps<Theme>;
    /** Which side the text label expands toward. Defaults to `'right'`. */
    direction?: 'left' | 'right';
    /** Custom aria-label for accessibility; falls back to `label` when omitted. */
    ariaLabel?: string;
}

/**
 * Union of keys available in the module-level i18n JSON.
 */
type I11nKey = 'edit' | 'delete' | 'save' | 'add';

/**
 * Shape of the i18n data: a record keyed by locale (`'en'` | `'hu'`),
 * each mapping {@link I11nKey} to its translated string.
 */
type I11nData = Record<'en' | 'hu', Record<I11nKey, string>>;

/**
 * Derives the most relevant i18n key from a button label or aria-label.
 * @param label - The button's display label.
 * @param ariaLabel - Optional explicit aria-label to help refine the key.
 * @returns One of `'edit'`, `'delete'`, `'save'`, or a fallback of `'add'`.
 */
const getTooltipKey = (label: string, ariaLabel?: string): I11nKey => {
    const lower = `${label.toLowerCase()}${ariaLabel?.toLowerCase() || ''}`;
    return (['edit', 'delete', 'save'] as const).find(key => lower.includes(key)) || 'add';
};

/**
 * Resolves a color-variant name to its corresponding theme palette main color.
 * @param c - The color variant name (e.g. `'primary'`, `'error'`).
 * @param theme - The MUI theme object.
 * @returns The hex/rgba main color string from the theme palette.
 */
const getColor = (c: string, theme: Theme) => {
    const palette = theme.palette as unknown as Record<string, { main: string }>;
    return palette[c]?.main || palette.primary.main;
};

/**
 * A compact, expandable action button that reveals a text label on hover/focus.
 *
 * The button consists of an icon with a collapsible text container that expands
 * to the left or right. It supports keyboard activation (Enter / Space),
 * i18n-aware tooltips, and full theme colour integration.
 *
 * @param props - The component props.
 * @param props.icon - The icon element displayed in the button.
 * @param props.label - The text label shown when the button expands.
 * @param props.onClick - Click handler invoked on button activation.
 * @param props.color - Theme color variant for the border, text, and icon. Default `'primary'`.
 * @param props.sx - Additional MUI system sx overrides applied to the container Box.
 * @param props.direction - Which side the text label expands toward. Default `'right'`.
 * @param props.ariaLabel - Custom aria-label for accessibility; falls back to `label` when omitted.
 * @returns The rendered expandable action button.
 */
export const ExpandableActionButton = ({ 
    icon, 
    label, 
    onClick, 
    color = 'primary',
    sx,
    direction = 'right',
    ariaLabel
}: ExpandableActionButtonProps) => {
    const theme = useTheme();
    const [isHovered, setIsHovered] = useState(false);
    const { language } = useLanguage();
    
    const mainColor = getColor(color, theme);
    const isRight = direction === 'right';
    const key = getTooltipKey(label, ariaLabel);

    /**
     * Local translation helper for the current language.
     * @param k - The i18n key.
     * @returns Translated string.
     */
    const localT = (k: I11nKey) => {
        const lang = language as 'en' | 'hu';
        return (i11n as I11nData)[lang]?.[k] || k;
    };

    /**
     * Renders the button's inner content: an icon box and a collapsible text
     * label that appears on the left or right side depending on `direction`.
     * @returns The JSX fragment containing the icon and text containers.
     */
    const renderBoxContent = () => (
        <>
            {!isRight && (
                <Box className={`text-container ${isHovered ? 'expanded' : ''}`}>
                    <Typography 
                        variant="caption" 
                        className="label-text left-margin"
                    >
                        {label}
                    </Typography>
                </Box>
            )}
            <Box className="icon-container">
                {icon}
            </Box>
            {isRight && (
                <Box className={`text-container ${isHovered ? 'expanded' : ''}`}>
                    <Typography 
                        variant="caption" 
                        className="label-text right-margin"
                    >
                        {label}
                    </Typography>
                </Box>
            )}
        </>
    );

    /**
     * Handles keyboard activation (Enter or Space) for the button role.
     * @param e - The keyboard event.
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(e as unknown as React.MouseEvent);
        }
    };

    const containerStyle = {
        '--main-color': mainColor,
        '--bg-color': isHovered ? `${mainColor}1A` : 'transparent',
        '--max-width': isHovered ? '300px' : '34px',
    } as React.CSSProperties;

    const boxProps = {
        role: "button",
        'aria-label': ariaLabel || label,
        tabIndex: 0,
        onClick: (e: React.MouseEvent) => onClick(e),
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
        onFocus: () => setIsHovered(true),
        onBlur: () => setIsHovered(false),
        onKeyDown: handleKeyDown,
        className: "expandable-action-button",
        style: containerStyle,
        sx: sx
    };

    const renderWithTooltip = (content: React.ReactElement) => {
        switch (key) {
            case 'edit': return <ResponsiveTooltip title={localT('edit')}>{content}</ResponsiveTooltip>;
            case 'delete': return <ResponsiveTooltip title={localT('delete')}>{content}</ResponsiveTooltip>;
            case 'save': return <ResponsiveTooltip title={localT('save')}>{content}</ResponsiveTooltip>;
            case 'add': return <ResponsiveTooltip title={localT('add')}>{content}</ResponsiveTooltip>;
            default: return <ResponsiveTooltip title={localT('add')}>{content}</ResponsiveTooltip>;
        }
    };

    return renderWithTooltip(
        <Box {...boxProps}>
            {renderBoxContent()}
        </Box>
    );
};
