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
 * Parses a list of file-like objects into jobs and metadata.
 * This is a generic helper that works with both the modern API's FileSystemFileHandle
 * and the legacy input's File object.
 *
 * @param files - An array of File or FileSystemFileHandle objects to process.
 * @param existingFileNames - A set of filenames already loaded, used to avoid duplicates.
 * @returns An object containing the parsed jobs array, discovered materials, and discovered types.
 */
async function processMatchingStlFiles(
    job: Job,
    projectPrefix: string,
    files: (File | FileSystemFileHandle)[]
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
            const fileObj = 'getFile' in stlFile ? await (stlFile as unknown as FileSystemFileHandle).getFile() : stlFile as File;
            const assetId = `${job.id}-${suffix}`;
            const existingAssets = await dbService.getAssetsByJob(job.id);
            if (!existingAssets.some(a => a.fileName === originalName)) {
                await dbService.addAsset({
                    id: assetId,
                    jobId: job.id,
                    fileName: originalName,
                    mimeType: 'model/stl',
                    size: fileObj.size
                }, fileObj);
                console.log(`Saved asset ${originalName} to IndexedDB for job ${job.id}`);
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
 * @returns The updated job, or `null` if no new teeth were added.
 */
const mergeExistingJobStlFiles = async (
    existingJob: Job,
    projectPrefix: string,
    files: (File | FileSystemFileHandle)[]
): Promise<Job | null> => {
    const updatedJob = JSON.parse(JSON.stringify(existingJob)) as Job;
    const originalTeethCount = updatedJob.teeth.length;
    await processMatchingStlFiles(updatedJob, projectPrefix, files);
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
 * @param sink - Shared result accumulators updated by this call.
 */
const processProjectFile = async (
    fileHandle: File | FileSystemFileHandle,
    projectPrefix: string,
    files: (File | FileSystemFileHandle)[],
    existingJobsByName: Map<string, Job>,
    sink: ProcessSink
): Promise<void> => {
    const existingJob = existingJobsByName.get(fileHandle.name.toLowerCase());
    if (existingJob) {
        const updatedJob = await mergeExistingJobStlFiles(existingJob, projectPrefix, files);
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
        await processMatchingStlFiles(job, projectPrefix, files);

        job.unitCount = job.teeth.length;

        sink.newJobs.push(job);
        collectToothMetadata(job, sink.materials, sink.types);
    }

    const fileParseEndTime = performance.now();
    console.log(` -> Parsed ${fileHandle.name} in ${(fileParseEndTime - fileParseStartTime).toFixed(2)}ms`);
};

/**
 * Parses a list of file-like objects into jobs and metadata.
 * This is a generic helper that works with both the modern API's FileSystemFileHandle
 * and the legacy input's File object.
 *
 * @param files - An array of File or FileSystemFileHandle objects to process.
 * @param existingJobs - Jobs already loaded, used to detect re-imports.
 * @returns An object containing new jobs, jobs updated by re-imported STLs, and discovered metadata.
 */
const processFiles = async (
    files: (File | FileSystemFileHandle)[],
    existingJobs: Job[]
): Promise<{ jobs: Job[], updatedJobs: Job[], materials: string[], types: string[] }> => {
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

    for (const fileHandle of files) {
        // We only care about .dentalProject files, but legacy input doesn't let us filter by extension easily.
        if (!fileHandle.name.toLowerCase().endsWith('.dentalproject')) {
            continue;
        }
        const projectPrefix = fileHandle.name.toLowerCase().replace('.dentalproject', '');
        await processProjectFile(fileHandle, projectPrefix, files, existingJobsByName, sink);
    }

    const endTime = performance.now();
    console.log(`Finished processing all files in ${(endTime - startTime).toFixed(2)}ms`);

    return {
        jobs: newJobs,
        updatedJobs,
        materials: Array.from(discoveredMaterials),
        types: Array.from(discoveredTypes)
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
 * @param existingFileNames - A set of filenames already loaded, used to skip duplicate files.
 * @returns A promise resolving to an object containing the parsed jobs, discovered materials, and discovered types.
 */
export const scanAndParseFolder = async (existingJobs: Job[]): Promise<{ jobs: Job[], updatedJobs: Job[], materials: string[], types: string[] }> => {
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
            const result = await processFiles(fileHandles, existingJobs);
            const totalTimeEnd = performance.now();
            console.log(`Total scan and parse time: ${(totalTimeEnd - totalTimeStart).toFixed(2)}ms`);
            return result;
        } 
        // Legacy Fallback path
        else {
            const fileList = await legacyDirectoryPicker();
            const filesArray = Array.from(fileList);
            const result = await processFiles(filesArray, existingJobs);
            const totalTimeEnd = performance.now();
            console.log(`Total scan and parse time: ${(totalTimeEnd - totalTimeStart).toFixed(2)}ms`);
            return result;
        }
    } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((error as any).name === 'AbortError' || (error as any).message.includes('User cancelled')) {
            console.log("User cancelled folder selection");
            return { jobs: [], updatedJobs: [], materials: [], types: [] };
        }
        console.error("Error scanning folder:", error);
        throw error;
    }
};
