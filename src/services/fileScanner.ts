/** @file Service for scanning directories and parsing .dentalproject XML files into Job objects. */
import type { Job } from '../types';
import { generateJobHash } from '../utils/hash';
import { dbService } from './db';

/** Represents a file or directory handle from the File System Access API. */
interface FileSystemHandle {
    kind: 'file' | 'directory';
    name: string;
}

/** Represents a file handle from the File System Access API, providing access to a file's contents. */
interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file';
    getFile(): Promise<File>;
}

/**
 * Helper to safely extract text content from an XML element.
 *
 * @param element - The parent XML element to search within.
 * @param tagName - The name of the child tag whose text content to retrieve.
 * @returns The trimmed text content of the first matching child element, or an empty string if not found.
 */
const getTagText = (element: Element, tagName: string): string => {
    const found = element.getElementsByTagName(tagName)[0];
    return found?.textContent?.trim() || '';
};

/**
 * Parses a single .dentalproject XML string into a Job object.
 *
 * @param xmlContent - The raw XML string content of a .dentalproject file.
 * @param fileName - The name of the file being parsed, used for error reporting.
 * @returns A parsed Job object if successful, or null if parsing fails or the XML is invalid.
 */
export const parseDentalProject = (xmlContent: string, fileName: string): Job | null => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlContent, "text/xml");

        // Check for parsing errors
        const parseError = doc.getElementsByTagName("parsererror");
        if (parseError.length > 0) {
            console.error(`XML Parse Error in ${fileName}:`, parseError[0].textContent);
            return null;
        }

        // --- Extract Basic Info ---
        const practiceName = getTagText(doc.documentElement, 'PracticeName') || "Unknown Doctor";
        const patientLast = getTagText(doc.documentElement, 'PatientName');
        const patientFirst = getTagText(doc.documentElement, 'PatientFirstName');
        const patientName = `${patientLast} ${patientFirst}`.trim() || "Unknown Patient";
        const projectId = getTagText(doc.documentElement, 'ProjectUniqueId') || getTagText(doc.documentElement, 'ProjectGUID') || getTagText(doc.documentElement, 'ProjectId') || getTagText(doc.documentElement, 'ProjectID') || "";

        // --- Extract Date ---
        // Try DateTime tag first, then fallback to current time (real logic would use filename regex like legacy)
        let dateStr = getTagText(doc.documentElement, 'DateTime');
        if (dateStr) {
            // Clean up ISO string if needed (e.g. 2023-10-27T10:00:00.123+02:00 -> 2023-10-27T10:00:00)
            dateStr = dateStr.split('.')[0].replace('Z', '');
        } else {
            dateStr = new Date().toISOString();
        }

        // --- Extract Teeth/Units Info ---
        const teethElements = Array.from(doc.getElementsByTagName('Tooth'));
        const unitCount = teethElements.length;
        
        const teeth = teethElements.map((tooth, index) => {
            // Try to get tooth number from attribute or tag
            const number = parseInt(tooth.getAttribute('Number') || getTagText(tooth, 'Number') || '0');
            // If 0, maybe use index + 1 or some other logic, but 0 is fine for fallback
            
            const material = getTagText(tooth, 'MaterialName') || 'Unknown';
            const type = getTagText(tooth, 'ReconstructionType') || 'Unknown';
            const implantType = getTagText(tooth, 'ImplantType') || undefined;
            const isScrewRetained = implantType === 'WithoutAbutment' || implantType === 'WithoutAbutmentManual';
            const id = `${Date.now()}-${index}-${crypto.randomUUID().slice(0, 5)}`;
            
            return { id, number, material, type, implantType, isScrewRetained };
        });

        let notesText = '';

        // --- Extract Notes ---
        const noteElements = doc.getElementsByTagName('Notes');
        for (let i = 0; i < noteElements.length; i++) {
            const txt = noteElements[i].textContent?.trim();
            if (txt) notesText += txt + '; ';
        }

        const job: Job = {
            id: crypto.randomUUID(), // Temporary ID, will be replaced or used
            patientName,
            doctorName: practiceName,
            fileName,
            createdAt: dateStr,
            teeth,
            unitCount,
            status: 'Pending',
            price: 0,
            notes: notesText,
            projectId
        };

        job.originalHash = generateJobHash(job);
        
        return job;

    } catch (e) {
        console.error(`Exception parsing ${fileName}:`, e);
        return null;
    }
};

/**
 * Threshold (in bytes) above which the user is asked to choose between
 * storing the full 3D model bytes in IndexedDB or just a pointer to the
 * original file on disk. Equal to 1 GiB.
 */
export const THREE_D_IMPORT_SIZE_LIMIT_BYTES = 1073741824;

/**
 * Strategy chosen by {@link prompt3DImportStrategy} for the current import.
 *
 * - `'full'`    - write the model bytes into the IndexedDB `assets` store.
 * - `'pointer'` - only store metadata (file name, size, pointer flag);
 *                 the model bytes stay on disk and must be re-linked by
 *                 the user before the 3D viewer can render them.
 */
export type ThreeDImportMode = 'full' | 'pointer';

/**
 * Result of {@link prompt3DImportStrategy}. Reports the chosen mode,
 * the total bytes that triggered the decision, and whether the user
 * was actually prompted (false when the total is below the gate).
 */
export interface ThreeDImportStrategy {
    mode: ThreeDImportMode;
    totalBytes: number;
    prompted: boolean;
}

/**
 * A 3D model file discovered during an import scan. The `file` field is
 * kept around so the same `FileSystemFileHandle` / `File` can later be
 * materialised (full mode) or skipped (pointer mode) without having to
 * look it up again by name.
 */
export interface ModelCandidate {
    file: File | FileSystemFileHandle;
    fileName: string;
    sizeBytes: number;
    projectPrefix: string;
    suffix: string;
}

/**
 * Resolves a `FileSystemFileHandle` (modern API) or a `File` (legacy
 * `<input webkitdirectory>`) to the underlying `File`, so the caller
 * can read its `size` / `name` / bytes.
 *
 * @param file - The file or file handle to resolve.
 * @returns A `File` instance for the same underlying file.
 */
const resolveFile = async (file: File | FileSystemFileHandle): Promise<File> => {
    return 'getFile' in file
        ? await (file as unknown as FileSystemFileHandle).getFile()
        : (file as File);
};

/**
 * Scans the supplied folder for 3D model files that match any of the
 * provided project prefixes. Only `.stl` files are recognised today
 * (matches the existing import behaviour). Each candidate carries the
 * file, its name, the project prefix it matched, the model suffix
 * (e.g. `lower` for `<prefix>-lower.stl`), and the size in bytes.
 *
 * This is a pure, side-effect-free function intended to run BEFORE any
 * IDB writes so the caller can compute a total size, decide a strategy,
 * and only then start persisting assets.
 *
 * @param files - All file handles in the scanned folder.
 * @param projectPrefixes - Lowercased prefixes (one per `.dentalProject`
 *                          file) used to filter the 3D model candidates.
 * @returns The matching 3D model candidates, one per matching file.
 */
export const discover3DModels = async (
    files: (File | FileSystemFileHandle)[],
    projectPrefixes: string[]
): Promise<ModelCandidate[]> => {
    const candidates: ModelCandidate[] = [];
    for (const file of files) {
        const lowerName = file.name.toLowerCase();
        if (!lowerName.endsWith('.stl')) continue;
        const matchingPrefix = projectPrefixes.find(
            (prefix) => lowerName.startsWith(`${prefix}-`)
        );
        if (!matchingPrefix) continue;

        try {
            const resolved = await resolveFile(file);
            // The project prefix + "-" + suffix must be exactly the stem
            // between the prefix and the `.stl` extension.
            const expectedPrefixLen = matchingPrefix.length + 1;
            const suffix = file.name.slice(expectedPrefixLen, -4);
            candidates.push({
                file,
                fileName: file.name,
                sizeBytes: resolved.size,
                projectPrefix: matchingPrefix,
                suffix,
            });
        } catch (err) {
            console.error(`Failed to read 3D model ${file.name}:`, err);
        }
    }
    return candidates;
};

/**
 * Decides whether the import should store 3D model bytes (`full`) or
 * only pointers (`pointer`).
 *
 * - When `totalBytes` is below {@link THREE_D_IMPORT_SIZE_LIMIT_BYTES}
 *   the function returns `{ mode: 'full', prompted: false }` without
 *   calling the prompt. This is the "happy path" and the default for
 *   the vast majority of imports.
 * - When the total is at or above the limit, the optional `promptFn` is
 *   invoked. The caller is expected to show a UI (MUI Dialog or
 *   `window.confirm`) and resolve with the user's choice. If no
 *   `promptFn` is provided (e.g. in headless tests, or when the user
 *   cannot be reached), the function defaults to `'pointer'` — the
 *   safer, smaller choice, in line with the project requirement that
 *   full 3D data only lands in IDB when the user explicitly opts in.
 *
 * @param totalBytes - Sum of all 3D model file sizes for this import.
 * @param promptFn   - Optional async prompt used to ask the user for a
 *                     strategy when `totalBytes` is at or above the gate.
 * @returns The chosen strategy, the total it was based on, and whether
 *          the user was actually prompted.
 */
export const prompt3DImportStrategy = async (
    totalBytes: number,
    promptFn?: (totalBytes: number) => Promise<ThreeDImportMode>
): Promise<ThreeDImportStrategy> => {
    if (totalBytes < THREE_D_IMPORT_SIZE_LIMIT_BYTES) {
        return { mode: 'full', totalBytes, prompted: false };
    }
    if (!promptFn) {
        return { mode: 'pointer', totalBytes, prompted: false };
    }
    const choice = await promptFn(totalBytes);
    const safeChoice: ThreeDImportMode = choice === 'full' ? 'full' : 'pointer';
    return { mode: safeChoice, totalBytes, prompted: true };
};

/**
 * Parses a list of file-like objects into jobs and metadata.
 * This is a generic helper that works with both the modern API's FileSystemFileHandle
 * and the legacy input's File object.
 *
 * @param job           - The job whose teeth list will receive the 3D model entries.
 * @param projectPrefix - Lowercased filename prefix used to locate matching STLs.
 * @param files         - An array of File or FileSystemFileHandle objects to process.
 * @param mode          - 3D import strategy; see {@link ThreeDImportMode}.
 * @returns A promise that resolves once every matching 3D model has been
 *          turned into a tooth entry and (in `full` mode) persisted as
 *          an asset. In `pointer` mode, the asset row is created with
 *          `isPointer: true` and no `data` blob.
 */
async function processMatchingStlFiles(
    job: Job,
    projectPrefix: string,
    files: (File | FileSystemFileHandle)[],
    mode: ThreeDImportMode
): Promise<void> {
    const matchingStlFiles = files.filter(f => {
        const fname = f.name.toLowerCase();
        return fname.startsWith(projectPrefix + '-') && fname.endsWith('.stl');
    });

    for (let idx = 0; idx < matchingStlFiles.length; idx++) {
        const stlFile = matchingStlFiles[idx];
        const originalName = stlFile.name;
        const suffix = originalName.slice(projectPrefix.length + 1, -4); // Remove prefix plus the "-" and ".stl"
        
        const exists = job.teeth.some(t => t.number === 0 && t.type === '3D Model' && t.material === suffix);
        if (!exists) {
                job.teeth.push({
                    id: `${Date.now()}-stl-${idx}-${crypto.randomUUID().slice(0, 5)}`,
                    number: 0,
                    type: '3D Model',
                    material: suffix,
                    status: 'Calculated' as const,
                    price: 0
                });
        }

        // Save to IndexedDB assets store!
        try {
            const fileObj = await resolveFile(stlFile);
            const assetId = `${job.id}-${suffix}`;
            const existingAssets = await dbService.getAssetsByJob(job.id);
            if (!existingAssets.some(a => a.fileName === originalName)) {
                const metadata = {
                    id: assetId,
                    jobId: job.id,
                    fileName: originalName,
                    mimeType: 'model/stl',
                    size: fileObj.size
                };
                if (mode === 'full') {
                    await dbService.addAsset(metadata, fileObj);
                    console.log(`Saved asset ${originalName} to IndexedDB for job ${job.id}`);
                } else {
                    await dbService.addPointerAsset(metadata);
                    console.log(`Saved pointer ${originalName} to IndexedDB for job ${job.id}`);
                }
            }
        } catch (err) {
            console.error(`Failed to save asset ${originalName} to IndexedDB:`, err);
        }
    }
}

/**
 * Adds non-Unknown material/type values from a job's teeth into the running
 * metadata sets used to populate dropdowns after a folder scan.
 *
 * @param job - The job whose teeth should be inspected.
 * @param materials - The set to collect discovered materials into.
 * @param types - The set to collect discovered types into.
 */
const collectToothMetadata = (
    job: Job,
    materials: Set<string>,
    types: Set<string>
): void => {
    if (!job.teeth) return;
    job.teeth.forEach(t => {
        if (t.material && t.material !== 'Unknown') materials.add(t.material);
        if (t.type && t.type !== 'Unknown') types.add(t.type);
    });
};

/**
 * Re-imports matching STL files into an already-known job.
 *
 * Returns a deep-cloned, updated job if any new teeth were appended by the
 * STL reprocessing pass, or `null` if the job was unchanged. Callers use the
 * null result to decide whether to record the job as updated and to collect
 * metadata from its teeth.
 *
 * @param existingJob - The job previously loaded for this project file.
 * @param projectPrefix - Lowercased filename prefix used to locate matching STLs.
 * @param files - All file handles in the scanned folder.
 * @param mode - 3D import strategy; see {@link ThreeDImportMode}.
 * @returns The updated job, or `null` if no new teeth were added.
 */
const mergeExistingJobStlFiles = async (
    existingJob: Job,
    projectPrefix: string,
    files: (File | FileSystemFileHandle)[],
    mode: ThreeDImportMode
): Promise<Job | null> => {
    const updatedJob = JSON.parse(JSON.stringify(existingJob)) as Job;
    const originalTeethCount = updatedJob.teeth.length;
    await processMatchingStlFiles(updatedJob, projectPrefix, files, mode);
    if (updatedJob.teeth.length > originalTeethCount) {
        updatedJob.unitCount = updatedJob.teeth.length;
        return updatedJob;
    }
    return null;
};

/**
 * Result sink for per-file processing. Passed into {@link processProjectFile}
 * so the per-file handler can append to the shared arrays/sets without
 * widening the parameter list as new accumulators are added.
 */
interface ProcessSink {
    newJobs: Job[];
    updatedJobs: Job[];
    materials: Set<string>;
    types: Set<string>;
}

/**
 * Caches the given file handles on `window.localFileHandles` so that model
 * assets can be lazily loaded later (e.g. when the 3D viewer mounts).
 *
 * @param files - The file handles to cache.
 */
const cacheFileHandles = (files: (File | FileSystemFileHandle)[]): void => {
    if (!window.localFileHandles) {
        window.localFileHandles = {};
    }
    for (const fh of files) {
        window.localFileHandles[fh.name] = fh;
    }
};

/**
 * Builds a lowercased-filename → Job lookup map for O(1) duplicate detection
 * during a folder scan.
 *
 * @param existingJobs - Jobs already loaded from IndexedDB.
 * @returns A map keyed by the lowercased `fileName` of each job.
 */
const indexJobsByName = (existingJobs: Job[]): Map<string, Job> => {
    const map = new Map<string, Job>();
    for (const j of existingJobs) {
        const fname = (j.fileName ?? '').toLowerCase();
        if (fname) map.set(fname, j);
    }
    return map;
};

/**
 * Reads the project file referenced by `fileHandle` and either re-imports its
 * STL files into the matching existing job, or parses it as a brand-new
 * project. Results are appended to `sink`.
 *
 * @param fileHandle - Handle for a `.dentalproject` file in the scanned folder.
 * @param projectPrefix - Lowercased filename prefix used to locate matching STLs.
 * @param files - All file handles in the scanned folder (used for STL matching).
 * @param existingJobsByName - Lookup map of already-known jobs keyed by filename.
 * @param mode - 3D import strategy; see {@link ThreeDImportMode}.
 * @param sink - Shared result accumulators updated by this call.
 */
const processProjectFile = async (
    fileHandle: File | FileSystemFileHandle,
    projectPrefix: string,
    files: (File | FileSystemFileHandle)[],
    existingJobsByName: Map<string, Job>,
    mode: ThreeDImportMode,
    sink: ProcessSink
): Promise<void> => {
    const existingJob = existingJobsByName.get(fileHandle.name.toLowerCase());
    if (existingJob) {
        const updatedJob = await mergeExistingJobStlFiles(existingJob, projectPrefix, files, mode);
        if (updatedJob) {
            sink.updatedJobs.push(updatedJob);
            collectToothMetadata(updatedJob, sink.materials, sink.types);
        }
        return;
    }

    const fileParseStartTime = performance.now();

    // The File object from legacy input and the handle from the modern API both have a `getFile` method,
    // but the legacy one *is* the file, so it has no method.
    const file = 'getFile' in fileHandle
        ? await (fileHandle as unknown as FileSystemFileHandle).getFile()
        : fileHandle as File;
    const text = await file.text();

    const job = parseDentalProject(text, file.name);
    if (job) {
        // Find STL files starting with this project's prefix in the same folder
        await processMatchingStlFiles(job, projectPrefix, files, mode);

        job.unitCount = job.teeth.length;

        sink.newJobs.push(job);
        collectToothMetadata(job, sink.materials, sink.types);
    }

    const fileParseEndTime = performance.now();
    console.log(` -> Parsed ${fileHandle.name} in ${(fileParseEndTime - fileParseStartTime).toFixed(2)}ms`);
};

/**
 * Result of parsing a folder of dental project files. Extends the basic
 * `(jobs, updatedJobs, materials, types)` tuple with the 3D import
 * strategy that was actually applied and the total size that drove it.
 */
export interface ProcessFilesResult {
    jobs: Job[];
    updatedJobs: Job[];
    materials: string[];
    types: string[];
    importMode: ThreeDImportMode;
    total3DBytes: number;
    importPrompted: boolean;
}

/**
 * Parses a list of file-like objects into jobs and metadata.
 * This is a generic helper that works with both the modern API's FileSystemFileHandle
 * and the legacy input's File object.
 *
 * The function is the entry point for the 3D import size gate:
 *
 * 1. It collects every `.dentalProject` file to derive a list of project
 *    prefixes.
 * 2. It runs {@link discover3DModels} to enumerate all matching `.stl`
 *    files and their sizes — *before* anything is written to IndexedDB.
 * 3. It calls {@link prompt3DImportStrategy} with the total size. Below
 *    the gate the strategy is `'full'` and the user is not prompted.
 *    Above the gate the supplied `promptFn` is invoked.
 * 4. The chosen mode is then threaded into the per-project pass so each
 *    3D model is materialised as either a full asset (blob in IDB) or
 *    a pointer (metadata only).
 *
 * @param files - An array of File or FileSystemFileHandle objects to process.
 * @param existingJobs - Jobs already loaded, used to detect re-imports.
 * @param promptFn - Optional UI prompt used by the 3D import gate when
 *                   the total size is at or above
 *                   {@link THREE_D_IMPORT_SIZE_LIMIT_BYTES}. See
 *                   {@link prompt3DImportStrategy}.
 * @returns The parsed jobs, discovered metadata, the import mode that
 *          was applied, and the total 3D size that drove the decision.
 */
const processFiles = async (
    files: (File | FileSystemFileHandle)[],
    existingJobs: Job[],
    promptFn?: (totalBytes: number) => Promise<ThreeDImportMode>
): Promise<ProcessFilesResult> => {
    const startTime = performance.now();
    const newJobs: Job[] = [];
    const updatedJobs: Job[] = [];
    const discoveredMaterials = new Set<string>();
    const discoveredTypes = new Set<string>();

    console.log(`Processing ${files.length} file handles...`);

    cacheFileHandles(files);
    const existingJobsByName = indexJobsByName(existingJobs);
    const sink: ProcessSink = {
        newJobs,
        updatedJobs,
        materials: discoveredMaterials,
        types: discoveredTypes,
    };

    // Phase 1: identify project prefixes from the .dentalProject files.
    const projectPrefixes: string[] = [];
    for (const fileHandle of files) {
        if (fileHandle.name.toLowerCase().endsWith('.dentalproject')) {
            projectPrefixes.push(fileHandle.name.toLowerCase().replace('.dentalproject', ''));
        }
    }

    // Phase 2: discover all 3D models and decide a strategy BEFORE we
    // touch IndexedDB. This keeps the "do I really want this much data
    // in my browser?" question at the front of the flow.
    const candidates = await discover3DModels(files, projectPrefixes);
    const total3DBytes = candidates.reduce((sum, c) => sum + c.sizeBytes, 0);
    const strategy = await prompt3DImportStrategy(total3DBytes, promptFn);
    console.log(
        `3D import strategy: mode=${strategy.mode} ` +
        `totalBytes=${strategy.totalBytes} prompted=${strategy.prompted}`
    );

    // Phase 3: parse each project and materialise its 3D models using
    // the chosen mode.
    for (const fileHandle of files) {
        // We only care about .dentalProject files, but legacy input doesn't let us filter by extension easily.
        if (!fileHandle.name.toLowerCase().endsWith('.dentalproject')) {
            continue;
        }
        const projectPrefix = fileHandle.name.toLowerCase().replace('.dentalproject', '');
        await processProjectFile(fileHandle, projectPrefix, files, existingJobsByName, strategy.mode, sink);
    }

    const endTime = performance.now();
    console.log(`Finished processing all files in ${(endTime - startTime).toFixed(2)}ms`);

    return {
        jobs: newJobs,
        updatedJobs,
        materials: Array.from(discoveredMaterials),
        types: Array.from(discoveredTypes),
        importMode: strategy.mode,
        total3DBytes: strategy.totalBytes,
        importPrompted: strategy.prompted,
    };
};

/**
 * Creates a fallback file input for directory selection.
 *
 * @returns A promise that resolves with the selected FileList, or rejects if the user cancels.
 */
const legacyDirectoryPicker = (): Promise<FileList> => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        // These attributes enable folder selection in most browsers
        input.setAttribute('webkitdirectory', '');
        input.multiple = true;  

        input.onchange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            const files = target.files;
            if (files && files.length > 0) {
                resolve(files);
            } else {
                // User cancelled
                reject(new Error('User cancelled folder selection'));
            }
            document.body.removeChild(input);
        };
        
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
    });
};

/**
 * Prompts the user to select a directory, scans for .dentalProject files,
 * parses them, and returns a list of unique Jobs along with discovered metadata.
 * Uses a fallback for browsers without the File System Access API.
 *
 * The 3D import size gate is part of this flow: the function asks the
 * caller (via `prompt3DImportFn`) what to do when the total size of all
 * 3D model files is at or above {@link THREE_D_IMPORT_SIZE_LIMIT_BYTES}.
 * The prompt is only ever triggered when the gate is hit; below the gate
 * the function imports the full data automatically.
 *
 * @param existingJobs - Jobs already loaded, used to skip duplicate files.
 * @param prompt3DImportFn - Optional UI prompt for the 3D size gate. See
 *                           {@link prompt3DImportStrategy}. When omitted
 *                           the default behaviour is "import full below
 *                           1 GiB, pointers at or above 1 GiB".
 * @returns A promise resolving to the parsed jobs, discovered materials,
 *          discovered types, and the import strategy that was applied
 *          (including the total 3D bytes that triggered it).
 */
export const scanAndParseFolder = async (
    existingJobs: Job[],
    prompt3DImportFn?: (totalBytes: number) => Promise<ThreeDImportMode>
): Promise<ProcessFilesResult> => {
    const totalTimeStart = performance.now();
    console.log("Starting folder scan...");
    try {
        // Modern API path
        // @ts-expect-error - showDirectoryPicker is not yet fully typed in all TS envs
        if (typeof window.showDirectoryPicker === 'function') {
            // @ts-expect-error - TS doesn't know about showDirectoryPicker yet
            const dirHandle = await window.showDirectoryPicker();
            const fileHandles: FileSystemFileHandle[] = [];

            // Recursive walker to get all files
            async function scanDirectory(handle: FileSystemHandle) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for await (const entry of (handle as any).values()) {
                    if (entry.kind === 'file') {
                        fileHandles.push(entry);
                    } else if (entry.kind === 'directory') {
                        await scanDirectory(entry);
                    }
                }
            }
            await scanDirectory(dirHandle);
            const result = await processFiles(fileHandles, existingJobs, prompt3DImportFn);
            const totalTimeEnd = performance.now();
            console.log(`Total scan and parse time: ${(totalTimeEnd - totalTimeStart).toFixed(2)}ms`);
            return result;
        }
        // Legacy Fallback path
        else {
            const fileList = await legacyDirectoryPicker();
            const filesArray = Array.from(fileList);
            const result = await processFiles(filesArray, existingJobs, prompt3DImportFn);
            const totalTimeEnd = performance.now();
            console.log(`Total scan and parse time: ${(totalTimeEnd - totalTimeStart).toFixed(2)}ms`);
            return result;
        }
    } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((error as any).name === 'AbortError' || (error as any).message.includes('User cancelled')) {
            console.log("User cancelled folder selection");
            return {
                jobs: [],
                updatedJobs: [],
                materials: [],
                types: [],
                importMode: 'pointer',
                total3DBytes: 0,
                importPrompted: false,
            };
        }
        console.error("Error scanning folder:", error);
        throw error;
    }
};
