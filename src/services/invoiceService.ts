/** @file Service for managing invoice-related business logic, including job-to-invoice assignment, invoice creation, and invoice synchronization from job state. */
import { dbService } from './db';
import type { Job, Invoice } from '../types';

/** Currency type supported by an invoice — either a specific currency ('HUF', 'EUR') or 'MIXED'. */
type InvoiceCurrency = Invoice['currency'];

/** Prefix used to identify orphan/recovered invoices automatically created during reconciliation. */
const ORPHAN_INVOICE_PREFIX = 'recovered-orphan';

/** Normalize a currency string to the InvoiceCurrency type. Defaults to 'MIXED' for unrecognized values. */
const normalizeCurrency = (currency?: string): InvoiceCurrency => {
    if (currency === 'HUF' || currency === 'EUR') return currency;
    return 'MIXED';
};

/** Parse an ISO date string to a numeric timestamp, falling back to the current time for invalid or missing values. */
const parseTimestamp = (isoDate?: string): number => {
    if (!isoDate) return Date.now();
    const parsed = Date.parse(isoDate);
    return Number.isNaN(parsed) ? Date.now() : parsed;
};

/** Derive the overall currency for an invoice from its associated jobs. Returns 'MIXED' if jobs use different currencies. */
const deriveInvoiceCurrency = (jobs: Job[]): InvoiceCurrency => {
    const currencies = new Set(jobs.map(job => normalizeCurrency(job.currency)));
    if (currencies.size === 1) {
        return Array.from(currencies)[0];
    }
    return 'MIXED';
};

/** Create a deterministic JSON snapshot of invoice summaries for change detection. */
const invoiceSnapshot = (invoices: Invoice[]): string => {
    return JSON.stringify(
        [...invoices]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map(invoice => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                startDate: invoice.startDate,
                endDate: invoice.endDate,
                createdAt: invoice.createdAt,
                totalAmount: invoice.totalAmount,
                currency: invoice.currency,
                jobCount: invoice.jobCount,
            }))
    );
};

/** Generate a recovered invoice number for orphan or recovered invoices. */
const getRecoveredInvoiceNumber = (invoiceId: string, currency: InvoiceCurrency): string => {
    if (invoiceId.startsWith(ORPHAN_INVOICE_PREFIX)) {
        return `REC-${currency}`;
    }
    return `REC-${invoiceId.slice(0, 8).toUpperCase()}`;
};

/** Result of synchronising invoices from the current job state. */
export interface InvoiceSyncResult {
    jobs: Job[];
    changedJobs: Job[];
    invoices: Invoice[];
    jobsChanged: boolean;
    invoicesChanged: boolean;
}

/**
 * Service for handling Invoice-related business logic.
 */
export const invoiceService = {
    /**
     * Validates if a set of jobs can be added to an invoice.
     * @param jobs - The jobs to validate.
     * @param duplicateHashes - A set of hashes to check for duplicate jobs.
     * @returns A string error message if validation fails, null otherwise.
     */
    validateJobsForInvoice(jobs: Job[], duplicateHashes: Set<string>): string | null {
        const invalidJobs = jobs.filter(j => j.status !== 'Calculated');
        if (invalidJobs.length > 0) {
            return 'jobs.notifications.onlyCalculated';
        }
        
        const alreadyInvoiced = jobs.filter(j => j.parentInvoiceId);
        if (alreadyInvoiced.length > 0) {
            return 'jobs.notifications.alreadyInvoiced';
        }

        const hasDuplicates = jobs.some(j => j.originalHash && duplicateHashes.has(j.originalHash));
        if (hasDuplicates) {
            return 'jobs.notifications.containsDuplicates';
        }

        return null;
    },

    /**
     * Creates a new template invoice object.
     * @param existingInvoicesCount - The number of existing invoices, used for generating the next invoice number.
     * @param firstJob - Optional first job to derive the default currency from.
     * @returns A new Invoice object with sensible defaults.
     */
    createNewInvoice(existingInvoicesCount: number, firstJob?: Job): Invoice {
        return {
            id: crypto.randomUUID(),
            invoiceNumber: `INV-${new Date().getFullYear()}-${String(existingInvoicesCount + 1).padStart(3, '0')}`,
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            totalAmount: 0,
            currency: (firstJob?.currency as 'HUF' | 'EUR') || 'HUF',
            jobCount: 0
        };
    },

    /**
     * Orchestrates the assignment of jobs to an invoice in the DB.
     * @param invoiceId - The ID of the target invoice.
     * @param jobIds - The IDs of the jobs to assign.
     * @returns A promise resolving to the updated Invoice.
     */
    async assignJobs(invoiceId: string, jobIds: string[]): Promise<Invoice> {
        return await dbService.assignJobsToInvoice(invoiceId, jobIds);
    },

    /**
     * Reconciles invoice records based on invoiced job state.
     * Jobs are the source-of-truth for invoicing linkage and status.
     * @param jobs - The full list of jobs to reconcile against.
     * @param existingInvoices - The existing invoices to compare and update.
     * @returns The synchronisation result with updated jobs, invoices, and change flags.
     */
    syncInvoicesFromJobs(jobs: Job[], existingInvoices: Invoice[]): InvoiceSyncResult {
        const groups = new Map<string, Job[]>();
        const changedJobs: Job[] = [];

        const normalizedJobs = jobs.map(job => {
            const teethArray = job.teeth || [];
            const toothInvoiceIds = Array.from(
                new Set(
                    teethArray
                        .map(tooth => tooth.parentInvoiceId)
                        .filter((id): id is string => Boolean(id))
                )
            );

            const inferredParentFromTeeth = toothInvoiceIds.length === 1 ? toothInvoiceIds[0] : undefined;
            const hasInvoicedTooth = teethArray.some(tooth => tooth.status === 'Invoiced' || Boolean(tooth.parentInvoiceId));
            const isInvoiced = job.status === 'Invoiced' || Boolean(job.parentInvoiceId) || hasInvoicedTooth;

            if (!isInvoiced) {
                return job;
            }

            const assignedInvoiceId =
                job.parentInvoiceId ||
                inferredParentFromTeeth ||
                `${ORPHAN_INVOICE_PREFIX}-${normalizeCurrency(job.currency).toLowerCase()}`;

            let teethChanged = false;
            const updatedTeeth = teethArray.map(tooth => {
                if (tooth.status === 'Invoiced' && tooth.parentInvoiceId === assignedInvoiceId) {
                    return tooth;
                }

                teethChanged = true;
                return {
                    ...tooth,
                    status: 'Invoiced' as const,
                    parentInvoiceId: assignedInvoiceId,
                };
            });

            const jobNeedsUpdate =
                job.status !== 'Invoiced' ||
                job.parentInvoiceId !== assignedInvoiceId ||
                teethChanged;

            const normalizedJob = jobNeedsUpdate
                ? {
                    ...job,
                    status: 'Invoiced' as const,
                    parentInvoiceId: assignedInvoiceId,
                    teeth: updatedTeeth,
                }
                : job;

            if (jobNeedsUpdate) {
                changedJobs.push(normalizedJob);
            }

            const grouped = groups.get(assignedInvoiceId) || [];
            grouped.push(normalizedJob);
            groups.set(assignedInvoiceId, grouped);

            return normalizedJob;
        });

        const existingById = new Map(existingInvoices.map(invoice => [invoice.id, invoice]));

        const synchronizedInvoices = Array.from(groups.entries())
            .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
            .map(([invoiceId, invoiceJobs]) => {
                const existing = existingById.get(invoiceId);
                const sortedByCreated = [...invoiceJobs].sort((left, right) => parseTimestamp(left.createdAt) - parseTimestamp(right.createdAt));
                const startTimestamp = parseTimestamp(sortedByCreated[0]?.createdAt);
                const endTimestamp = parseTimestamp(sortedByCreated[sortedByCreated.length - 1]?.createdAt);
                const currency = deriveInvoiceCurrency(invoiceJobs);
                const totalAmount = invoiceJobs.reduce((sum, job) => sum + (job.price || 0), 0);

                return {
                    id: invoiceId,
                    invoiceNumber: existing?.invoiceNumber || getRecoveredInvoiceNumber(invoiceId, currency),
                    startDate: new Date(startTimestamp).toISOString(),
                    endDate: new Date(endTimestamp).toISOString(),
                    createdAt: existing?.createdAt || new Date(startTimestamp).toISOString(),
                    totalAmount,
                    currency,
                    jobCount: invoiceJobs.length,
                } satisfies Invoice;
            })
            .sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt));

        return {
            jobs: normalizedJobs,
            changedJobs,
            invoices: synchronizedInvoices,
            jobsChanged: changedJobs.length > 0,
            invoicesChanged: invoiceSnapshot(existingInvoices) !== invoiceSnapshot(synchronizedInvoices),
        };
    },
};
