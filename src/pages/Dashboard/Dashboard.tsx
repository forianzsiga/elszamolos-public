/**
 * @file Dashboard.tsx
 * @description The main Dashboard view component. Aggregates job statistics,
 * financial metrics, and interactive visualizations including a timeline chart,
 * stat cards, and a recent jobs table with date-range filtering.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useJobs } from '../../context/JobContext';
import { Typography, Box, TextField } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { AttachMoney, ReceiptLong, Warning } from '@mui/icons-material';
import { StatCard } from '../../components/StatCard';
import { TimelineChart } from '../../components/TimelineChart';
import { RecentJobsTable } from '../../components/RecentJobsTable';
import { JobStatusSummary } from '../../components/JobStatusSummary/JobStatusSummary';
import { dbService } from '../../services/db';
import { formatCurrency } from '../../utils/text';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './Dashboard-i11n.json';
import './Dashboard.css';

/**
 * The main Dashboard view.
 * Aggregates statistics and visualizations for the current user's jobs,
 * including total revenue, job counts, issue counts, and interactive
 * timeline/recent-jobs controls.
 *
 * @returns {JSX.Element} The rendered Dashboard page containing stat cards,
 * date-range filter inputs, a timeline chart, and a recent jobs table.
 */
export const Dashboard = () => {
    const { state } = useJobs();
    const { jobs } = state;
    const { language } = useLanguage();
    const typedI11n = i11n as Record<string, Record<string, string>>;
    const localT = (key: string) => typedI11n[language]?.[key] || key;

    const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);

    // Date Filters (Default to current month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const hasInitializedRangeRef = useRef(false);

    // Fetch metadata on load
    useEffect(() => {
        dbService.getMetadata('materials').then(setAvailableMaterials);
        dbService.getMetadata('types').then(setAvailableTypes);
    }, []);

    const visibleJobs = useMemo(() => jobs.filter(job => job.status !== 'Discarded'), [jobs]);

    // Initialize the default date range from the available data window once.
    useEffect(() => {
        if (hasInitializedRangeRef.current) return;
        if (visibleJobs.length === 0) return;

        const sortedDates = visibleJobs
            .map(job => job.createdAt.slice(0, 10))
            .sort((left, right) => left.localeCompare(right));

        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];

        if (minDate && maxDate) {
            // Set end date to maxDate, and start date to maxDate minus 3 months (or minDate if it is later)
            const maxDateObj = new Date(maxDate);
            const defaultStartDateObj = new Date(maxDateObj);
            defaultStartDateObj.setMonth(defaultStartDateObj.getMonth() - 3);
            const defaultStartDate = defaultStartDateObj.toISOString().slice(0, 10);

            setStartDate(defaultStartDate > minDate ? defaultStartDate : minDate);
            setEndDate(maxDate);
            hasInitializedRangeRef.current = true;
        }
    }, [visibleJobs]);

    // Filter Logic
    const filteredJobs = useMemo(() => visibleJobs.filter(job => {
        const jobDate = job.createdAt.slice(0, 10);
        return jobDate >= startDate && jobDate <= endDate;
    }), [visibleJobs, startDate, endDate]);

    // Calculate metrics for filtered range
    const totalsByCurrency: Record<string, number> = {};
    filteredJobs.forEach(job => {
        const curr = job.currency || 'HUF';
        if (curr === 'MIXED') {
             totalsByCurrency['HUF'] = (totalsByCurrency['HUF'] || 0) + (job.price || 0);
        } else {
             totalsByCurrency[curr] = (totalsByCurrency[curr] || 0) + (job.price || 0);
        }
    });

    const totalRevenueDisplay = Object.entries(totalsByCurrency)
        .map(([curr, amount]) => formatCurrency(amount, curr))
        .join(' + ');

    const totalCount = filteredJobs.length;
    const issuesCount = filteredJobs.filter(j => j.status === 'Review' || j.status === 'Invalid').length;

    return (
        <Box>
            <Box className="dashboard-header">
                <Box>
                    <Typography variant="h4">{localT('dashboard.overview')}</Typography>
                    <Box className="dashboard-header-title">
                        <JobStatusSummary jobs={jobs} />
                    </Box>
                </Box>
                <Box className="dashboard-filter-container">
                    <TextField
                        label={localT('dashboard.startDate')}
                        type="date"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="dashboard-filter-input"
                    />
                    <TextField
                        label={localT('dashboard.endDate')}
                        type="date"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="dashboard-filter-input"
                    />
                </Box>
            </Box>
            
            <Grid container spacing={3} className="stats-grid">
                <Grid size={{ xs: 12, md: 4 }}>
                    <StatCard 
                        title={localT('dashboard.periodRevenue')} 
                        value={totalRevenueDisplay || "0 Ft"} 
                        icon={<AttachMoney fontSize="large" />}
                        color="#2e7d32"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <StatCard 
                        title={localT('dashboard.jobsInPeriod')} 
                        value={totalCount} 
                        icon={<ReceiptLong fontSize="large" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <StatCard 
                        title={localT('dashboard.issues')} 
                        value={issuesCount} 
                        icon={<Warning fontSize="large" />}
                        color="#ed6c02"
                    />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <TimelineChart 
                        jobs={visibleJobs} 
                        startDate={startDate} 
                        endDate={endDate} 
                        onDateRangeChange={(start, end) => {
                            setStartDate(start);
                            setEndDate(end);
                        }} 
                    />
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <RecentJobsTable 
                        jobs={jobs} 
                        availableMaterials={availableMaterials}
                        availableTypes={availableTypes}
                    />
                </Grid>
            </Grid>
        </Box>
    );
};
