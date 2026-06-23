/** @file InvoicePreview.tsx - Component that renders a formatted invoice preview grouped by doctor, patient, and job. */

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider, Stack } from '@mui/material';
import type { Job } from '../../types';
import { formatCurrency, formatMixedCurrency } from '../../utils/text';
import { useLanguage } from '../../context/LanguageContext';
import { groupJobsStructure, groupToothLines, getJobExtraLines, type GroupedLine } from '../../utils/invoiceGrouping';
import i11n from './InvoicePreview-i11n.json';
import './InvoicePreview.css';

/**
 * Props for the InvoicePreview component.
 */
interface InvoicePreviewProps {
    jobs: Job[];
}

/**
 * Renders a single table row for an invoice line item.
 * @param data - The grouped invoice line data to display.
 * @param job - The parent job containing currency and context info.
 * @param localT - Translation function for i18n keys.
 * @param idx - Row index used as React key.
 * @returns A TableRow JSX element.
 */
const renderInvoiceLine = (data: GroupedLine, job: Job, localT: (key: string) => string, idx: number) => (
    <TableRow key={idx}>
        <TableCell className="table-cell-no-border">
            <Typography variant="body2">
                {data.kind === 'unitExtra' ? `+ ${data.label}` : data.label}
            </Typography>
            {data.kind !== 'jobExtra' && (
                <Typography variant="caption" color="text.disabled">
                    {localT('units')} {data.units.sort((a: number, b: number) => a - b).join(', ')}
                </Typography>
            )}
            {data.kind === 'jobExtra' && (
                <Typography variant="caption" color="text.disabled">
                    {localT('jobExtraOnce')}
                </Typography>
            )}
        </TableCell>
        <TableCell align="center" className="table-cell-no-border table-cell-align-top">
            {data.count}
        </TableCell>
        <TableCell align="right" className="table-cell-no-border table-cell-align-top">
            {formatCurrency(data.pricePerUnit, job.currency)}
        </TableCell>
        <TableCell align="right" className="table-cell-no-border table-cell-align-top">
            {formatCurrency(data.count * data.pricePerUnit, job.currency)}
        </TableCell>
    </TableRow>
);

/**
 * Renders a single job section including its header, invoice line items, and total.
 * @param job - The job data to render.
 * @param localT - Translation function for i18n keys.
 * @returns A Box JSX element containing the job header, table, and total.
 */
const renderJob = (job: Job, localT: (key: string) => string) => {
    const groupedToothLines = groupToothLines(job.teeth);
    const jobExtraLines = getJobExtraLines(job);
    const invoiceLines = [...groupedToothLines, ...jobExtraLines]
        .sort((a: GroupedLine, b: GroupedLine) => a.priority - b.priority);

    return (
        <Box key={job.id}>
            <Box className="job-header">
                <Typography variant="body2" color="text.secondary">
                    {localT('jobDate')} {new Date(job.createdAt).toLocaleDateString()}
                </Typography>
                <Typography variant="caption" className="job-id">
                    {localT('id')} {job.id.substring(0, 8)}
                </Typography>
            </Box>
            
            <TableContainer className="table-container">
                <Table size="small" padding="none">
                    <TableHead>
                        <TableRow>
                            <TableCell className="table-head-cell">{localT('item')}</TableCell>
                            <TableCell align="center" className="table-head-cell">{localT('qty')}</TableCell>
                            <TableCell align="right" className="table-head-cell">{localT('price')}</TableCell>
                            <TableCell align="right" className="table-head-cell">{localT('total')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {invoiceLines.map((data, idx) => renderInvoiceLine(data, job, localT, idx))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box className="total-container">
                <Typography variant="subtitle2" fontWeight="bold">
                    {localT('invoiceTotal')}: {job.currency === 'MIXED' ? formatMixedCurrency([job]) : formatCurrency(job.price, job.currency)}
                </Typography>
            </Box>
        </Box>
    );
};

/**
 * Renders a patient section containing all of their jobs in a Paper container.
 * @param patientName - The name of the patient.
 * @param patientJobs - Array of jobs belonging to this patient.
 * @param localT - Translation function for i18n keys.
 * @returns A Paper JSX element containing the patient header and job list.
 */
const renderPatient = (patientName: string, patientJobs: Job[], localT: (key: string) => string) => (
    <Paper key={patientName} elevation={1} className="patient-paper">
        <Box className="patient-header">
            <Typography variant="subtitle2" fontWeight="bold">{localT('patient')} {patientName}</Typography>
        </Box>
        
        {patientJobs.map(job => renderJob(job, localT))}
        
        {/* Divider between jobs for same patient if any (though usually 1 job per patient file, but logic supports multiple) */}
        {patientJobs.length > 1 && <Divider />}
    </Paper>
);

/**
 * InvoicePreview component - displays a formatted invoice preview grouped by doctor, patient, and job.
 *
 * Uses the language context for translations and groups jobs hierarchically:
 * doctor -> patient -> job -> invoice line items.
 *
 * @param props.jobs - Array of jobs to display in the invoice preview.
 * @returns The invoice preview JSX tree.
 */
export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ jobs }) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n[language as 'en' | 'hu'] as Record<string, string>)?.[key] || key;
    const structure = groupJobsStructure(jobs);


    return (
        <Box className="invoice-preview-container">
            {Object.entries(structure).map(([doctorName, patients]) => (
                <Paper key={doctorName} variant="outlined" className="doctor-paper">
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom className="doctor-title">
                        {localT('doctor')} {doctorName}
                        <Chip size="small" label={`${Object.values(patients).flat().length} ${localT('jobs')}`} />
                    </Typography>
                    
                    <Stack spacing={2}>
                        {Object.entries(patients).map(([patientName, patientJobs]) => renderPatient(patientName, patientJobs, localT))}
                    </Stack>
                </Paper>
            ))}
        </Box>
    );
};
