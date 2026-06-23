/**
 * @file Utility functions for transforming tooth and job-extra data into
 * display-ready table rows for the job teeth table component.
 */

import type { AppliedRuleBreakdown, Tooth, Job } from '../types';

/**
 * Ensures a tooth has a stable, unique identifier.
 * If the tooth already has an `id`, it is returned unchanged.
 * Otherwise, a deterministic ID is synthesised from the job id, tooth number,
 * and position index so that the same tooth keeps the same id across renders.
 *
 * @param tooth   The tooth to check / modify.
 * @param jobId   The stable identifier of the parent job.
 * @param index   Zero-based index of the tooth within the job's tooth array.
 * @returns A new tooth object with a guaranteed non-empty `id`.
 */
export const ensureToothId = (tooth: Tooth, jobId: string, index: number): Tooth => {
    if (tooth.id) return tooth;
    return {
        ...tooth,
        id: `stable-${jobId}-${tooth.number}-${index}`
    };
};

/**
 * Ensures that every tooth in a job has a stable, unique identifier.
 * Mutates a shallow copy of the job to avoid side-effects.
 *
 * @param job  The job whose teeth should have stable IDs.
 * @returns A new job object with all teeth having a non-empty `id`.
 */
export const ensureJobTeethIds = (job: Job): Job => {
    const updatedTeeth = job.teeth.map((tooth, index) => ensureToothId(tooth, job.id, index));
    return { ...job, teeth: updatedTeeth };
};

/** Discriminated union of possible row kinds in the job teeth table. */
export type JobTeethTableEntryKind = 'tooth' | 'unitExtra' | 'jobExtra' | 'hiddenHeader';

/** A single row in the job teeth table, representing either a tooth, a tooth-level
 * extra rule, a job-level extra rule, or a hidden header placeholder. */
export interface JobTeethTableEntry {
    /** Unique identifier for the row. */
    id: string;
    /** Discriminant indicating the row's purpose. */
    kind: JobTeethTableEntryKind;
    /** The tooth associated with this row. */
    tooth: Tooth;
    /** When `kind` is `unitExtra` or `jobExtra`, the applied rule breakdown. */
    extraRule?: AppliedRuleBreakdown;
}

/**
 * Determines if a table entry (row) is marked as excluded from pricing.
 *
 * @param entry - The table row entry to check.
 * @returns `true` if the entry represents an excluded rule or tooth.
 */
export const isEntryExcluded = (entry: JobTeethTableEntry): boolean => {
    if (entry.kind === 'tooth') {
        return !!entry.tooth.isExcluded;
    }
    if (entry.extraRule) {
        return !!entry.extraRule.isExcluded;
    }
    return !!entry.tooth.isExcluded;
};

/**
 * Builds an ordered array of table-row entries from a sorted list of teeth
 * and a list of job-level extra rules.
 *
 * Rows are emitted in the following order per tooth:
 *  1. The tooth itself (kind `tooth`)
 *  2. Tooth-level extra rules (kind `unitExtra`) — inlined immediately
 *     after the parent tooth so the user sees each tooth followed by its
 *     own extras.
 *
 * After all teeth (with their inlined tooth-level extras) have been
 * processed, job-level extra rules (kind `jobExtra`) are appended at the
 * end, sorted by priority. Job extras appear BEFORE any hidden-items
 * rows added downstream by the consumer (see `JobTeethTable.tsx`).
 *
 * The previous design emitted a strikethrough "excluded base rule" ghost
 * row per tooth, plus a companion "new" tooth with a fake `number` like
 * `17.1` for `ignoreUnit` exclusions. Both patterns are removed: the
 * chevron expansion below each row now surfaces the full applied-rule
 * list including any excluded rules, and excluded `ignoreUnit` rules are
 * applied to the original tooth via `excludedRuleIds` rather than spawning
 * a new companion unit.
 *
 * @param sortedTeeth  Teeth already sorted in the desired display order.
 * @param _teeth       Unused parameter (retained for API compatibility).
 * @param jobExtraRules  Job-level extra-rule breakdowns to append.
 * @param jobId        The parent job's stable identifier, used to synthesise
 *                     stable IDs for teeth that lack one. When omitted, falls
 *                     back to the tooth's own `id` or a number-based key.
 * @returns A flat array of display-ready table row entries.
 */
export const getDisplayRows = (
    sortedTeeth: Tooth[],
    _teeth: Tooth[],
    jobExtraRules: AppliedRuleBreakdown[],
    jobId?: string
): JobTeethTableEntry[] => {
    const rows: JobTeethTableEntry[] = [];

    for (let i = 0; i < sortedTeeth.length; i++) {
        const tooth = jobId ? ensureToothId(sortedTeeth[i], jobId, i) : sortedTeeth[i];
        const toothId = tooth.id || `tooth-${tooth.number}`;

        rows.push({
            id: toothId,
            kind: 'tooth',
            tooth
        });

        const unitExtras = (tooth.appliedRules || [])
            .filter(rule => rule.kind === 'unitExtra' && (rule.amount !== 0 || rule.isExcluded))
            .sort((left, right) => left.priority - right.priority);

        unitExtras.forEach(extraRule => {
            rows.push({
                id: `tooth-extra-${toothId}-${extraRule.id}`,
                kind: 'unitExtra',
                tooth,
                extraRule
            });
        });
    }

    jobExtraRules
        .slice()
        .sort((left, right) => left.priority - right.priority)
        .forEach(extraRule => {
            rows.push({
                id: `job-extra-${extraRule.id}`,
                kind: 'jobExtra',
                tooth: {
                    number: 0,
                    material: '-',
                    type: '-',
                    price: 0,
                    status: 'Calculated',
                    currency: 'HUF'
                } as Tooth,
                extraRule
            });
        });

    return rows;
};
