/**
 * @file Service for managing Material and Type metadata.
 * Handles scanning jobs for usage and cleaning up unused values.
 */

import { dbService } from './db';
import type { Job } from '../types';

/**
 * Service for managing Material and Type metadata.
 * Handles scanning jobs for usage and cleaning up unused values.
 */
export const metadataService = {
    /**
     * Scans all jobs to see if a specific value is still used.
     * If not used anywhere, removes it from the metadata database.
     * 
     * @param value The value to check (material name or type name)
     * @param key Whether checking 'materials' or 'types'
     * @param jobs The current list of jobs in state
     * @returns True if value was removed, False otherwise
     */
    async cleanupUnusedValue(
        value: string, 
        key: 'materials' | 'types', 
        jobs: Job[]
    ): Promise<boolean> {
        const itemKey = key === 'materials' ? 'material' : 'type';
        
        // Check if value exists in ANY tooth of ANY job
        const isStillInUse = jobs.some(job => 
            job.teeth.some(t => t[itemKey as 'material' | 'type'] === value)
        );

        if (!isStillInUse) {
            await dbService.removeMetadata(key, value);
            return true;
        }
        
        return false;
    },

    /**
     * Compares original and updated job to find removed metadata values
     * and triggers cleanup for each.
     * 
     * @param original - The job before the edit
     * @param updated - The job after the edit
     * @param allJobs - The full list of jobs in the current state
     * @returns A list of human-readable strings describing which values were cleaned up (e.g. "Steel (material)")
     */
    async performAutomaticCleanup(
        original: Job, 
        updated: Job, 
        allJobs: Job[]
    ): Promise<string[]> {
        const getUniqueValues = (job: Job, key: 'material' | 'type') => 
            new Set(job.teeth.map(t => t[key]).filter(Boolean));

        const oldMaterials = getUniqueValues(original, 'material');
        const newMaterials = getUniqueValues(updated, 'material');
        const oldTypes = getUniqueValues(original, 'type');
        const newTypes = getUniqueValues(updated, 'type');

        // Find values that were present in the old version but NOT in the new version
        const removedMaterials = Array.from(oldMaterials).filter(m => !newMaterials.has(m));
        const removedTypes = Array.from(oldTypes).filter(t => !newTypes.has(t));

        const cleanedValues: string[] = [];

        // Check materials
        for (const m of removedMaterials) {
            // Note: we use 'allJobs' but we must account for the fact that 'original' 
            // is still in 'allJobs' while 'updated' is the future state.
            // So we check if anyone ELSE uses it.
            const isUsedElsewhere = allJobs.some(job => {
                if (job.id === updated.id) {
                    // Check the NEW version of this job
                    return updated.teeth.some(t => t.material === m);
                }
                // Check all other jobs
                return job.teeth.some(t => t.material === m);
            });

            if (!isUsedElsewhere) {
                await dbService.removeMetadata('materials', m);
                cleanedValues.push(`${m} (material)`);
            }
        }

        // Check types
        for (const t of removedTypes) {
            const isUsedElsewhere = allJobs.some(job => {
                if (job.id === updated.id) {
                    return updated.teeth.some(unit => unit.type === t);
                }
                return job.teeth.some(unit => unit.type === t);
            });

            if (!isUsedElsewhere) {
                await dbService.removeMetadata('types', t);
                cleanedValues.push(`${t} (type)`);
            }
        }

        return cleanedValues;
    }
};
