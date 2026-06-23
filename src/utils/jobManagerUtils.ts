/**
 * @file Utility functions for filtering, sorting, and duplicate detection of jobs.
 */

import { generateJobHash } from './hash';
import { getDominantValueSummary } from './text';
import type { Job, Tooth } from '../types';

/**
 * Represents a value type that can be used as a sort key.
 */
type SortValue = string | number | undefined | null;

/**
 * Identifies duplicate job hashes in the list of jobs.
 * Any hash that appears more than once is considered a duplicate.
 * @param jobs - Array of jobs to scan for duplicate hashes
 * @returns A set of original hash values that appear more than once
 */
export function getDuplicateHashes(jobs: Job[]): Set<string> {
    const hashCounts = new Map<string, number>();
    const duplicates = new Set<string>();
    
    jobs.forEach(job => {
        if (job.originalHash) {
            const count = (hashCounts.get(job.originalHash) || 0) + 1;
            hashCounts.set(job.originalHash, count);
            if (count > 1) {
                duplicates.add(job.originalHash);
            }
        }
    });
    return duplicates;
}

/**
 * Computes unique options for column filters.
 * @param jobs - Array of jobs to derive filter options from
 * @returns A record mapping filter field names to their sorted unique value arrays
 */
export function getFilterOptions(jobs: Job[]): Record<string, string[]> {
    const options: Record<string, string[]> = {
        status: [],
        state: ['Original', 'Modified', 'Duplicate'],
        doctorName: [],
        patientName: [],
        material: [],
        type: [],
        isScrewRetained: ['Yes', 'No']
    };

    if (jobs.length > 0) {
        options.status = Array.from(new Set(jobs.map(j => j.status))).sort();
        options.doctorName = Array.from(new Set(jobs.map(j => j.doctorName).filter(Boolean))).sort();
        options.patientName = Array.from(new Set(jobs.map(j => j.patientName).filter(Boolean))).sort();
        
        const materials = new Set<string>();
        const types = new Set<string>();
        jobs.forEach(j => {
            if (j.teeth) {
                j.teeth.forEach(t => {
                    if (t.material && t.material !== 'Unknown') materials.add(t.material);
                    if (t.type && t.type !== 'Unknown') types.add(t.type);
                });
            }
        });
        options.material = Array.from(materials).sort();
        options.type = Array.from(types).sort();
    }
    return options;
}

/**
 * Checks whether a job matches the given free-text search string.
 * The search is case-insensitive and checks the patient name,
 * doctor name, and file name fields.
 * @param job - The job to test
 * @param searchText - The case-insensitive text to search for
 * @returns `true` if any of the checked fields contain the search text
 */
function matchesSearchText(job: Job, searchText: string): boolean {
    const searchStr = searchText.toLowerCase();
    return (
        job.patientName.toLowerCase().includes(searchStr) ||
        job.doctorName.toLowerCase().includes(searchStr) ||
        job.fileName.toLowerCase().includes(searchStr)
    );
}

/**
 * Checks whether a job's creation date falls within the specified date range.
 * Compares the first 10 characters of `job.createdAt` (i.e. `YYYY-MM-DD`)
 * against the optional `start` and `end` boundaries.
 * @param job - The job whose creation date is tested
 * @param dateFilter - Object with optional `start` and `end` date strings in `YYYY-MM-DD` format
 * @returns `true` if the job date is within the range (or if no boundaries are set)
 */
function matchesDateFilter(job: Job, dateFilter: { start?: string; end?: string }): boolean {
    if (!dateFilter.start && !dateFilter.end) return true;
    const jobDate = job.createdAt.slice(0, 10);
    if (dateFilter.start && jobDate < dateFilter.start) return false;
    if (dateFilter.end && jobDate > dateFilter.end) return false;
    return true;
}

/**
 * Checks whether a single job matches one specific column filter.
 * Handles special logic for the `state`, `material`, `type`,
 * and `isScrewRetained` fields; all other fields are compared directly.
 * @param job - The job to test
 * @param field - The filter field name (e.g. `status`, `state`, `material`)
 * @param selectedValues - Array of user-selected values for this field
 * @param duplicateHashes - Set of original hash values identified as duplicates (used for `state` filtering)
 * @returns `true` if the job satisfies this single filter, or if `selectedValues` is empty
 */
function matchesSingleFilter(
    job: Job,
    field: string,
    selectedValues: string[],
    duplicateHashes: Set<string>
): boolean {
    if (selectedValues.length === 0) return true;

    if (field === 'state') {
        const isMod = job.originalHash && generateJobHash(job) !== job.originalHash;
        const isDup = job.originalHash && duplicateHashes.has(job.originalHash);
        const isOriginal = !isMod && !isDup;
        
        return selectedValues.some(val => {
            if (val === 'Modified') return isMod;
            if (val === 'Duplicate') return isDup;
            if (val === 'Original') return isOriginal;
            return false;
        });
    } else if (field === 'material' || field === 'type') {
        if (!job.teeth || job.teeth.length === 0) return false;
        const jobValues = job.teeth.map((t: Tooth) => t[field as keyof typeof t]);
        return jobValues.some((v) => {
            if (v === undefined || typeof v === 'boolean' || Array.isArray(v)) return false;
            return selectedValues.includes(String(v));
        });
    } else if (field === 'isScrewRetained') {
        const hasScrewRetained = job.teeth.some(t => t.isScrewRetained);
        const matchYes = selectedValues.includes('Yes') && hasScrewRetained;
        const matchNo = selectedValues.includes('No') && !hasScrewRetained;
        return matchYes || matchNo;
    } else {
        const jobValue = String(job[field as keyof Job]);
        return selectedValues.includes(jobValue);
    }
}

/**
 * Checks whether a job matches every active column filter simultaneously.
 * Delegates individual field checks to {@link matchesSingleFilter}.
 * @param job - The job to test
 * @param columnFilters - Record mapping filter field names to arrays of selected values
 * @param duplicateHashes - Set of original hash values identified as duplicates
 * @returns `true` if the job passes all column filters
 */
function matchesColumnFilters(
    job: Job,
    columnFilters: Record<string, string[]>,
    duplicateHashes: Set<string>
): boolean {
    return Object.entries(columnFilters).every(([field, selectedValues]) => 
        matchesSingleFilter(job, field, selectedValues, duplicateHashes)
    );
}

/**
 * Filters the list of jobs by search text, date, and column filters.
 * @param jobs - Array of jobs to filter
 * @param searchText - Text to search for in patient name, doctor name, or file name
 * @param dateFilter - Object with optional start and end date strings (YYYY-MM-DD)
 * @param columnFilters - Record mapping filter field names to arrays of selected values
 * @param duplicateHashes - Set of original hash values identified as duplicates
 * @returns Filtered array of jobs matching all specified criteria
 */
export function filterJobs(
    jobs: Job[],
    searchText: string,
    dateFilter: { start?: string; end?: string },
    columnFilters: Record<string, string[]>,
    duplicateHashes: Set<string>
): Job[] {
    return jobs.filter(job => {
        if (searchText && !matchesSearchText(job, searchText)) return false;
        if (!matchesDateFilter(job, dateFilter)) return false;
        if (!matchesColumnFilters(job, columnFilters, duplicateHashes)) return false;
        return true;
    });
}

/**
 * Extracts the comparable sort values for two jobs on a given sort key.
 * For `material` and `type` keys the dominant tooth value is used;
 * for all other keys the raw job property is returned.
 * @param a - The first job
 * @param b - The second job
 * @param key - The property name to extract for comparison
 * @returns An object containing `aVal` and `bVal` ready for comparison
 */
function getSortValues(
    a: Job,
    b: Job,
    key: string
): { aVal: SortValue, bVal: SortValue } {
    if (key === 'material') {
        return { aVal: getDominantValueSummary(a.teeth, 'material').dominant, bVal: getDominantValueSummary(b.teeth, 'material').dominant };
    }
    if (key === 'type') {
        return { aVal: getDominantValueSummary(a.teeth, 'type').dominant, bVal: getDominantValueSummary(b.teeth, 'type').dominant };
    }
    return { aVal: a[key as keyof Job] as SortValue, bVal: b[key as keyof Job] as SortValue };
}

/**
 * Returns a numeric rank for a job's status field.
 * Lower ranks sort first in ascending order.
 * `Calculated` (0) → `Pending` (0.1 or missing-unit count) → `Review` (1000) → `Invalid` (2000) → `Discarded` (3000) → default (4000).
 * @param job - The job whose status rank is computed
 * @returns A non-negative integer rank used for comparison
 */
function getStatusRank(job: Job): number {
    if (job.status === 'Calculated') return 0;
    if (job.status === 'Pending') {
        const missing = (job.unitCount || 0) - (job.teethMatched || 0);
        return missing > 0 ? missing : 0.1;
    }
    if (job.status === 'Review') return 1000;
    if (job.status === 'Invalid') return 2000;
    if (job.status === 'Discarded') return 3000;
    return 4000;
}

/**
 * Returns a numeric rank for a job's logical state.
 * `Original` → 1, `Modified` → 2, `Duplicate` → 3.
 * @param j - The job whose state rank is computed
 * @param duplicateHashes - Set of original hash values identified as duplicates
 * @returns A rank integer: 1 for original, 2 for modified, 3 for duplicate
 */
function getStateRank(j: Job, duplicateHashes: Set<string>): number {
    if (j.originalHash && duplicateHashes.has(j.originalHash)) return 3;
    if (j.originalHash && generateJobHash(j) !== j.originalHash) return 2;
    return 1;
}

/**
 * Compares two jobs by their status rank.
 * @param a - The first job
 * @param b - The second job
 * @param direction - Sort direction: `'asc'` for ascending, `'desc'` for descending
 * @returns Negative if `a` sorts before `b`, positive if after, `0` if equal
 */
function compareStatus(a: Job, b: Job, direction: 'asc' | 'desc'): number {
    const rankA = getStatusRank(a);
    const rankB = getStatusRank(b);
    if (rankA < rankB) return direction === 'asc' ? -1 : 1;
    if (rankA > rankB) return direction === 'asc' ? 1 : -1;
    return 0;
}

/**
 * Compares two jobs by their logical state rank (original / modified / duplicate).
 * @param a - The first job
 * @param b - The second job
 * @param direction - Sort direction: `'asc'` for ascending, `'desc'` for descending
 * @param duplicateHashes - Set of original hash values identified as duplicates
 * @returns Negative if `a` sorts before `b`, positive if after, `0` if equal
 */
function compareState(a: Job, b: Job, direction: 'asc' | 'desc', duplicateHashes: Set<string>): number {
    const rankA = getStateRank(a, duplicateHashes);
    const rankB = getStateRank(b, duplicateHashes);
    if (rankA < rankB) return direction === 'asc' ? -1 : 1;
    if (rankA > rankB) return direction === 'asc' ? 1 : -1;
    return 0;
}

/**
 * General-purpose comparator for two jobs based on a sort configuration.
 * Delegates to {@link compareStatus} and {@link compareState} for those
 * special keys; all others use {@link getSortValues} for comparison.
 * @param a - The first job
 * @param b - The second job
 * @param sortConfig - Object with `key` (property name) and `direction` (`'asc'` or `'desc'`)
 * @param duplicateHashes - Set of original hash values identified as duplicates
 * @returns Negative if `a` sorts before `b`, positive if after, `0` if equal
 */
function compareJobs(
    a: Job,
    b: Job,
    sortConfig: { key: string; direction: 'asc' | 'desc' },
    duplicateHashes: Set<string>
): number {
    if (sortConfig.key === 'status') {
        return compareStatus(a, b, sortConfig.direction);
    }

    if (sortConfig.key === 'state') {
        return compareState(a, b, sortConfig.direction, duplicateHashes);
    }

    const { aVal, bVal } = getSortValues(a, b, sortConfig.key);

    if (aVal === bVal) return 0;
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
}

/**
 * Sorts filtered jobs based on the sort configuration.
 * @param filteredJobs - Array of already-filtered jobs to sort
 * @param sortConfig - Sort configuration with key and direction, or null to skip sorting
 * @param duplicateHashes - Set of original hash values identified as duplicates
 * @returns A new sorted array of jobs
 */
export function sortJobs(
    filteredJobs: Job[],
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null,
    duplicateHashes: Set<string>
): Job[] {
    if (!sortConfig) return filteredJobs;

    return [...filteredJobs].sort((a, b) => compareJobs(a, b, sortConfig, duplicateHashes));
}
