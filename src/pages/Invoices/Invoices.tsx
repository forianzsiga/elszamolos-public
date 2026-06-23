/**
 * @file Invoices.tsx
 * @description Renders the Invoices management page, including a personal details form,
 *              a list of generated invoices in an accordion layout, and a hidden printable
 *              invoice template. Supports invoice deletion with automatic job/teeth restoration
 *              and direct printing via react-to-print.
 */

import { useState, useRef } from 'react';
import { 
    Box, Typography, Paper, IconButton, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import { Delete, Print, KeyboardArrowRight } from '@mui/icons-material';
import { useJobs } from '../../context/JobContext';
import { useInvoices } from '../../context/InvoiceContext';
import { dbService } from '../../services/db';
import { formatCurrency, formatMixedCurrency } from '../../utils/text';
import type { Invoice, Job, PersonalDetails } from '../../types';
import { useReactToPrint } from 'react-to-print';
import { PersonalDetailsForm } from '../../components/PersonalDetailsForm';
import { PrintableInvoice } from '../../components/PrintableInvoice';
import { InvoicePreview } from '../../components/InvoicePreview';
import { ResponsiveTooltip } from '../../components/ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import './Invoices.css';
import i11n from './Invoices-i11n.json';

/**
 * InvoicesPage - Main invoices management page.
 *
 * Displays a personal details form and a list of invoices as expandable accordions.
 * Each accordion item shows the invoice number, date, job count, total amount, and
 * action buttons for printing and deleting. A hidden printable template is rendered
 * alongside for react-to-print.
 *
 * @returns The invoices page React element.
 */
export const InvoicesPage = () => {
    const { state: jobState, dispatch: jobDispatch } = useJobs();
    const { state: invoiceState, dispatch: invoiceDispatch } = useInvoices();
    const { personalDetails } = invoiceState;
    const { language } = useLanguage();

    const translations = i11n as Record<'en' | 'hu', Record<string, string>>;
    const localT = (key: string) => translations[language as 'en' | 'hu']?.[key] || key;

    /**
     * handleDetailsChange - Updates the personal details in the invoice context.
     * @param details - The new personal details object to store.
     */
    const handleDetailsChange = (details: PersonalDetails) => {
        invoiceDispatch({ type: 'SET_PERSONAL_DETAILS', payload: details });
    };
    
    const printRef = useRef<HTMLDivElement>(null);
    const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
    const [jobsForPrint, setJobsForPrint] = useState<Job[]>([]);

    /**
     * handleDeleteInvoice - Deletes an invoice after user confirmation.
     *                      Restores affected jobs/teeth in the database via
     *                      dbService and dispatches updates to both the job
     *                      and invoice contexts.
     * @param id - The unique identifier of the invoice to delete.
     * @param e  - The mouse event, which is stopped from propagating to
     *             prevent accidental accordion expansion.
     * @returns A promise that resolves once the invoice has been deleted
     *          and state has been updated.
     */
    const handleDeleteInvoice = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion expansion
        if (!window.confirm(localT('deleteConfirm'))) return;

        // Atomically restore affected jobs/teeth and delete the invoice in DB
        // dbService.deleteInvoiceAndRestore returns the list of jobs it updated.
        const restoredJobs = await dbService.deleteInvoiceAndRestore(id);
        if (restoredJobs.length > 0) {
            jobDispatch({ type: 'UPDATE_JOBS', payload: restoredJobs });
        }
        // Update Invoice state in context
        invoiceDispatch({ type: 'DELETE_INVOICE', payload: id });
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: selectedInvoiceForPrint ? selectedInvoiceForPrint.invoiceNumber : 'Invoice',
    });

    /**
     * selectForPrint - Prepares an invoice for printing by setting the
     *                  selected invoice and its related jobs into state,
     *                  then triggering the print handler after a short
     *                  render delay.
     * @param invoice - The invoice to be printed.
     * @param e       - The mouse event, which is stopped from propagating
     *                  to prevent accidental accordion expansion.
     */
    const selectForPrint = (invoice: Invoice, e: React.MouseEvent) => {
        e.stopPropagation();
        const relatedJobs = jobState.jobs.filter(job => job.parentInvoiceId === invoice.id);
        setJobsForPrint(relatedJobs);
        setSelectedInvoiceForPrint(invoice);
        // Short timeout to allow render before print
        setTimeout(handlePrint, 100);
    };

    /**
     * getInvoiceJobs - Retrieves all jobs that belong to a given invoice.
     * @param invoiceId - The ID of the invoice whose jobs should be fetched.
     * @returns An array of Job objects whose parentInvoiceId matches the
     *          supplied invoice ID.
     */
    const getInvoiceJobs = (invoiceId: string) => {
        return jobState.jobs.filter(job => job.parentInvoiceId === invoiceId);
    };

    return (
        <Box className="invoices-container">
            <Box className="invoices-header">
                <Typography variant="h4">{localT('pageTitle')}</Typography>
            </Box>
            
            <PersonalDetailsForm details={personalDetails} onDetailsChange={handleDetailsChange} />

            {/* Invoice List (Accordion) */}
            <Box>
                {invoiceState.invoices.length === 0 ? (
                    <Paper variant="outlined" className="no-invoices-paper">
                        <Typography>{localT('noInvoices')}</Typography>
                        <Typography variant="caption">{localT('createTip')}</Typography>
                    </Paper>
                ) : (
                    invoiceState.invoices.map((inv) => (
                        <Accordion key={inv.id} variant="outlined" disableGutters className="invoice-accordion">
                            <AccordionSummary 
                                expandIcon={<KeyboardArrowRight />}
                                className="accordion-summary"
                            >
                                <Box className="accordion-item-content">
                                    <Typography variant="subtitle1" fontWeight="bold" className="invoice-number">{inv.invoiceNumber}</Typography>
                                    <Typography variant="body2" className="invoice-date">
                                        {new Date(inv.createdAt).toLocaleDateString()}
                                    </Typography>
                                    <Typography variant="body2" className="invoice-job-count">
                                        {inv.jobCount} {localT('jobsCount')}
                                    </Typography>
                                    <Typography variant="subtitle1" fontWeight="bold" className="invoice-amount">
                                        {inv.currency === 'MIXED' ? formatMixedCurrency(getInvoiceJobs(inv.id)) : formatCurrency(inv.totalAmount, inv.currency)}
                                    </Typography>
                                    <Box className="invoice-actions">
                                        <ResponsiveTooltip title={localT('print')}>
                                            <IconButton onClick={(e) => selectForPrint(inv, e)} color="primary" size="small">
                                                <Print />
                                            </IconButton>
                                        </ResponsiveTooltip>
                                        <ResponsiveTooltip title={localT('delete')}>
                                            <IconButton onClick={(e) => handleDeleteInvoice(inv.id, e)} color="error" size="small">
                                                <Delete />
                                            </IconButton>
                                        </ResponsiveTooltip>
                                    </Box>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails className="accordion-details">
                                <InvoicePreview jobs={getInvoiceJobs(inv.id)} />
                            </AccordionDetails>
                        </Accordion>
                    ))
                )}
            </Box>

            {/* Hidden Print Template */}
            <div className="hidden-print-container">
                <PrintableInvoice 
                    ref={printRef}
                    invoice={selectedInvoiceForPrint}
                    jobs={jobsForPrint}
                    personalDetails={personalDetails}
                />
            </div>
        </Box>
    );
};
