import { beforeEach, describe, it, expect } from 'vitest';
import { dbService, initDB } from './db';

const DB_NAME = 'DentalRaktarDB';
const describeIfIndexedDB = typeof indexedDB === 'undefined' ? describe.skip : describe;

async function clearDatabase() {
  // In jsdom environment indexedDB is available
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describeIfIndexedDB('dbService.deleteInvoiceAndRestore', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('restores jobs and teeth and removes the invoice', async () => {
    // Prepare DB: add an invoice and a job referencing it
    const invoice = { id: 'inv-1', invoiceNumber: 'INV-1', createdAt: new Date().toISOString(), jobCount: 1, totalAmount: 100, currency: 'HUF' };

    const job = {
      id: 'job-1',
      patientName: 'Test',
      doctorName: 'Dr',
      fileName: 'f',
      createdAt: new Date().toISOString(),
      teeth: [ { number: 11, status: 'Invoiced', parentInvoiceId: 'inv-1' } ],
      unitCount: 1,
      status: 'Invoiced',
      price: 100,
      currency: 'HUF',
      parentInvoiceId: 'inv-1',
    };

    await initDB();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await dbService.addInvoice(invoice as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await dbService.addJobs([job as any]);

    // Call delete+restore
    const restored = await dbService.deleteInvoiceAndRestore('inv-1');

    expect(restored.length).toBe(1);
    const rjob = restored[0];
    expect(rjob.parentInvoiceId).toBeUndefined();
    expect(rjob.status).toBe('Calculated');
    expect(rjob.teeth[0].parentInvoiceId).toBeUndefined();
    expect(rjob.teeth[0].status).toBe('Calculated');

    const invoices = await dbService.getAllInvoices();
    expect(invoices.find(i => i.id === 'inv-1')).toBeUndefined();

    // Idempotency: running again should succeed and return no additional changes
    const again = await dbService.deleteInvoiceAndRestore('inv-1');
    expect(again.length).toBe(0);
  });
});
