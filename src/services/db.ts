/** @file IndexedDB database service for the dental accounting application. Provides CRUD operations for jobs, invoices, tariffs, assets, logs, and metadata using IndexedDB via the idb library. */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Job, TariffRule, Invoice } from '../types';

/** Metadata key identifiers for reusable dropdown values dynamically extracted from job data. */
type MetadataKey = 'materials' | 'types' | 'doctors' | 'patients';

/**
 * Database Schema definition for IndexedDB.
 */
interface DentalDB extends DBSchema {
    jobs: {
        key: string;
        value: Job;
    };
    assets: {
        key: string;
        value: {
            id: string;
            jobId: string;
            fileName: string;
            mimeType: string;
            size: number;
            createdAt: string;
            data: Blob;
        };
    };
    tariffs: {
        key: string;
        value: TariffRule;
    };
    invoices: {
        key: string;
        value: Invoice;
    };
    metadata: {
        key: string;
        value: string[];
    };
    logs: {
        key: string;
        value: {
            id: string;
            timestamp: string;
            message: string;
            severity: 'success' | 'info' | 'warning' | 'error';
            details?: string;
        };
    };
}

/** The name of the IndexedDB database used by the application. */
const DB_NAME = 'DentalRaktarDB';
/** The current version of the IndexedDB database schema. Increment when adding or modifying object stores. */
const DB_VERSION = 5; // Incremented for assets + logs

/**
 * Initializes the IndexedDB database.
 * Creates object stores if they don't exist.
 */
export const initDB = async (): Promise<IDBPDatabase<DentalDB>> => {
    return openDB<DentalDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('jobs')) {
                db.createObjectStore('jobs', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('tariffs')) {
                db.createObjectStore('tariffs', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('invoices')) {
                db.createObjectStore('invoices', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata');
            }
            if (!db.objectStoreNames.contains('assets')) {
                db.createObjectStore('assets', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('logs')) {
                db.createObjectStore('logs', { keyPath: 'id' });
            }
        },
    });
};

/**
 * Jobs Service Operations
 */
export const dbService = {
    // ... existing job/tariff methods ...

    /**
     * Log Service Operations
     */
    async getAllLogs(): Promise<DentalDB['logs']['value'][]> {
        const db = await initDB();
        return db.getAll('logs');
    },

    /**
     * Adds a new log entry to the database.
     * @param log - The log entry to persist.
     * @returns A promise that resolves when the operation completes.
     */
    async addLog(log: DentalDB['logs']['value']): Promise<void> {
        const db = await initDB();
        await db.add('logs', log);
    },

    /**
     * Removes all log entries from the database.
     * @returns A promise that resolves when the operation completes.
     */
    async clearLogs(): Promise<void> {
        const db = await initDB();
        await db.clear('logs');
    },

    /**
     * Invoice Service Operations
     */
    async getAllInvoices(): Promise<Invoice[]> {
        const db = await initDB();
        return db.getAll('invoices');
    },

    /**
     * Adds a new invoice to the database.
     * @param invoice - The invoice to persist.
     * @returns A promise that resolves when the operation completes.
     */
    async addInvoice(invoice: Invoice): Promise<void> {
        const db = await initDB();
        await db.add('invoices', invoice);
    },

    /**
     * Updates an existing invoice in the database.
     * @param invoice - The invoice with updated fields to persist.
     * @returns A promise that resolves when the operation completes.
     */
    async updateInvoice(invoice: Invoice): Promise<void> {
        const db = await initDB();
        await db.put('invoices', invoice);
    },

    /**
     * Inserts or updates multiple invoices atomically within a single transaction.
     * Existing invoices with matching IDs are overwritten.
     * @param invoices - The array of invoices to upsert.
     * @returns A promise that resolves when the transaction completes.
     */
    async upsertInvoices(invoices: Invoice[]): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('invoices', 'readwrite');
        const store = tx.objectStore('invoices');
        await Promise.all(invoices.map(invoice => store.put(invoice)));
        await tx.done;
    },

    /**
     * Deletes a single invoice by its unique identifier.
     * @param id - The ID of the invoice to delete.
     * @returns A promise that resolves when the operation completes.
     */
    async deleteInvoice(id: string): Promise<void> {
        const db = await initDB();
        await db.delete('invoices', id);
    },

    /**
     * Deletes multiple invoices by their IDs in a single transaction.
     * @param ids - The array of invoice IDs to delete.
     * @returns A promise that resolves when the transaction completes.
     */
    async deleteInvoices(ids: string[]): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('invoices', 'readwrite');
        const store = tx.objectStore('invoices');
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    },

    /**
     * Atomically deletes an invoice and restores any jobs/teeth that referenced it.
     * Returns the list of jobs that were updated as part of the restore operation.
     * This operation is idempotent: if the invoice is already deleted or jobs
     * already restored, it will quietly succeed.
     */
    async deleteInvoiceAndRestore(id: string): Promise<Job[]> {
        const db = await initDB();
        const tx = db.transaction(['jobs', 'invoices'], 'readwrite');
        const jobStore = tx.objectStore('jobs');
        const invoiceStore = tx.objectStore('invoices');

        const updatedJobs: Job[] = [];

        // Scan jobs and restore any references to this invoice
        let cursor = await jobStore.openCursor();
        while (cursor) {
            const job = cursor.value;
            if (job.parentInvoiceId === id) {
                const updatedTeeth = job.teeth.map(t => (
                    t.parentInvoiceId === id ? { ...t, parentInvoiceId: undefined, status: 'Calculated' as const } : t
                ));
                job.teeth = updatedTeeth;
                job.parentInvoiceId = undefined;
                job.status = 'Calculated' as const;
                await cursor.update(job);
                updatedJobs.push(job);
            }
            cursor = await cursor.continue();
        }

        // Delete the invoice if it exists. If it's already gone, that's fine.
        const invoice = await invoiceStore.get(id);
        if (invoice) {
            await invoiceStore.delete(id);
        }

        await tx.done;
        return updatedJobs;
    },

    /**
     * Assigns multiple jobs to a specific invoice.
     * Updates jobs status to 'Invoiced' and sets parentInvoiceId.
     * Also recalculates and updates the Invoice totals.
     */
    async assignJobsToInvoice(invoiceId: string, jobIds: string[]): Promise<Invoice> {
        const db = await initDB();
        const tx = db.transaction(['jobs', 'invoices'], 'readwrite');
        const jobStore = tx.objectStore('jobs');
        const invoiceStore = tx.objectStore('invoices');

        // 1. Update the specific jobs being assigned
        for (const id of jobIds) {
            const job = await jobStore.get(id);
            if (job) {
                job.parentInvoiceId = invoiceId;
                job.status = 'Invoiced';
                job.teeth = job.teeth.map(t => ({
                    ...t,
                    status: 'Invoiced',
                    parentInvoiceId: invoiceId
                }));
                await jobStore.put(job);
            }
        }

        // 2. Recalculate Invoice Totals by scanning all jobs for this invoice
        // This ensures consistency even if previous states were desynced
        let totalAmount = 0;
        let jobCount = 0;
        
        let cursor = await jobStore.openCursor();
        while (cursor) {
            const job = cursor.value;
            // Check if job belongs to this invoice (including the ones we just added)
            if (job.parentInvoiceId === invoiceId) {
                totalAmount += (job.price || 0);
                jobCount++;
            }
            cursor = await cursor.continue();
        }

        // 3. Update the Invoice record
        const invoice = await invoiceStore.get(invoiceId);
        if (!invoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }
        
        invoice.totalAmount = totalAmount;
        invoice.jobCount = jobCount;
        
        await invoiceStore.put(invoice);
        await tx.done;

        return invoice;
    },

    /**
     * Reconciles jobs that reference invoices which are missing from the DB.
     * For any job that has a `parentInvoiceId` which does not exist in the
     * `invoices` store, the job and its teeth will have `parentInvoiceId` removed
     * and statuses moved from 'Invoiced' to 'Calculated' so they become editable.
     * Returns a list of job ids that were modified.
     */
    async reconcileOrphanedInvoicedJobs(): Promise<string[]> {
        const db = await initDB();
        const invoiceStore = db.transaction('invoices').objectStore('invoices');
        const invoices = await invoiceStore.getAll();
        const validInvoiceIds = new Set(invoices.map(inv => inv.id));

        const tx = db.transaction('jobs', 'readwrite');
        const jobStore = tx.objectStore('jobs');
        let cursor = await jobStore.openCursor();
        const updated: string[] = [];

        while (cursor) {
            const job = cursor.value;
            const pid = job.parentInvoiceId;
            if (pid && !validInvoiceIds.has(pid)) {
                let changed = false;
                // Remove job-level parentInvoiceId
                delete job.parentInvoiceId;
                // If job was Invoiced, move to Calculated so it's editable again
                if (job.status === 'Invoiced') {
                    job.status = 'Calculated';
                    changed = true;
                }

                // Fix teeth entries that reference the orphaned invoice
                if (Array.isArray(job.teeth)) {
                    job.teeth = job.teeth.map(t => {
                        if (t.parentInvoiceId === pid) {
                            const newT = { ...t };
                            delete newT.parentInvoiceId;
                            if (newT.status === 'Invoiced') {
                                newT.status = 'Calculated';
                            }
                            changed = true;
                            return newT;
                        }
                        return t;
                    });
                }

                if (changed) {
                    await cursor.update(job);
                    updated.push(job.id);
                }
            }
            cursor = await cursor.continue();
        }

        await tx.done;
        return updated;
    },

    /**
     * Metadata Service Operations
     */
    async getMetadata(key: MetadataKey): Promise<string[]> {
        const db = await initDB();
        const storedValues = await db.get('metadata', key);
        if (storedValues && storedValues.length > 0) {
            return storedValues;
        }

        // If metadata is empty, dynamically extract it from existing jobs
        const jobs = await db.getAll('jobs');
        const extracted = new Set<string>();

        if (key === 'materials') {
            jobs.forEach(job => {
                if (job.teeth) {
                    job.teeth.forEach(tooth => {
                        if (tooth.material && tooth.material !== 'Unknown') {
                            extracted.add(tooth.material);
                        }
                    });
                }
            });
        } else if (key === 'types') {
            jobs.forEach(job => {
                if (job.teeth) {
                    job.teeth.forEach(tooth => {
                        if (tooth.type && tooth.type !== 'Unknown') {
                            extracted.add(tooth.type);
                        }
                    });
                }
            });
        } else if (key === 'doctors') {
            jobs.forEach(job => {
                if (job.doctorName) {
                    extracted.add(job.doctorName);
                }
            });
        } else if (key === 'patients') {
            jobs.forEach(job => {
                if (job.patientName) {
                    extracted.add(job.patientName);
                }
            });
        }

        const sortedResult = Array.from(extracted).sort((left, right) => left.localeCompare(right));
        
        // Cache the extracted values back to the metadata store for future fast lookups
        if (sortedResult.length > 0) {
            await db.put('metadata', sortedResult, key);
        }

        return sortedResult;
    },

    /**
     * Asset operations
     */
    async addAsset(asset: { id: string; jobId: string; fileName: string; mimeType: string; size: number }, data: Blob): Promise<void> {
        const db = await initDB();
        await db.add('assets', { ...asset, createdAt: new Date().toISOString(), data });
    },

    /**
     * Retrieves a full asset record (including blob data) by its unique identifier.
     * @param id - The unique identifier of the asset.
     * @returns A promise that resolves to the asset record, or undefined if not found.
     */
    async getAsset(id: string): Promise<DentalDB['assets']['value'] | undefined> {
        const db = await initDB();
        return db.get('assets', id);
    },

    /**
     * Retrieves only the binary blob data of an asset by its unique identifier.
     * @param id - The unique identifier of the asset.
     * @returns A promise that resolves to the blob data, or undefined if not found.
     */
    async getAssetBlob(id: string): Promise<Blob | undefined> {
        const db = await initDB();
        const rec = await db.get('assets', id);
        return rec?.data;
    },

    /**
     * Retrieves all asset metadata (excluding blob data) associated with a specific job.
     * @param jobId - The unique identifier of the job.
     * @returns A promise that resolves to an array of asset metadata objects.
     */
    async getAssetsByJob(jobId: string): Promise<Omit<DentalDB['assets']['value'], 'data'>[]> {
        const db = await initDB();
        const all = await db.getAll('assets');
        return all.filter(a => a.jobId === jobId).map((a) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { data, ...meta } = a;
            return meta;
        });
    },

    /**
     * Deletes an asset record by its unique identifier.
     * @param id - The unique identifier of the asset to delete.
     * @returns A promise that resolves when the operation completes.
     */
    async deleteAsset(id: string): Promise<void> {
        const db = await initDB();
        await db.delete('assets', id);
    },

    /**
     * Adds new values to an existing metadata key, merging with existing stored values.
     * Duplicates are automatically removed and the result is sorted alphabetically.
     * @param key - The metadata key to update.
     * @param newValues - The array of new values to add.
     * @returns A promise that resolves when the operation completes.
     */
    async addMetadata(key: MetadataKey, newValues: string[]): Promise<void> {
        const db = await initDB();
        const existing = (await db.get('metadata', key)) || [];
        const combined = Array.from(new Set([...existing, ...newValues])).sort();
        await db.put('metadata', combined, key);
    },

    /**
     * Removes a specific value from a metadata key.
     * @param key - The metadata key to update.
     * @param valueToRemove - The value to remove from the metadata list.
     * @returns A promise that resolves when the operation completes.
     */
    async removeMetadata(key: MetadataKey, valueToRemove: string): Promise<void> {
        const db = await initDB();
        const existing = (await db.get('metadata', key)) || [];
        const updated = existing.filter(v => v !== valueToRemove);
        await db.put('metadata', updated, key);
    },
    
    /**
     * Retrieves all jobs from local storage.
     */
    async getAllJobs(): Promise<Job[]> {
        const db = await initDB();
        return db.getAll('jobs');
    },

    /**
     * Adds a new job to storage.
     */
    async addJob(job: Job): Promise<void> {
        const db = await initDB();
        await db.add('jobs', job);
    },

    /**
     * Adds multiple jobs to storage in a single transaction (upsert).
     */
    async addJobs(jobs: Job[]): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('jobs', 'readwrite');
        const store = tx.objectStore('jobs');
        await Promise.all(jobs.map(job => store.put(job)));
        await tx.done;
    },

    /**
     * Updates an existing job.
     */
    async updateJob(job: Job): Promise<void> {
        const db = await initDB();
        await db.put('jobs', job);
    },

    /**
     * Updates multiple jobs in a single transaction.
     */
    async updateJobs(jobs: Job[]): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('jobs', 'readwrite');
        const store = tx.objectStore('jobs');
        await Promise.all(jobs.map(job => store.put(job)));
        await tx.done;
    },

    /**
     * Deletes a job by ID.
     */
    async deleteJob(id: string): Promise<void> {
        const db = await initDB();
        await db.delete('jobs', id);
    },

    /**
     * Deletes multiple jobs by ID in a single transaction.
     */
    async deleteJobs(ids: string[]): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('jobs', 'readwrite');
        const store = tx.objectStore('jobs');
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    },

    /**
     * Tariff Rules Service Operations
     */
    async getAllRules(): Promise<TariffRule[]> {
        const db = await initDB();
        return db.getAll('tariffs');
    },

    /**
     * Adds a new tariff rule to the database.
     * @param rule - The tariff rule to persist.
     * @returns A promise that resolves when the operation completes.
     */
    async addRule(rule: TariffRule): Promise<void> {
        const db = await initDB();
        await db.add('tariffs', rule);
    },

    /**
     * Updates an existing tariff rule in the database.
     * @param rule - The tariff rule with updated fields to persist.
     * @returns A promise that resolves when the operation completes.
     */
    async updateRule(rule: TariffRule): Promise<void> {
        const db = await initDB();
        await db.put('tariffs', rule);
    },

    /**
     * Updates multiple tariff rules in a single transaction.
     */
    async updateRules(rules: TariffRule[]): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('tariffs', 'readwrite');
        const store = tx.objectStore('tariffs');
        await Promise.all(rules.map(rule => store.put(rule)));
        await tx.done;
    },

    /**
     * Deletes a single tariff rule by its unique identifier.
     * @param id - The ID of the tariff rule to delete.
     * @returns A promise that resolves when the operation completes.
     */
    async deleteRule(id: string): Promise<void> {
        const db = await initDB();
        await db.delete('tariffs', id);
    },

    /**
     * Deletes multiple tariff rules by ID in a single transaction.
     */
    async deleteRules(ids: string[]): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('tariffs', 'readwrite');
        const store = tx.objectStore('tariffs');
        await Promise.all(ids.map(id => store.delete(id)));
        await tx.done;
    },

    /**
     * Resets all jobs to 'Pending' status and 0 price.
     * Used when tariff rules change to invalidate previous calculations.
     */
    async resetAllJobs(): Promise<void> {
        const db = await initDB();
        const tx = db.transaction('jobs', 'readwrite');
        const store = tx.objectStore('jobs');
        
        let cursor = await store.openCursor();
        while (cursor) {
            const job = cursor.value;
            if (job.status !== 'Pending' || job.price !== 0) {
                job.status = 'Pending';
                job.price = 0;
                cursor.update(job);
            }
            cursor = await cursor.continue();
        }
        await tx.done;
    },
};
