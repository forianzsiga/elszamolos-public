/**
 * @file HiddenItemsHeader.tsx
 * Renders a collapsible header row for hidden job teeth items.
 * Includes a toggle expand button and a localised label.
 * Selection has been removed from the unit table; the header reflects
 * that by no longer rendering a checkbox.
 */

import React, { useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { ChevronRight, ExpandMore } from '@mui/icons-material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './HiddenItemsHeader-i11n.json';
import './HiddenItemsHeader.css';

/**
 * Props for the HiddenItemsHeader component.
 */
interface HiddenItemsHeaderProps {
    mode: 'light' | 'dark';
    isHiddenExpanded: boolean;
    onToggleExpand: () => void;
    gridTemplateColumns: string;
    label: string;
}

/**
 * A header row displayed above hidden items in a job-teeth table.
 * Provides a clickable row that expands or collapses the hidden-items
 * section. The previous select-all checkbox has been removed along
 * with the rest of the unit-table selection model.
 *
 * @param props - Component props.
 * @returns The rendered header element.
 */
export const HiddenItemsHeader: React.FC<HiddenItemsHeaderProps> = ({
    mode,
    isHiddenExpanded,
    onToggleExpand,
    gridTemplateColumns,
    label
}) => {
    const { language } = useLanguage();

    const t = useCallback((key: string) => {
        if (language === 'debug') return key;
        return (i11n as Record<'en' | 'hu', Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
    }, [language]);

    const headerRef = useCallback((node: HTMLElement | null) => {
        if (node) {
            node.style.gridTemplateColumns = gridTemplateColumns;
        }
    }, [gridTemplateColumns]);

    return (
        <ResponsiveTooltip title={t('toggleHiddenItemsTooltip')}>
            <Box
                ref={headerRef}
                className={`job-teeth-table-row hidden-items-header-row ${mode}`}
                onClick={onToggleExpand}
            >
                <Box className="hidden-items-label-cell">
                    {isHiddenExpanded ? <ExpandMore /> : <ChevronRight />}
                    <Typography variant="body2" fontWeight="bold" className="hidden-items-text">
                        {label}
                    </Typography>
                </Box>
            </Box>
        </ResponsiveTooltip>
    );
};

export default HiddenItemsHeader;
