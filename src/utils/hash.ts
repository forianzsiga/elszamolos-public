/**
 * @file Utility functions for generating and displaying hash values for Job objects.
 *       Provides a deterministic hashing mechanism for client-side duplicate detection
 *       and human-readable hash truncation for UI display.
 */

import type { Job } from '../types';

/**
 * Creates a consistent hashable string from a Job's core properties.
 *
 * Normalizes patient and doctor names (case-insensitive, sorted tokens) and
 * incorporates teeth details to build a deterministic key, then applies the
 * cyrb53 hash function to produce a compact hexadecimal fingerprint suitable
 * for client-side uniqueness checks.
 *
 * @param job - The Job object to hash. Must contain patientName, doctorName,
 *              unitCount, and optionally teeth details.
 * @returns A hexadecimal string representation of the 53-bit hash value.
 */
export const generateJobHash = (job: Job): string => {
    // Normalize names to handle name swapping (e.g. "Kis Ferenc" vs "Ferenc Kis")
    // We convert to lowercase to handle case differences as well for robust matching
    const normalize = (s: string) => s ? s.trim().toLowerCase().split(/\s+/).sort().join(' ') : '';

    const pName = normalize(job.patientName);
    const dName = normalize(job.doctorName);

    // Include teeth details in the hash key
    const teethString = job.teeth
        ? job.teeth.map(t => `${t.number}:${t.material}:${t.type}:${t.isScrewRetained ? 'S' : 'C'}`).join('|')
        : '';
        
    const key = `${pName}-${dName}-${job.unitCount}-${teethString}`;
    
    // Simple hash function (cyrb53) - good enough for client-side uniqueness check
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < key.length; i++) {
        ch = key.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};

/**
 * Shortens a hash for display purposes.
 *
 * Truncates a hash string to a shorter form with ellipsis in the middle,
 * showing only the first {@code start} and last {@code end} characters.
 *
 * @param hash - The full hash string to shorten.
 * @param start - Number of leading characters to keep (default 6).
 * @param end   - Number of trailing characters to keep (default 4).
 * @returns The shortened hash string in the form "abc...123", or an empty
 *          string if the input hash is falsy.
 */
export const shortenHash = (hash: string, start = 6, end = 4) => {
    if (!hash) return '';
    return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}