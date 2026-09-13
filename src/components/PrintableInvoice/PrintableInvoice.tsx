/** @file PrintableInvoice.tsx - Component for rendering printable invoices with grouping by doctor */

import React from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, TableContainer } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { getThemeOptions } from '../../theme';
import type { Invoice, Job, PersonalDetails } from '../../types';
import { formatCurrency } from '../../utils/text';
import { useLanguage } from '../../context/LanguageContext';
import PrintableInvoiceFooter from '../PrintableInvoiceFooter';
import { groupJobsByDoctor, groupToothLines, getJobExtraLines, type GroupedLine } from '../../utils/invoiceGrouping';
import i11n from './PrintableInvoice-i11n.json';
import './PrintableInvoice.css';

/**
 * Props for the PrintableInvoice component
 * @interface PrintableInvoiceProps
 * @property {Invoice | null} invoice - The invoice data to display, or null if not available
 * @property {Job[]} jobs - Array of job data to include in the invoice
 * @property {PersonalDetails} personalDetails - Personal details for the invoice footer
 */
interface PrintableInvoiceProps {
    invoice: Invoice | null;
    jobs: Job[];
    personalDetails: PersonalDetails;
}


/**
 * Renders a single row in the invoice table
 * @param {Object} props - Component props
 * @param {Job} props.job - Job data for the row
 * @param {GroupedLine} props.data - Grouped line item data to display
 * @param {function} props.localT - Translation function for internationalization
 * @returns {JSX.Element} Table row component
 */
const InvoiceRow = ({ job, data, localT }: { job: Job, data: GroupedLine, localT: (key: keyof typeof i11n.en) => string }) => {
    return (
        <TableRow key={`${job.id}-${data.key}`} className="invoice-item-row">
            <TableCell className="item-cell">
                <Box display="flex" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="body2" fontWeight={600} color="#334155">
                        {data.kind === 'unitExtra' ? `+ ${data.label}` : data.label}
                    </Typography>
                    <Typography variant="caption" color="#cbd5e1" className="priority-caption">P{data.priority}</Typography>
                </Box>
                {data.kind !== 'jobExtra' && (
                    <Typography component="span" className="item-subtext">
                        {data.units.sort((a,b)=>a-b).join(', ')}
                    </Typography>
                )}
                {data.kind === 'jobExtra' && (
                    <Typography component="span" className="item-subtext">
                        {localT('jobExtraOnce')}
                    </Typography>
                )}
            </TableCell>
            <TableCell className="item-cell" align="center">
                {data.count}
            </TableCell>
            <TableCell className="item-cell" align="right">
                {formatCurrency(data.pricePerUnit, job.currency)}
            </TableCell>
            <TableCell className="item-cell item-cell-bold" align="right">
                {formatCurrency(data.count * data.pricePerUnit, job.currency)}
            </TableCell>
        </TableRow>
    );
};

const printTheme = createTheme(getThemeOptions('light'));

/**
 * Main printable invoice component that renders invoices grouped by doctor
 * Uses React.forwardRef to expose a ref to the root div element
 * @param {Object} props - Component props
 * @param {Invoice | null} props.invoice - Invoice data to display
 * @param {Job[]} props.jobs - Array of jobs to include in the invoice
 * @param {PersonalDetails} props.personalDetails - Personal details for invoice footer
 * @returns {JSX.Element | null} Printable invoice component or null if no invoice
 */
export const PrintableInvoice = React.forwardRef<HTMLDivElement, PrintableInvoiceProps>(({ invoice, jobs }, ref) => {
    const { language } = useLanguage();
    const localT = (key: keyof typeof i11n.en) => i11n[language as 'en' | 'hu']?.[key] || key;
    
    if (!invoice) return null;

    const groupedJobs = groupJobsByDoctor(jobs);

    return (
        <ThemeProvider theme={printTheme}>
            <div ref={ref}>
                <style type="text/css" media="print">
                    {`
                        @page { size: A4; margin: 0; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    `}
                </style>

            {Object.entries(groupedJobs).map(([doctorName, docJobs], index) => (
                <Paper key={doctorName} className={`invoice-page ${index > 0 ? 'page-break-before' : ''}`} elevation={0}>
                    {/* Header: Just Doctor Name and Date */}
                    <Box className="header-container">
                        <Box>
                            <Typography className="doc-name">{doctorName}</Typography>
                            <Typography className="doc-meta">
                                {localT('dateIssue')}: {new Date(invoice.createdAt).toLocaleDateString()}
                            </Typography>
                        </Box>
                        <Box className="header-right">
                            <Typography variant="body2" className="header-sub-caption">
                                {localT('footerMockData')}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Job List */}
                    <Box>
                        {docJobs.map(job => {
                            const groupedToothLines = groupToothLines(job.teeth);
                            const jobExtraLines = getJobExtraLines(job);
                            const invoiceLines = [...groupedToothLines, ...jobExtraLines]
                                .sort((a, b) => a.priority - b.priority);
                            
                            return (
                                <Box key={job.id} className="job-container">
                                    {/* Job Header */}
                                    <Box className="job-header">
                                        <Typography className="job-title">
                                            {job.patientName}
                                        </Typography>
                                        <Typography className="job-filename">
                                            {job.fileName}
                                        </Typography>
                                    </Box>

                                    {/* Items Table */}
                                    <TableContainer component={Box} className="items-table-container">
                                        <Table size="small" className="items-table">
                                            <TableHead>
                                                <TableRow className="table-header-row">
                                                    <TableCell className="table-header-cell col-width-60">{localT('description')}</TableCell>
                                                    <TableCell className="table-header-cell col-width-10" align="center">{localT('qty')}</TableCell>
                                                    <TableCell className="table-header-cell col-width-15" align="right">{localT('unitPrice')}</TableCell>
                                                    <TableCell className="table-header-cell col-width-15" align="right">{localT('total')}</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {invoiceLines
                                                    .map((data) => (
                                                        <InvoiceRow key={`${job.id}-${data.key}`} job={job} data={data} localT={localT} />
                                                    ))
                                                }
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            );
                        })}
                    </Box>

                    <PrintableInvoiceFooter invoice={invoice} jobs={docJobs} />
                </Paper>
            ))}
            </div>
        </ThemeProvider>
    );
});
