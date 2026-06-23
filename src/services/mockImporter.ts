/**
 * @file Generates mock dental job data for development and testing.
 *       Provides cryptographically random patient, doctor, tooth, and
 *       3D model entries to simulate real import workflows.
 */

import type { Job } from '../types';

const MATERIALS = ['Zircon', 'PMMA', 'CoCr', 'Titanium', 'Wax'];
const TYPES = ['Crown', 'Bridge', 'Inlay', 'Onlay', 'Veneer', 'Abutment'];
const DOCTORS = ['Dr. Smith', 'Dr. Doe', 'Dr. House', 'Dr. Strange'];

/**
 * Returns a cryptographically random integer in the range [min, max).
 * @param min - The inclusive lower bound of the range.
 * @param max - The exclusive upper bound of the range.
 * @return A random integer between min (inclusive) and max (exclusive).
 */
function getRandomInt(min: number, max: number): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return Math.floor((array[0] / (0xFFFFFFFF + 1)) * (max - min)) + min;
}

/**
 * Returns a cryptographically random floating-point number in [0, 1).
 * @return A random float between 0 (inclusive) and 1 (exclusive).
 */
function getRandomFloat(): number {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
}

/**
 * Generates a cryptographically random alphanumeric string of the specified length.
 * @param length - The desired length of the random string.
 * @return A random string consisting of alphanumeric characters (base-36).
 */
function getRandomString(length: number): string {
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (n) => n.toString(36)).join('').substr(0, length);
}

/**
 * Generates a single random mock Job with randomized patient data, doctor,
 * teeth, and notes. For even-indexed jobs, two 3D Model teeth (UpperJaw
 * and LowerJaw) are appended to simulate a full-arch scan.
 * @param index - The zero-based index of the job (used to conditionally
 *                 add 3D model tooth units).
 * @return A randomly generated Job object.
 */
const generateMockJob = (index: number): Job => {
    const unitCount = getRandomInt(1, 6);
    const teeth = [];
    
    // Generate teeth
    for (let i = 0; i < unitCount; i++) {
        teeth.push({
            id: `${Date.now()}-${i}-${getRandomString(5)}`,
            number: getRandomInt(1, 33), // Random tooth number 1-32
            material: MATERIALS[getRandomInt(0, MATERIALS.length)],
            type: TYPES[getRandomInt(0, TYPES.length)]
        });
    }

    // Add mock 3D Model job-level units for testing the 3D viewer
    if (index % 2 === 0) {
        teeth.push({
            id: `${Date.now()}-mock-stl-1-${index}`,
            number: 0,
            type: '3D Model',
            material: 'UpperJaw',
            status: 'Calculated' as const,
            price: 0
        });
        teeth.push({
            id: `${Date.now()}-mock-stl-2-${index}`,
            number: 0,
            type: '3D Model',
            material: 'LowerJaw',
            status: 'Calculated' as const,
            price: 0
        });
    }

    // Simulate some logic requiring manual review
    const notes = getRandomFloat() > 0.8 ? 'Manual check: margin unclear' : '';
    
    return {
        id: getRandomString(9),
        patientName: `Patient ${getRandomInt(0, 1000)}`,
        doctorName: DOCTORS[getRandomInt(0, DOCTORS.length)],
        fileName: `scan_${20250000 + index}.dentalProject`,
        createdAt: new Date().toISOString(),
        teeth: teeth,
        unitCount: teeth.length,
        status: 'Pending',
        price: 0,
        notes: notes
    };
};

/**
 * Simulates scanning a folder for dental project files and returns a
 * randomly generated list of mock Jobs with an artificial 1.5-second delay.
 * @returns A Promise that resolves to an array of randomly generated Job
 *          objects representing the imported files.
 */
export const mockImportJobs = async (): Promise<Job[]> => {
    console.log('Starting mock job import...');
    const startTime = performance.now();

    return new Promise((resolve) => {
        const generationStartTime = performance.now();
        const count = getRandomInt(3, 9); // 3 to 8 jobs
        const jobs = Array.from({ length: count }, (_, i) => generateMockJob(i));
        const generationEndTime = performance.now();
        console.log(`Job generation took: ${(generationEndTime - generationStartTime).toFixed(2)}ms`);

        setTimeout(() => {
            const endTime = performance.now();
            console.log(`Total mock import time (including artificial delay): ${(endTime - startTime).toFixed(2)}ms`);
            resolve(jobs);
        }, 1500);
    });
};
