/**
 * @file Text and currency formatting utility functions.
 * Provides helpers for truncating strings, formatting currency amounts,
 * summing mixed-currency job totals, and generating job summary labels.
 */

import type { Job } from '../types';

/**
 * Truncates a string to a specified length and adds an ellipsis.
 * @param text The text to truncate.
 * @param limit The maximum length of the string.
 * @returns The truncated string.
 */
export const truncate = (text: string, limit: number): string => {
    if (!text) return '';
    return text.length > limit ? `${text.substring(0, limit)}...` : text;
};

/**
 * Formats a numeric price with a currency symbol.
 * @param amount The numeric amount.
 * @param currency The currency code (e.g., 'HUF', 'EUR'). Defaults to 'HUF'.
 * @returns Formatted string (e.g., "1,000 Ft", "50 €").
 */
export const formatCurrency = (amount: number, currency: string = 'HUF'): string => {
    const symbol = currency === 'EUR' ? '€' : 'Ft';
    return `${amount.toLocaleString()} ${symbol}`;
};

/**
 * Formats mixed currency amounts by summing up HUF and EUR separately from a list of jobs.
 * @param jobs List of jobs to sum up.
 * @returns Formatted string (e.g., "1,000 Ft + 50 €").
 */
export const formatMixedCurrency = (jobs: Job[]): string => {
    let hufTotal = 0;
    let eurTotal = 0;

    jobs.forEach(job => {
        // Sum up teeth prices
        job.teeth.forEach(tooth => {
            if (tooth.price && tooth.price > 0) {
                if (tooth.currency === 'EUR') {
                    eurTotal += tooth.price;
                } else {
                    hufTotal += tooth.price;
                }
            }
        });
        // Sum up job-level extra rules
        if (job.appliedJobRules) {
            job.appliedJobRules.forEach(rule => {
                if (rule.amount && rule.amount > 0) {
                    if (rule.currency === 'EUR') {
                        eurTotal += rule.amount;
                    } else {
                        hufTotal += rule.amount;
                    }
                }
            });
        }
    });

    const parts: string[] = [];
    if (hufTotal > 0 || (hufTotal === 0 && eurTotal === 0)) {
        parts.push(`${hufTotal.toLocaleString()} Ft`);
    }
    if (eurTotal > 0) {
        parts.push(`${eurTotal.toLocaleString()} €`);
    }

    return parts.join(' + ');
};

/**
 * Calculates a summary material and type for a job based on its teeth.
 * @param teeth List of teeth objects with material and type properties.
 * @returns Object containing summary material and type strings.
 */
export const getJobSummary = (teeth: { material: string; type: string }[] | undefined): { material: string, type: string } => {
    if (!teeth || !Array.isArray(teeth)) {
        return { material: 'Unknown', type: 'Unknown' };
    }
    const materials = new Set(teeth.map(t => t.material).filter(m => m && m !== 'Unknown'));
    const types = new Set(teeth.map(t => t.type).filter(t => t && t !== 'Unknown'));
    
    let material = 'Unknown';
    if (materials.size === 1) material = Array.from(materials)[0];
    else if (materials.size > 1) material = 'Mixed';

    let type = 'Unknown';
    if (types.size === 1) type = Array.from(types)[0];
    else if (types.size > 1) type = 'Mixed';

    return { material, type };
};

/**
 * Represents the result of a dominant-value analysis over an array of teeth.
 */
export interface DominantValueSummary {
    /** The most frequent non-empty/non-Unknown value (alphabetical tie-breaker). */
    dominant: string;
    /** Array of all other values with their counts, sorted by count desc then alpha. */
    overflow: Array<{ value: string; count: number }>;
}

/**
 * Minimal shape required by {@link getDominantValueSummary}. Teeth with
 * `isIgnored === true` are excluded from the analysis, matching the rule
 * used elsewhere in the UI (e.g. unit counts, status tooltips, invoice
 * grouping).
 */
type DominantValueTooth = {
    material: string;
    type: string;
    isIgnored?: boolean;
};

/**
 * Counts occurrences of each non-empty, non-'Unknown' value for a given field
 * across an array of teeth, then identifies the most frequent value and lists
 * the remaining values with their counts as an overflow array.
 *
 * Teeth that are ignored by an `ignoreUnit` rule (`isIgnored === true`) are
 * excluded so the summary reflects only what will actually be billed.
 *
 * Ties are broken alphabetically (ascending). The overflow array is sorted
 * by count descending, then alphabetically ascending.
 *
 * @param teeth - Array of teeth objects.
 * @param field - The key on a tooth to analyse (e.g. 'material' or 'type').
 * @returns A {@link DominantValueSummary} with the dominant value and overflow items.
 */
export const getDominantValueSummary = (
    teeth: DominantValueTooth[] | undefined,
    field: 'material' | 'type'
): DominantValueSummary => {
    const fallback: DominantValueSummary = { dominant: 'Unknown', overflow: [] };

    if (!teeth || !Array.isArray(teeth) || teeth.length === 0) {
        return fallback;
    }

    const counts = new Map<string, number>();
    teeth.forEach(t => {
        if (t.isIgnored === true) return;
        const val = t[field];
        if (val && val !== 'Unknown') {
            counts.set(val, (counts.get(val) || 0) + 1);
        }
    });

    if (counts.size === 0) {
        return fallback;
    }

    // Sort by count desc, then alphabetically asc for determinism
    const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

    const dominant = sorted[0][0];
    const overflow = sorted.slice(1).map(([value, count]) => ({ value, count }));

    return { dominant, overflow };
};
