import { describe, expect, it } from 'vitest';
import { invoiceService } from './invoiceService';
import type { Job } from '../types';

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

describe('invoiceService.validateJobsForInvoice', () => {
    it('should return null when jobs are valid', () => {
        const jobs = [createJob({ status: 'Calculated' })];
        expect(invoiceService.validateJobsForInvoice(jobs, new Set())).toBeNull();
    });

    it('should return error when jobs are not calculated', () => {
        const jobs = [createJob({ status: 'Pending' })];
        expect(invoiceService.validateJobsForInvoice(jobs, new Set())).toBe('jobs.notifications.onlyCalculated');
    });

    it('should return error when jobs are already invoiced', () => {
        const jobs = [createJob({ parentInvoiceId: 'inv-1' })];
        expect(invoiceService.validateJobsForInvoice(jobs, new Set())).toBe('jobs.notifications.alreadyInvoiced');
    });

    it('should return error when jobs are duplicates', () => {
        const hash = 'hash-123';
        const jobs = [createJob({ originalHash: hash, status: 'Calculated' })];
        const duplicateHashes = new Set([hash]);
        expect(invoiceService.validateJobsForInvoice(jobs, duplicateHashes)).toBe('jobs.notifications.containsDuplicates');
    });
});
