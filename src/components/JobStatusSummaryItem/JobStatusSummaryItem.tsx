/**
 * @file JobStatusSummaryItem.tsx
 *
 * A summary item component that displays a single job status statistic
 * (icon, label, and count) inside a paper card with an expand-on-hover label.
 */

import { memo, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import './JobStatusSummaryItem.css';
import i11n from './JobStatusSummaryItem-i11n.json';

/**
 * Props for the expandable stat chip component.
 *
 * @interface ExpandableStatChipProps
 */
interface ExpandableStatChipProps {
    /** The icon element displayed on the chip. */
    icon: React.ReactNode;
    /** The label key (i18n) shown next to the icon on hover. */
    label: string;
    /** The numeric count displayed after the label. */
    count: number;
    /** Theme colour key used for background, border and text colouring. */
    colorKey: 'primary' | 'success' | 'warning' | 'error' | 'default';
    /** Tooltip key (i18n) shown when hovering the paper. */
    tooltip: string;
}

/**
 * Internal component that renders a small paper chip with an icon, an
 * expandable label (revealed on hover), and a numeric count.
 *
 * @param props            - The component props.
 * @param props.icon       - Icon element displayed on the chip.
 * @param props.label      - Localisation key for the label text.
 * @param props.count      - Numeric value displayed alongside the label.
 * @param props.colorKey   - Theme colour key to tint the chip.
 * @param props.tooltip    - Localisation key for the tooltip text.
 * @returns A React element representing the job status summary item.
 */
const JobStatusSummaryItemComponent = ({ icon, label, count, colorKey, tooltip }: ExpandableStatChipProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const { language } = useLanguage();
    const localT = (key: string) => (i11n[language as 'en' | 'hu'] as Record<string, string>)?.[key] || key;

    return (
        <ResponsiveTooltip title={localT(tooltip)}>
            <Paper
                elevation={0}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`job-status-summary-item-paper job-status-color-${colorKey}`}
            >
                {icon}

                <Box
                    className={`job-status-summary-item-box ${isHovered ? 'is-hovered' : ''}`}
                >
                    <Typography variant="caption" fontWeight="medium" className="job-status-summary-item-label">
                        {localT(label)}:
                    </Typography>
                </Box>

                <Typography variant="caption" fontWeight="bold">
                    {count}
                </Typography>
            </Paper>
        </ResponsiveTooltip>
    );
};

/**
 * Memoized job status summary chip.
 * Renders a small paper card showing an icon, expandable label, and numeric count.
 * The label is revealed on hover via a CSS max-width / opacity transition.
 */
export const JobStatusSummaryItem = memo(JobStatusSummaryItemComponent);
