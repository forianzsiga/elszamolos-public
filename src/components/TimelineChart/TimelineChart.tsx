import { useMemo, useState, useEffect } from 'react';
import { Box, Slider, Typography, Paper } from '@mui/material';
import { ChartDisplay } from '../ChartDisplay';
import { ShowcaseOverlay } from '../ShowcaseOverlay';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { useLanguage } from '../../context/LanguageContext';
import type { Job } from '../../types';
import i11n from './TimelineChart-i11n.json';
import './TimelineChart.css';

interface TimelineChartProps {
    jobs: Job[];
    startDate: string;
    endDate: string;
    onDateRangeChange: (start: string, end: string) => void;
}

const DUMMY_JOBS: Job[] = [
    {
        id: 'dummy-1',
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        unitCount: 8,
        teethMatched: 5,
        status: 'Calculated',
            teeth: Array(8).fill(0).map((_, i) => {
                if (i < 3) return { number: i + 10, status: 'Invoiced' };
                if (i < 5) return { number: i + 10, status: 'Calculated' };
                return { number: i + 10, status: 'Pending' };
            })
    } as unknown as Job,
    {
        id: 'dummy-2',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        unitCount: 5,
        teethMatched: 5,
        status: 'Invoiced',
        teeth: Array(5).fill(0).map((_, i) => ({ number: i + 20, status: 'Invoiced' }))
    } as unknown as Job,
    {
        id: 'dummy-3',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        unitCount: 12,
        teethMatched: 4,
        status: 'Pending',
        teeth: Array(12).fill(0).map((_, i) => ({ number: i + 30, status: i < 4 ? 'Calculated' : 'Pending' }))
    } as unknown as Job,
];

export const TimelineChart = ({ jobs, startDate, endDate, onDateRangeChange }: TimelineChartProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => {
        if (language === 'debug') return key;
        return (i11n as Record<'en' | 'hu', Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
    };
    
    const isDemo = jobs.length === 0;
    const effectiveJobs = isDemo ? DUMMY_JOBS : jobs;

    // 1. Prepare Data: Group by Date, Fill gaps
    const fullChartData = useMemo(() => {
        if (effectiveJobs.length === 0) return [];

        // Find min/max dates from jobs to establish boundaries
        const timestamps = effectiveJobs.map(j => new Date(j.createdAt).getTime());
        const minTime = Math.min(...timestamps);
        const maxTime = Math.max(...timestamps);

        // Create map of counts
        const dataMap = new Map<string, { pending: number; calculated: number; invoiced: number; total: number }>();
        
        effectiveJobs.forEach(job => {
            const dateKey = job.createdAt.slice(0, 10); // YYYY-MM-DD
            const entry = dataMap.get(dateKey) || { pending: 0, calculated: 0, invoiced: 0, total: 0 };
            
            const matched = job.teethMatched || 0;
            const totalUnits = job.unitCount || 0;
            
            let invoiced = 0;
            if (job.teeth && job.teeth.length > 0) {
                invoiced = job.teeth.filter(t => t.status === 'Invoiced' || t.parentInvoiceId).length;
            } else if (job.status === 'Invoiced') {
                invoiced = matched;
            }

            const calculated = Math.max(0, matched - invoiced);
            const pending = Math.max(0, totalUnits - matched);

            entry.invoiced += invoiced;
            entry.calculated += calculated;
            entry.pending += pending;
            entry.total += totalUnits;
            
            dataMap.set(dateKey, entry);
        });

        // Generate full date range
        const result = [];
        const current = new Date(minTime);
        current.setUTCHours(0, 0, 0, 0);
        const end = new Date(maxTime);
        end.setUTCHours(0, 0, 0, 0);

        while (current <= end) {
            const dateKey = current.toISOString().slice(0, 10);
            const stats = dataMap.get(dateKey) || { pending: 0, calculated: 0, invoiced: 0, total: 0 };
            
            result.push({
                date: dateKey,
                pendingBar: stats.pending,
                calculatedBar: stats.calculated,
                invoicedBar: stats.invoiced,
                total: stats.total
            });
            
            current.setUTCDate(current.getUTCDate() + 1);
        }
        return result;
    }, [effectiveJobs]);

    // ── Helpers for date-based aggregation ──────────────────────────────
    const daysBetween = (a: string, b: string): number =>
        Math.floor((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86_400_000) + 1;

    const getWeekKey = (dateStr: string): string => {
        const d = new Date(dateStr + 'T00:00:00Z');
        // Shift to nearest Thursday (ISO week algorithm)
        const t = new Date(d.getTime());
        t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
        const year = t.getUTCFullYear();
        const jan1 = new Date(Date.UTC(year, 0, 1));
        const diffDays = Math.floor((t.getTime() - jan1.getTime()) / 86_400_000);
        const weekNum = Math.ceil((diffDays + jan1.getUTCDay() + 1) / 7);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
    };

    const getMonthKey = (dateStr: string): string => dateStr.slice(0, 7);

    // 2. Filter Data for Zooming (with dynamic aggregation)
    const visibleData = useMemo(() => {
        if (isDemo) return fullChartData;

        const filtered = fullChartData.filter(d => d.date >= startDate && d.date <= endDate);
        const totalDays = daysBetween(startDate, endDate);

        // High precision — 40 days or less
        if (totalDays <= 40) return filtered;

        /**
         * Generic aggregator: groups filtered data by a date key derived from
         * each daily record, sums the numeric bar values, and returns an
         * array sorted chronologically by the group key.
         */
        const aggregate = (keyFn: (date: string) => string) => {
            const map = new Map<string, { pendingBar: number; calculatedBar: number; invoicedBar: number; total: number }>();
            for (const d of filtered) {
                const k = keyFn(d.date);
                const acc = map.get(k) ?? { pendingBar: 0, calculatedBar: 0, invoicedBar: 0, total: 0 };
                acc.pendingBar += d.pendingBar;
                acc.calculatedBar += d.calculatedBar;
                acc.invoicedBar += d.invoicedBar;
                acc.total += d.total;
                map.set(k, acc);
            }
            return Array.from(map.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, stats]) => ({ date, ...stats }));
        };

        // Week aggregation — 41 to 180 days
        if (totalDays <= 180) return aggregate(getWeekKey);

        // Month aggregation — more than 180 days
        return aggregate(getMonthKey);
    }, [fullChartData, startDate, endDate, isDemo]);

    // Convert date strings to slider indices
    const sliderValue = useMemo(() => {
        if (fullChartData.length === 0) return [0, 0];
        
        let startIdx = 0;
        let endIdx = fullChartData.length - 1;

        if (!isDemo) {
            const startIndex = fullChartData.findIndex(d => d.date === startDate);
            const endIndex = fullChartData.findIndex(d => d.date === endDate);
            startIdx = startIndex === -1 ? 0 : startIndex;
            endIdx = endIndex === -1 ? fullChartData.length - 1 : endIndex;
        }
        
        return [startIdx, endIdx];
    }, [fullChartData, startDate, endDate, isDemo]);

    // Local state for smooth sliding
    const [internalRange, setInternalRange] = useState<number[]>(sliderValue);

    // Sync local state when props change (e.g. from DatePickers)
    useEffect(() => {
        setInternalRange(sliderValue);
    }, [sliderValue]);

    // 3. Handle Slider Changes (Local only)
    const handleSliderChange = (_: Event, newValue: number | number[]) => {
        if (Array.isArray(newValue)) {
            setInternalRange(newValue);
        }
    };

    // 4. Handle Commit (Triggers heavy update)
    const handleSliderCommit = (_: Event | React.SyntheticEvent, newValue: number | number[]) => {
        if (isDemo) return;
        if (Array.isArray(newValue) && fullChartData.length > 0) {
            const startIndex = newValue[0];
            const endIndex = Math.min(newValue[1], fullChartData.length - 1);
            
            const newStart = fullChartData[startIndex].date;
            const newEnd = fullChartData[endIndex].date;
            
            if (newStart !== startDate || newEnd !== endDate) {
                onDateRangeChange(newStart, newEnd);
            }
        }
    };

    return (
        <Paper 
            variant="outlined" 
            className="timeline-chart-container"
        >
            <ShowcaseOverlay isDemo={isDemo} label={<ShowcaseLabel />}>
                <Box className="timeline-chart-header">
                    <Typography variant="h6">{localT('timelineTitle')}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {localT('timelineCaption')}
                    </Typography>
                </Box>

                <ChartDisplay data={visibleData} />

                {/* Range Slider */}
                <Box className="timeline-chart-slider-box">
                    <Slider
                        value={internalRange}
                        onChange={handleSliderChange}
                        onChangeCommitted={handleSliderCommit}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(index) => fullChartData[index]?.date}
                        min={0}
                        max={fullChartData.length - 1}
                        disableSwap
                        color="primary"
                    />
                </Box>
            </ShowcaseOverlay>
        </Paper>
    );
};
