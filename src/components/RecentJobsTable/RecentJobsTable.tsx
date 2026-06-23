import { useState } from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Typography
} from '@mui/material';
import { JobEditModal } from '../JobEditModal';
import { ShowcaseOverlay } from '../ShowcaseOverlay';
import { ShowcaseLabel } from '../ShowcaseLabel';
import { generateJobHash } from '../../utils/hash';
import { dbService } from '../../services/db';
import { useJobs } from '../../context/JobContext';
import { useLanguage } from '../../context/LanguageContext';
import type { Job } from '../../types';
import { RecentJobRow } from '../RecentJobRow';
import { DUMMY_JOBS } from '../../data/dummyJobs';
import i11n from './RecentJobsTable-i11n.json';
import './RecentJobsTable.css';

interface RecentJobsTableProps {
    jobs: Job[];
    availableMaterials: string[];
    availableTypes: string[];
}

export const RecentJobsTable = ({ jobs, availableMaterials, availableTypes }: RecentJobsTableProps) => {
    const { language } = useLanguage();
    const { dispatch: jobDispatch } = useJobs();
    const [editingJob, setEditingJob] = useState<Job | null>(null);

    const localT = (key: string) => {
        const lang = language as 'en' | 'hu';
        const translations = (i11n as Record<'en' | 'hu', Record<string, string>>)[lang];
        return translations?.[key] || key;
    };

    const isDemo = jobs.length === 0;
    const effectiveJobs = isDemo ? DUMMY_JOBS : jobs;

    const recentJobs = [...effectiveJobs]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

    const isJobModified = (job: Job) => {
        if (!job.originalHash) return false;
        const currentHash = generateJobHash(job);
        return currentHash !== job.originalHash;
    };
    
    const handleUpdateJob = async (updatedJob: Job) => {
        if (isDemo) return;
        const original = jobs.find(j => j.id === updatedJob.id);
        if (original) {
            const pricingChanged = 
                original.unitCount !== updatedJob.unitCount ||
                JSON.stringify(original.teeth) !== JSON.stringify(updatedJob.teeth);

            if (pricingChanged && updatedJob.status !== 'Discarded') {
                updatedJob.status = 'Pending';
                updatedJob.price = 0;
            }
        }
        await dbService.updateJob(updatedJob);
        jobDispatch({ type: 'UPDATE_JOB', payload: updatedJob });
    };

    const handleDeleteJob = async (id: string) => {
        if (isDemo) return;
        if (window.confirm(localT('confirm.delete'))) {
            await dbService.deleteJob(id);
            jobDispatch({ type: 'DELETE_JOB', payload: id });
        }
    };

    return (
        <Paper 
            variant="outlined" 
            className="recent-jobs-paper"
        >
            <ShowcaseOverlay isDemo={isDemo} label={<ShowcaseLabel />}>
                <Typography variant="h6" gutterBottom>{localT('dashboard.recentActivity')}</Typography>
                <TableContainer className="recent-jobs-table-container">
                    <Table size="small" className="recent-jobs-table">
                        <TableHead>
                            <TableRow>
                                <TableCell>{localT('jobs.column.date')}</TableCell>
                                <TableCell>{localT('jobs.column.status')}</TableCell>
                                <TableCell align="center">{localT('jobs.column.state')}</TableCell>
                                <TableCell>{localT('jobs.column.patient')}</TableCell>
                                <TableCell>{localT('jobs.column.doctor')}</TableCell>
                                <TableCell>{localT('jobs.column.type')}</TableCell>
                                <TableCell>{localT('jobs.column.material')}</TableCell>
                                <TableCell align="right">{localT('jobs.column.units')}</TableCell>
                                <TableCell align="right">{localT('jobs.column.price')}</TableCell>
                                <TableCell align="center">{localT('jobs.column.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {recentJobs.map((job) => (
                                <RecentJobRow
                                    key={job.id}
                                    job={job}
                                    isJobModified={isJobModified}
                                    onEdit={(j) => setEditingJob(j)}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </ShowcaseOverlay>

            <JobEditModal 
                open={!!editingJob}
                job={editingJob}
                onClose={() => setEditingJob(null)}
                onSave={handleUpdateJob}
                onDelete={editingJob && jobs.some(j => j.id === editingJob.id) ? handleDeleteJob : undefined}
                isNew={false}
                materials={availableMaterials}
                types={availableTypes}
            />
        </Paper>
    );
};
