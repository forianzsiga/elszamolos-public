import { TableCell, TableRow, IconButton } from '@mui/material';
import { Edit, InfoOutlined } from '@mui/icons-material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { JobStatusChip } from '../JobStatusChip';
import { formatCurrency, getJobSummary } from '../../utils/text';
import type { Job } from '../../types';
import i11n from './RecentJobRow-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import './RecentJobRow.css';

interface RecentJobRowProps {
    job: Job;
    isJobModified: (job: Job) => boolean;
    onEdit: (job: Job) => void;
}

export const RecentJobRow = ({ job, isJobModified, onEdit }: RecentJobRowProps) => {
    const { material, type } = getJobSummary(job.teeth);
    const { language } = useLanguage();
    const localT = (key: keyof typeof i11n['en']) => i11n[language as 'en' | 'hu']?.[key] || key;

    return (
        <TableRow hover>
            <TableCell>{new Date(job.createdAt).toLocaleDateString()}</TableCell>
            <TableCell>
                <JobStatusChip job={job} showProgress={false} />
            </TableCell>
            <TableCell align="center">
                <ResponsiveTooltip title={isJobModified(job) ? localT('modified') : localT('original')}>
                    <InfoOutlined
                        className={`recent-job-info-icon ${isJobModified(job) ? 'modified' : ''}`}
                        fontSize="small"
                    />
                </ResponsiveTooltip>
            </TableCell>
            <TableCell>{job.patientName}</TableCell>
            <TableCell>{job.doctorName}</TableCell>
            <TableCell>{type}</TableCell>
            <TableCell>{material}</TableCell>
            <TableCell align="right">{job.unitCount}</TableCell>
            <TableCell align="right">{job.price ? formatCurrency(job.price, job.currency) : '-'}</TableCell>
            <TableCell align="center">
                <ResponsiveTooltip title={localT('editJob')}>
                    <IconButton onClick={() => onEdit(job)} size="small">
                        <Edit fontSize="small" />
                    </IconButton>
                </ResponsiveTooltip>
            </TableCell>
        </TableRow>
    );
};

export default RecentJobRow;
