/**
 * @file Pricing utility functions.
 *
 * Provides helpers for extracting tariff rule kinds, building tooth-level
 * evaluation contexts, constructing rule breakdown records, and validating
 * the shape of rules and jobs before pricing logic is applied.
 */

import type { Job, TariffRule, AppliedRuleBreakdown, TariffRuleKind } from '../types';
import type { EvaluationContext } from './conditionEvaluator';

/**
 * Extracts the execution kind from a tariff rule, defaulting to `'base'`
 * when the rule has no explicit kind.
 *
 * @param rule - The tariff rule to inspect.
 * @returns The rule kind (`'base'`, `'unitExtra'`, `'jobExtra'`, `'invalid'`, `'review'`, or `'ignoreUnit'`).
 */
export const getRuleKind = (rule: TariffRule): TariffRuleKind => rule.kind || 'base';

/**
 * Creates an evaluation context object by merging a job's top-level fields
 * with the given tooth's properties. This context is used when evaluating
 * tariff rule conditions at the tooth level.
 *
 * @param job   - The parent job containing shared fields (patient name,
 *                doctor name, unit count, etc.).
 * @param tooth - The specific tooth descriptor; supplies `material`,
 *                `type`, `isScrewRetained`, and `number`.
 * @returns A flat object with all job fields plus `material`, `type`,
 *          `unitCount`, `isScrewRetained`, and `number`.
 */
export const createToothContext = (job: Job, tooth: { number: number; material?: string; type?: string; isScrewRetained?: boolean }) => {
    return {
        ...job,
        material: tooth.material || 'Unknown',
        type: tooth.type || 'Unknown',
        unitCount: job.unitCount,
        isScrewRetained: tooth.isScrewRetained,
        number: tooth.number
    };
};

/**
 * Creates a job-level evaluation context by spreading the job's top-level
 * fields **without** `material` or `type`. This prevents jobExtra rule
 * conditions from matching against tooth-specific material/type data
 * (which would be semantically incorrect for job-level concepts).
 *
 * When `evaluateCondition` looks up a `material` or `type` field on this
 * context, the value will be `undefined` and the condition will evaluate
 * to `false` — the desired behaviour.
 *
 * @param job - The parent job whose fields populate the context.
 * @returns An {@link EvaluationContext} containing only job-level fields.
 */
export const createJobContext = (job: Job): EvaluationContext => {
    // Intentionally omit teeth/material/type so jobExtra rules cannot
    // match on tooth-level fields. evaluateCondition returns false for
    // undefined/null, so any condition referencing those fields will fail.
    const exclude = new Set(['teeth', 'material', 'type']);
    const jobFields = Object.fromEntries(
        Object.entries(job).filter(([key]) => !exclude.has(key))
    );
    return jobFields as unknown as EvaluationContext;
};

/**
 * Builds an {@link AppliedRuleBreakdown} record from a matched tariff rule
 * and its computed price, capturing the rule's identity and any exclusion
 * flag for downstream display or audit purposes.
 *
 * @param rule       - The tariff rule that was applied.
 * @param amount     - The computed monetary amount for this rule.
 * @param currency   - Currency of the amount (`'HUF'` or `'EUR'`).
 * @param kind       - The execution kind of the rule.
 * @param isExcluded - Optional flag indicating the rule was excluded from
 *                     the final calculation.
 * @returns A fully populated {@link AppliedRuleBreakdown} object.
 */
export const buildRuleBreakdown = (
    rule: TariffRule,
    amount: number,
    currency: 'HUF' | 'EUR',
    kind: TariffRuleKind,
    isExcluded?: boolean
): AppliedRuleBreakdown => ({
    id: rule.id,
    name: rule.name,
    label: rule.label || rule.name,
    priority: rule.priority,
    kind,
    amount,
    currency,
    isExcluded
});

/**
 * Validates the structural integrity of a tariff rule object.
 *
 * Checks, in order:
 * - Existence and object type.
 * - A non-empty string `id`.
 * - An array of `conditions`.
 * - An object `action`.
 *
 * @param rule - The tariff rule candidate to validate.
 * @returns `true` if the rule passes all structural checks; `false`
 *          otherwise.
 */
export const validateRule = (rule: TariffRule): boolean => {
    if (!rule || typeof rule !== 'object') return false;
    if (!rule.id || typeof rule.id !== 'string') return false;
    if (!Array.isArray(rule.conditions)) return false;
    if (!rule.action || typeof rule.action !== 'object') return false;
    return true;
};

/**
 * Validates the structural integrity of a job object.
 *
 * Checks, in order:
 * - Existence and object type.
 * - A non-empty string `id`.
 * - An array of `teeth`.
 *
 * @param job - The job candidate to validate.
 * @returns `true` if the job passes all structural checks; `false`
 *          otherwise.
 */
export const validateJob = (job: Job): boolean => {
    if (!job || typeof job !== 'object') return false;
    if (!job.id || typeof job.id !== 'string') return false;
    if (!Array.isArray(job.teeth)) return false;
    return true;
};
