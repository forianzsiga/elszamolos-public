import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dbService } from './db';

const describeIfIndexedDB = typeof indexedDB === 'undefined' ? describe.skip : describe;

describeIfIndexedDB('dbService asset operations', () => {
    const JOB_ID = 'test-job-asset';
    let assetId = '';

    beforeEach(async () => {
        // noop - DB initialized lazily
    });

    afterEach(async () => {
        if (assetId) await dbService.deleteAsset(assetId).catch(() => {});
    });

    it('adds, reads and deletes an asset', async () => {
        const blob = new Blob(['hello world'], { type: 'text/plain' });
        const id = `${JOB_ID}-1`;
        assetId = id;

        await dbService.addAsset({ id, jobId: JOB_ID, fileName: 'greeting.txt', mimeType: 'text/plain', size: 11 }, blob);

        const meta = await dbService.getAsset(id);
        expect(meta).toBeDefined();
        expect(meta?.fileName).toBe('greeting.txt');

        const fetched = await dbService.getAssetBlob(id);
        expect(fetched).toBeDefined();
        const text = await fetched!.text();
        expect(text).toBe('hello world');

        const byJob = await dbService.getAssetsByJob(JOB_ID);
        expect(byJob.find(a => a.id === id)).toBeDefined();

        await dbService.deleteAsset(id);
        const gone = await dbService.getAsset(id);
        expect(gone).toBeUndefined();
        assetId = '';
    });
});
