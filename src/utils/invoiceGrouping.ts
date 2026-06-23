/**
 * @file Utilities for grouping invoice line items by doctor, patient, and tariff rules.
 *       Provides functions to structure job and tooth data into grouped invoice lines.
 */

import type { Tooth, Job, AppliedRuleBreakdown, TariffRuleKind } from '../types';

/**
 * Represents a single grouped line on an invoice.
 * Lines with the same tariff rule (id, amount, kind) are merged into one entry
 * carrying the list of affected tooth numbers and a total count.
 */
export interface GroupedLine {
    key: string;
    label: string;
    units: number[];
    count: number;
    priority: number;
    pricePerUnit: number;
    kind: TariffRuleKind;
}

/**
 * Groups jobs first by doctor name, then by patient name.
 *
 * @param jobs - The list of jobs to structure.
 * @returns A two-level record: `byDoctor[doctorName][patientName] = Job[]`.
 */
export const groupJobsStructure = (jobs: Job[]) => {
    const byDoctor: Record<string, Record<string, Job[]>> = {};

    jobs.forEach(job => {
        const doc = job.doctorName || 'Unknown Doctor';
        const patient = job.patientName || 'Unknown Patient';

        if (!byDoctor[doc]) byDoctor[doc] = {};
        if (!byDoctor[doc][patient]) byDoctor[doc][patient] = [];

        byDoctor[doc][patient].push(job);
    });

    return byDoctor;
};

/**
 * Groups jobs by doctor name and sorts each group's jobs by creation date (ascending),
 * falling back to job ID for stable ordering.
 *
 * @param jobs - The list of jobs to group.
 * @returns A record mapping each doctor name to their sorted array of jobs.
 */
export const groupJobsByDoctor = (jobs: Job[]) => {
    const grouped = jobs.reduce((acc, job) => {
        const docName = job.doctorName || 'Unknown Doctor';
        if (!acc[docName]) {
            acc[docName] = [];
        }
        acc[docName].push(job);
        return acc;
    }, {} as Record<string, Job[]>);

    // Sort jobs inside each doctor group based on date (createdAt)
    Object.keys(grouped).forEach(docName => {
        grouped[docName].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;
            return a.id.localeCompare(b.id);
        });
    });

    return grouped;
};

/**
 * Builds a single-element breakdown array from legacy tooth fields
 * (`appliedRuleId`, `appliedRuleName`, etc.) when no modern `appliedRules` exist.
 *
 * @param tooth - The tooth entity that may carry legacy rule fields.
 * @returns An array with one `AppliedRuleBreakdown` entry, or an empty array if no legacy rule is present.
 */
export const getLegacyBreakdown = (tooth: Tooth): AppliedRuleBreakdown[] => {
    if (!tooth.appliedRuleId && !tooth.appliedRuleName && !tooth.appliedRuleLabel) {
        return [];
    }

    return [{
        id: tooth.appliedRuleId || `legacy-${tooth.number}`,
        name: tooth.appliedRuleName || tooth.appliedRuleLabel || 'Legacy Rule',
        label: tooth.appliedRuleLabel || tooth.appliedRuleName || 'Legacy Rule',
        priority: tooth.appliedRulePriority || 999,
        kind: 'base',
        amount: tooth.basePrice || tooth.price || 0,
        currency: tooth.currency || 'HUF'
    }];
};

/**
 * Groups teeth by their applied tariff rules (or legacy breakdowns) into
 * `GroupedLine` entries. Teeth that are ignored by an `ignoreUnit` rule
 * (`isIgnored === true`) are excluded.
 *
 * @param teeth - The teeth to consolidate into invoice lines.
 * @returns An array of grouped lines, each containing the list of affected tooth numbers and a count.
 */
export const groupToothLines = (teeth: Tooth[]): GroupedLine[] => {
    const grouped = teeth.reduce((acc, tooth) => {
        if (tooth.isIgnored === true) return acc;

        const breakdowns = tooth.appliedRules && tooth.appliedRules.length > 0
            ? tooth.appliedRules.filter(rule => rule.amount !== 0)
            : getLegacyBreakdown(tooth);

        breakdowns.forEach(rule => {
            const key = `${rule.id}-${rule.amount}-${rule.kind}`;

            if (!acc[key]) {
                acc[key] = {
                    key,
                    label: rule.label,
                    units: [],
                    count: 0,
                    priority: rule.priority,
                    pricePerUnit: rule.amount,
                    kind: rule.kind,
                };
            }

            acc[key].units.push(tooth.number);
            acc[key].count++;
        });

        return acc;
    }, {} as Record<string, GroupedLine>);

    return Object.values(grouped);
};

/**
 * Extracts extra invoice lines from a job's `appliedJobRules` that have a
 * non-zero amount. Each rule becomes a separate `GroupedLine` entry with a
 * `'jobExtra'` kind.
 *
 * @param job - The job whose extra rules should be converted to invoice lines.
 * @returns An array of grouped lines for job-level extras.
 */
export const getJobExtraLines = (job: Job): GroupedLine[] => {
    return (job.appliedJobRules || [])
        .filter(rule => rule.amount !== 0)
        .map(rule => ({
            key: `job-${rule.id}-${rule.amount}`,
            label: rule.label,
            units: [],
            count: 1,
            priority: rule.priority,
            pricePerUnit: rule.amount,
            kind: 'jobExtra' as const,
        }));
};
