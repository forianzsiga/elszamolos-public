/** 
 * @file PrintableInvoiceFooter.tsx
 * @description Footer component for printable invoices showing total amounts and disclaimers.
 * This component displays the total invoice amount with proper currency formatting
 * and includes legal/application disclaimers for printed invoices.
 * @module PrintableInvoiceFooter
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import type { Invoice, Job } from '../../types';
import { formatCurrency, formatMixedCurrency } from '../../utils/text';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './PrintableInvoiceFooter-i11n.json';
import './PrintableInvoiceFooter.css';

/**
 * Props for the PrintableInvoiceFooter component.
 * @interface PrintableInvoiceFooterProps
 * @property {Invoice} invoice - The invoice data to display totals for
 * @property {Job[]} [jobs] - Optional list of jobs associated with the invoice (required for MIXED currency calculations)
 */
interface PrintableInvoiceFooterProps {
    invoice: Invoice;
    jobs?: Job[];
}

/**
 * Footer component for printable invoices that displays total amounts and disclaimers.
 * This component handles both single-currency and mixed-currency invoice totals,
 * providing proper formatting based on the invoice's currency type.
 * 
 * @function PrintableInvoiceFooter
 * @param {PrintableInvoiceFooterProps} props - Component properties
 * @param {Invoice} props.invoice - The invoice data containing total amount and currency
 * @param {Job[]} [props.jobs] - Optional array of jobs for mixed currency calculations
 * @returns {JSX.Element} Rendered invoice footer with totals and disclaimer
 * 
 * @example
 * ```tsx
 * <PrintableInvoiceFooter invoice={invoiceData} jobs={jobList} />
 * ```
 */
export const PrintableInvoiceFooter: React.FC<PrintableInvoiceFooterProps> = ({ invoice, jobs }) => {
    const { language } = useLanguage();
    const localT = (key: keyof typeof i11n['en']) => i11n[language as 'en' | 'hu']?.[key] || key;

    const displayTotal = invoice.currency === 'MIXED' && jobs && jobs.length > 0
        ? formatMixedCurrency(jobs)
        : formatCurrency(invoice.totalAmount, invoice.currency);

    return (
        <>
            <Box className="totalsSection">
                <Box className="grandTotalBox">
                    <Typography>{localT('total')}:</Typography>
                    <Typography>{displayTotal}</Typography>
                </Box>
            </Box>

            <Box className="disclaimer">
                {localT('generatedBy')} <strong>{localT('appTitle')}</strong>. <br/>
                {localT('disclaimer')}
            </Box>
        </>
    );
};

export default PrintableInvoiceFooter;
