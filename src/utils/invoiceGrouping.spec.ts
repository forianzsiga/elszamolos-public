import { describe, expect, it } from 'vitest';
import { groupJobsByDoctor } from './invoiceGrouping';
import type { Job } from '../types';

const createJob = (overrides: Partial<Job> = {}): Job => ({
    id: overrides.id || 'job-1',
    patientName: overrides.patientName || 'Patient',
    doctorName: overrides.doctorName || 'Doctor',
    fileName: overrides.fileName || 'file.dentalproject',
    createdAt: overrides.createdAt || '2026-04-05T10:00:00.000Z',
    teeth: overrides.teeth || [],
    unitCount: overrides.unitCount ?? 1,
    status: overrides.status || 'Calculated',
    price: overrides.price ?? 100,
    currency: overrides.currency || 'HUF',
    notes: overrides.notes || '',
});

describe('invoiceGrouping.groupJobsByDoctor', () => {
    it('should group jobs by doctor and sort them by date and id', () => {
        const docName = 'Dr. Smith';
        const jobs: Job[] = [
            createJob({ id: 'job-2', doctorName: docName, createdAt: '2026-04-06T10:00:00.000Z' }),
            createJob({ id: 'job-1', doctorName: docName, createdAt: '2026-04-05T10:00:00.000Z' }),
            createJob({ id: 'job-3', doctorName: docName, createdAt: '2026-04-05T10:00:00.000Z' }), // Same date as job-1, should sort by ID
        ];

        const grouped = groupJobsByDoctor(jobs);

        expect(grouped[docName]).toHaveLength(3);
        expect(grouped[docName][0].id).toBe('job-1');
        expect(grouped[docName][1].id).toBe('job-3');
        expect(grouped[docName][2].id).toBe('job-2');
    });
});
