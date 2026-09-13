import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { deleteDB } from 'idb';
import { dbService, initDB } from './db';

const describeIfIndexedDB = typeof indexedDB === 'undefined' ? describe.skip : describe;

describeIfIndexedDB('dbService.reconcileOrphanedInvoicedJobs', () => {
    beforeEach(async () => {
        await deleteDB('DentalRaktarDB');
        await initDB();
    });

    afterEach(async () => {
        await deleteDB('DentalRaktarDB');
    });

    it('reconciles jobs that reference missing invoices', async () => {
        const job = {
            id: 'job-missing-inv',
            title: 'Test Job',
            price: 100,
            status: 'Invoiced',
            parentInvoiceId: 'inv-does-not-exist',
            teeth: [
                { number: 11, material: 'Titanium', type: 'Crown', status: 'Invoiced', parentInvoiceId: 'inv-does-not-exist' }
            ],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await dbService.addJob(job as any);

        const updated = await dbService.reconcileOrphanedInvoicedJobs();
        expect(updated).toContain('job-missing-inv');

        const jobs = await dbService.getAllJobs();
        const j = jobs.find((item) => item.id === 'job-missing-inv');
        expect(j).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((j as any).parentInvoiceId).toBeUndefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((j as any).status).toBe('Calculated');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((j as any).teeth[0].parentInvoiceId).toBeUndefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((j as any).teeth[0].status).toBe('Calculated');
    });
});
