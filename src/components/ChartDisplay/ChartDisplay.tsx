/** @file ChartDisplay.tsx - Stacked bar chart component showing invoiced, applied, and pending amounts over time. */
import React from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';
import i11nRaw from './ChartDisplay-i11n.json';
const i11n = i11nRaw as Record<string, Record<string, string>>;
import './ChartDisplay.css';

/** Props for the ChartDisplay component. */
interface ChartDisplayProps {
    data: Record<string, unknown>[];
}

/** Maximum number of data points below which bar animations are enabled. */
const TIMELINE_ANIMATION_THRESHOLD = 40;

/**
 * Custom tooltip component for the bar chart.
 * Displays a styled Paper with invoiced, applied, pending amounts and the total.
 *
 * @param active - Whether the tooltip is currently active/visible.
 * @param payload - Array of data payload entries for the hovered bar segment.
 * @param label  - The label (date) for the hovered bar.
 * @returns The tooltip JSX element, or null if not active.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    const { language } = useLanguage();
    const localT = (key: string) => i11n[language as 'en' | 'hu']?.[key] || key;
    
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <Paper className="tooltip-paper">
                <Typography variant="subtitle2">{label}</Typography>
                <Box className="tooltip-invoiced">{localT('invoiced')} {data.invoicedBar}</Box>
                <Box className="tooltip-applied">{localT('applied')} {data.calculatedBar}</Box>
                <Box className="tooltip-pending">{localT('pending')} {data.pendingBar}</Box>
                <Typography variant="caption" color="text.secondary">{localT('total')} {data.total}</Typography>
            </Paper>
        );
    }
    return null;
};

/**
 * Main chart component that renders a stacked bar chart.
 * Displays invoiced, applied, and pending amounts over time using Recharts.
 * Animations are automatically disabled when the dataset exceeds TIMELINE_ANIMATION_THRESHOLD.
 *
 * @param props        - Component props.
 * @param props.data   - Array of data records to chart.
 * @returns The chart JSX element wrapped in a responsive container.
 */
export const ChartDisplay = React.memo(({ data }: ChartDisplayProps) => {
    const theme = useTheme();
    const axisColor = theme.palette.text.primary;
    const gridColor = theme.palette.divider;
    const shouldAnimate = data.length > 0 && data.length <= TIMELINE_ANIMATION_THRESHOLD;
    const { language } = useLanguage();
    const localT = (key: string) => i11n[language as 'en' | 'hu']?.[key] || key;

    return (
        <Box className="chart-container">
            <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
                <BarChart 
                    data={data} 
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                    barCategoryGap={0}
                    barGap={0}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis 
                        dataKey="date" 
                        tickFormatter={(val) => val.slice(5)} // Show MM-DD
                        minTickGap={50}
                        interval="preserveStartEnd"
                        tick={{ fontSize: 12, fill: axisColor }}
                        padding={{ left: 0, right: 0 }}
                        stroke={axisColor}
                    />
                    <YAxis 
                        allowDecimals={false} 
                        tick={{ fontSize: 12, fill: axisColor }}
                        stroke={axisColor}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.palette.action.hover }} />
                    
                    {/* Stacked Bars */}
                    <Bar dataKey="invoicedBar" stackId="a" fill={theme.palette.custom.invoiced} name={localT('invoiced')} isAnimationActive={shouldAnimate} />
                    <Bar dataKey="calculatedBar" stackId="a" fill={theme.palette.custom.applied} name={localT('applied')} isAnimationActive={shouldAnimate} />
                    <Bar dataKey="pendingBar" stackId="a" fill={theme.palette.custom.pending} name={localT('pending')} isAnimationActive={shouldAnimate} />
                    
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
});
