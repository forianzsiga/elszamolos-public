/**
 * @file MaterialCell.tsx
 * @description Renders a dominant material/type value with an optional overflow badge,
 *   and shows a tooltip listing the other values when hovering the badge.
 */

import React from 'react';
import { Typography, Chip } from '@mui/material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import type { DominantValueSummary } from '../../utils/text';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './MaterialCell-i11n.json';
import './MaterialCell.css';

/**
 * Props for the {@link MaterialCell} component.
 */
export interface MaterialCellProps {
    /** The dominant-value summary (dominant value + overflow items). */
    summary: DominantValueSummary;
}

/**
 * Renders a dominant value with a `+N` overflow badge.
 *
 * When there is no overflow, just the dominant value is shown.
 * When overflow exists, a small `+N` chip is rendered beside the dominant value,
 * wrapped in a `<ResponsiveTooltip />` that lists each overflow item on its own line.
 *
 * @param {MaterialCellProps} props - Component props.
 * @returns {JSX.Element} The rendered cell content.
 */
export const MaterialCell = React.memo(({ summary }: MaterialCellProps) => {
    const { language } = useLanguage();
    const localT = (key: string) =>
        (i11n as Record<string, Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;

    const { dominant, overflow } = summary;

    if (overflow.length === 0) {
        return (
            <Typography variant="body2" noWrap className="material-cell-value">
                {dominant}
            </Typography>
        );
    }

    const chipLabel = `+${overflow.length}`;

    const tooltipLines = overflow.map(
        item => `${item.value} (${item.count} ${localT('unit')})`
    );
    const tooltipTitle = `${localT('overflowTooltip')}\n${tooltipLines.join('\n')}`;

    return (
        <span className="material-cell-root">
            <Typography variant="body2" noWrap className="material-cell-value">
                {dominant}
            </Typography>
            <ResponsiveTooltip title={tooltipTitle}>
                <Chip
                    label={chipLabel}
                    size="small"
                    variant="outlined"
                    className="material-cell-overflow-chip"
                />
            </ResponsiveTooltip>
        </span>
    );
});

MaterialCell.displayName = 'MaterialCell';