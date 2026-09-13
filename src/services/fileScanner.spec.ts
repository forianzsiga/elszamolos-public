/**
 * @file Tests for the 3D import size gate and the discover/materialize
 *       helpers added to the file scanner. The size gate is the
 *       behavioural contract that callers depend on:
 *
 *       - Below 1 GiB the user is never asked, and the gate returns
 *         `'full'`.
 *       - At or above 1 GiB the supplied prompt function is invoked,
 *         and the default (no prompt function or user dismiss) is
 *         `'pointer'` — the safer, smaller choice.
 *
 *       The materialize step is also exercised end-to-end against
 *       jsdom's IndexedDB so the `'full'` and `'pointer'` branches
 *       are both validated against the real DB schema (Blob in IDB
 *       vs. metadata-only pointer record).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    discover3DModels,
    prompt3DImportStrategy,
    THREE_D_IMPORT_SIZE_LIMIT_BYTES,
    type ThreeDImportMode,
} from './fileScanner';
import { dbService, initDB } from './db';

const describeIfIndexedDB = typeof indexedDB === 'undefined' ? describe.skip : describe;

const DB_NAME = 'DentalRaktarDB';

async function clearDatabase() {
    await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
    });
}

const FIVE_HUNDRED_MB = 500 * 1024 * 1024;
const TWO_GB = 2 * 1024 * 1024 * 1024;

/**
 * Builds a real `File` with the given name and size, so the file
 * scanner can call `file.size` / `file.arrayBuffer()` exactly like
 * it would in the browser.
 */
function makeStlFile(name: string, sizeBytes: number): File {
    const buffer = new Uint8Array(sizeBytes);
    return new File([buffer], name, { type: 'model/stl' });
}

describe('prompt3DImportStrategy', () => {
    it('returns full mode immediately when total is well under the gate (500 MB)', async () => {
        let promptCalled = false;
        const strategy = await prompt3DImportStrategy(FIVE_HUNDRED_MB, async () => {
            promptCalled = true;
            return 'full';
        });
        expect(strategy.mode).toBe('full');
        expect(strategy.totalBytes).toBe(FIVE_HUNDRED_MB);
        expect(strategy.prompted).toBe(false);
        expect(promptCalled).toBe(false);
    });

    it('returns full mode automatically at exactly the limit minus one byte', async () => {
        const justBelow = THREE_D_IMPORT_SIZE_LIMIT_BYTES - 1;
        const strategy = await prompt3DImportStrategy(justBelow, async () => 'pointer');
        expect(strategy.mode).toBe('full');
        expect(strategy.prompted).toBe(false);
    });

    it('triggers the prompt at the 1 GiB threshold and resolves with full when the user picks it', async () => {
        let promptCalledWith = -1;
        const strategy = await prompt3DImportStrategy(
            THREE_D_IMPORT_SIZE_LIMIT_BYTES,
            async (totalBytes) => {
                promptCalledWith = totalBytes;
                return 'full';
            }
        );
        expect(strategy.prompted).toBe(true);
        expect(strategy.mode).toBe('full');
        expect(promptCalledWith).toBe(THREE_D_IMPORT_SIZE_LIMIT_BYTES);
    });

    it('defaults to pointer at 2 GB when no prompt function is supplied', async () => {
        const strategy = await prompt3DImportStrategy(TWO_GB);
        expect(strategy.mode).toBe('pointer');
        expect(strategy.totalBytes).toBe(TWO_GB);
        expect(strategy.prompted).toBe(false);
    });

    it('asks the user at 2 GB and defaults to pointer when they cancel/dismiss', async () => {
        let promptCalled = false;
        const strategy = await prompt3DImportStrategy(TWO_GB, async () => {
            promptCalled = true;
            // The brief specifies that pointer is the safer default when
            // the user backs out of the dialog. We simulate that here by
            // returning an unexpected value and asserting the gate
            // normalises it to 'pointer'.
            return 'dismissed' as unknown as ThreeDImportMode;
        });
        expect(promptCalled).toBe(true);
        expect(strategy.prompted).toBe(true);
        expect(strategy.mode).toBe('pointer');
    });
});

describe('discover3DModels', () => {
    it('returns matching STL candidates with correct sizes for known project prefixes', async () => {
        const projectA = 'scan_001';
        const projectB = 'scan_002';
        const files = [
            makeStlFile(`${projectA}-upper.stl`, 100),
            makeStlFile(`${projectA}-lower.stl`, 200),
            makeStlFile(`${projectB}-upper.stl`, 300),
            // Non-matching: wrong extension, no matching prefix
            makeStlFile(`${projectA}-notes.txt`, 50),
            makeStlFile(`unrelated-file.stl`, 400),
        ];
        const candidates = await discover3DModels(files, [projectA, projectB]);
        expect(candidates).toHaveLength(3);
        const sizes = candidates.map(c => c.sizeBytes).sort((a, b) => a - b);
        expect(sizes).toEqual([100, 200, 300]);
        // Every candidate must have a project prefix and a non-empty suffix
        for (const c of candidates) {
            expect([projectA, projectB]).toContain(c.projectPrefix);
            expect(c.suffix.length).toBeGreaterThan(0);
            expect(c.fileName).toMatch(/\.stl$/i);
        }
    });

    it('returns an empty list when no STL files match the known prefixes', async () => {
        const files = [
            makeStlFile('scan_001-upper.stl', 100),
            makeStlFile('some_other-lower.stl', 200),
        ];
        const candidates = await discover3DModels(files, ['unknown_project']);
        expect(candidates).toEqual([]);
    });
});

describeIfIndexedDB('3D import materialisation (full vs pointer)', () => {
    const JOB_ID = 'job-3d-gate';
    const SUFFIX = 'lower';

    beforeEach(async () => {
        await clearDatabase();
        await initDB();
        // Clean up any leftover asset from a prior failed run.
        await dbService.deleteAsset(`${JOB_ID}-${SUFFIX}`).catch(() => {});
    });

    it('full mode persists the asset bytes into IndexedDB', async () => {
        const blobContent = 'FULL-MODE-BYTES';
        const file = new File([blobContent], 'scan_full-lower.stl', { type: 'model/stl' });
        const { addAsset, getAsset, getAssetBlob } = dbService;
        const { mode } = await prompt3DImportStrategy(file.size);
        expect(mode).toBe('full');
        await addAsset(
            { id: `${JOB_ID}-${SUFFIX}`, jobId: JOB_ID, fileName: file.name, mimeType: 'model/stl', size: file.size },
            file
        );
        const stored = await getAsset(`${JOB_ID}-${SUFFIX}`);
        expect(stored).toBeDefined();
        expect(stored?.isPointer).toBeFalsy();
        const blob = await getAssetBlob(`${JOB_ID}-${SUFFIX}`);
        expect(blob).toBeDefined();
        const text = await blob!.text();
        expect(text).toBe(blobContent);
    });

    it('pointer mode stores metadata only — no model bytes in IndexedDB', async () => {
        const largeName = 'scan_pointer-lower.stl';
        const largeSize = TWO_GB;
        // We don't actually allocate 2 GiB in the test — the pointer path
        // never touches the bytes. We just record the on-disk size in
        // the metadata, which is the whole point of the pointer mode.
        const { addPointerAsset, getAsset, getAssetBlob } = dbService;
        const strategy = await prompt3DImportStrategy(largeSize);
        expect(strategy.mode).toBe('pointer');
        await addPointerAsset({
            id: `${JOB_ID}-${SUFFIX}`,
            jobId: JOB_ID,
            fileName: largeName,
            mimeType: 'model/stl',
            size: largeSize,
        });
        const stored = await getAsset(`${JOB_ID}-${SUFFIX}`);
        expect(stored).toBeDefined();
        expect(stored?.isPointer).toBe(true);
        expect(stored?.fileName).toBe(largeName);
        expect(stored?.size).toBe(largeSize);
        // The key invariant: no model bytes survive in IndexedDB.
        const blob = await getAssetBlob(`${JOB_ID}-${SUFFIX}`);
        expect(blob).toBeUndefined();
    });
});
