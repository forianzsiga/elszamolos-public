import { describe, expect, it } from 'vitest';
import { invoiceService } from './invoiceService';
import type { Job, Invoice } from '../types';

const createJob = (overrides: Partial<Job> = {}): Job => ({
    id: overrides.id || 'job-1',
    patientName: overrides.patientName || 'Patient',
    doctorName: overrides.doctorName || 'Doctor',
    fileName: overrides.fileName || 'file.dentalproject',
    createdAt: overrides.createdAt || '2026-04-05T10:00:00.000Z',
    teeth: overrides.teeth || [{ number: 11, material: 'Zirconia', type: 'Crown' }],
    unitCount: overrides.unitCount ?? 1,
    status: overrides.status || 'Calculated',
    price: overrides.price ?? 100,
    currency: overrides.currency || 'HUF',
    notes: overrides.notes || '',
    parentInvoiceId: overrides.parentInvoiceId,
    projectId: overrides.projectId,
    validationErrors: overrides.validationErrors,
    originalHash: overrides.originalHash,
    teethMatched: overrides.teethMatched,
    appliedJobRules: overrides.appliedJobRules,
    basePrice: overrides.basePrice,
    extraPrice: overrides.extraPrice,
});

const createInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
    id: overrides.id || 'inv-existing-1',
    invoiceNumber: overrides.invoiceNumber || 'INV-2026-001',
    startDate: overrides.startDate || '2026-04-01T00:00:00.000Z',
    endDate: overrides.endDate || '2026-04-02T00:00:00.000Z',
    createdAt: overrides.createdAt || '2026-04-01T00:00:00.000Z',
    totalAmount: overrides.totalAmount ?? 0,
    currency: overrides.currency || 'HUF',
    jobCount: overrides.jobCount ?? 0,
});

describe('invoiceService.syncInvoicesFromJobs', () => {
    it('rebuilds invoice rows from job invoice links and preserves existing invoice identity fields', () => {
        const jobs: Job[] = [
            createJob({
                id: 'job-a',
                parentInvoiceId: 'inv-existing-1',
                status: 'Invoiced',
                price: 120,
                createdAt: '2026-04-03T10:00:00.000Z',
                teeth: [{ number: 11, material: 'Zirconia', type: 'Crown', status: 'Calculated' }],
            }),
            createJob({
                id: 'job-b',
                parentInvoiceId: 'inv-existing-1',
                status: 'Calculated',
                price: 80,
                createdAt: '2026-04-04T10:00:00.000Z',
                teeth: [{ number: 12, material: 'Zirconia', type: 'Crown', status: 'Pending' }],
            }),
        ];
        const existing = [
            createInvoice({
                id: 'inv-existing-1',
                invoiceNumber: 'INV-2026-999',
                createdAt: '2026-01-01T00:00:00.000Z',
            }),
        ];

        const result = invoiceService.syncInvoicesFromJobs(jobs, existing);

        expect(result.invoices).toHaveLength(1);
        expect(result.invoices[0].id).toBe('inv-existing-1');
        expect(result.invoices[0].invoiceNumber).toBe('INV-2026-999');
        expect(result.invoices[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
        expect(result.invoices[0].jobCount).toBe(2);
        expect(result.invoices[0].totalAmount).toBe(200);

        const updatedJobB = result.jobs.find(job => job.id === 'job-b');
        expect(updatedJobB?.status).toBe('Invoiced');
        expect(updatedJobB?.parentInvoiceId).toBe('inv-existing-1');
        expect(updatedJobB?.teeth.every(tooth => tooth.status === 'Invoiced')).toBe(true);

        expect(result.jobsChanged).toBe(true);
        expect(result.invoicesChanged).toBe(true);
    });

    it('recovers orphan invoiced jobs into deterministic fallback invoice ids', () => {
        const jobs: Job[] = [
            createJob({
                id: 'job-orphan',
                status: 'Invoiced',
                parentInvoiceId: undefined,
                currency: 'HUF',
                teeth: [{ number: 21, material: 'Zirconia', type: 'Crown' }],
            }),
        ];

        const result = invoiceService.syncInvoicesFromJobs(jobs, []);

        expect(result.invoices).toHaveLength(1);
        expect(result.invoices[0].id).toBe('recovered-orphan-huf');
        expect(result.invoices[0].invoiceNumber).toBe('REC-HUF');
        expect(result.invoices[0].currency).toBe('HUF');

        const normalized = result.jobs[0];
        expect(normalized.parentInvoiceId).toBe('recovered-orphan-huf');
        expect(normalized.status).toBe('Invoiced');
        expect(normalized.teeth[0].parentInvoiceId).toBe('recovered-orphan-huf');
        expect(normalized.teeth[0].status).toBe('Invoiced');
    });

    it('derives invoice id from tooth-level invoice links when job-level link is missing', () => {
        const jobs: Job[] = [
            createJob({
                id: 'job-tooth-linked',
                status: 'Calculated',
                parentInvoiceId: undefined,
                teeth: [
                    { number: 31, material: 'Zirconia', type: 'Crown', parentInvoiceId: 'inv-teeth-1', status: 'Invoiced' },
                    { number: 32, material: 'Zirconia', type: 'Crown', parentInvoiceId: 'inv-teeth-1', status: 'Calculated' },
                ],
            }),
        ];

        const result = invoiceService.syncInvoicesFromJobs(jobs, []);

        expect(result.invoices).toHaveLength(1);
        expect(result.invoices[0].id).toBe('inv-teeth-1');

        const normalized = result.jobs[0];
        expect(normalized.parentInvoiceId).toBe('inv-teeth-1');
        expect(normalized.teeth.every(tooth => tooth.parentInvoiceId === 'inv-teeth-1')).toBe(true);
        expect(normalized.teeth.every(tooth => tooth.status === 'Invoiced')).toBe(true);
    });

    it('marks invoice currency as MIXED when linked jobs have different currencies', () => {
        const jobs: Job[] = [
            createJob({
                id: 'job-huf',
                parentInvoiceId: 'inv-mixed-1',
                status: 'Invoiced',
                currency: 'HUF',
                price: 50,
            }),
            createJob({
                id: 'job-eur',
                parentInvoiceId: 'inv-mixed-1',
                status: 'Invoiced',
                currency: 'EUR',
                price: 60,
            }),
        ];

        const result = invoiceService.syncInvoicesFromJobs(jobs, []);

        expect(result.invoices).toHaveLength(1);
        expect(result.invoices[0].currency).toBe('MIXED');
        expect(result.invoices[0].totalAmount).toBe(110);
    });

    it('flags stale invoice rows for cleanup when no jobs are invoiced', () => {
        const jobs: Job[] = [
            createJob({ id: 'job-pending', status: 'Pending', parentInvoiceId: undefined, teeth: [{ number: 41, material: 'Zirconia', type: 'Crown' }] }),
        ];
        const existing = [createInvoice({ id: 'inv-stale-1' })];

        const result = invoiceService.syncInvoicesFromJobs(jobs, existing);

        expect(result.invoices).toHaveLength(0);
        expect(result.jobsChanged).toBe(false);
        expect(result.invoicesChanged).toBe(true);
    });

    it('is stable and idempotent when jobs and invoices are already synchronized', () => {
        const jobs: Job[] = [
            createJob({
                id: 'job-synced',
                status: 'Invoiced',
                parentInvoiceId: 'inv-synced-1',
                createdAt: '2026-04-05T10:00:00.000Z',
                price: 77,
                teeth: [{ number: 11, material: 'Zirconia', type: 'Crown', status: 'Invoiced', parentInvoiceId: 'inv-synced-1' }],
            }),
        ];
        const existing: Invoice[] = [
            createInvoice({
                id: 'inv-synced-1',
                invoiceNumber: 'INV-2026-123',
                createdAt: '2026-04-05T10:00:00.000Z',
                startDate: '2026-04-05T10:00:00.000Z',
                endDate: '2026-04-05T10:00:00.000Z',
                totalAmount: 77,
                currency: 'HUF',
                jobCount: 1,
            }),
        ];

        const result = invoiceService.syncInvoicesFromJobs(jobs, existing);

        expect(result.jobsChanged).toBe(false);
        expect(result.invoicesChanged).toBe(false);
        expect(result.changedJobs).toHaveLength(0);
        expect(result.invoices).toEqual(existing);
    });
});
