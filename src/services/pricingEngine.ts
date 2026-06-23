/**
 * @file Pricing engine service.
 * Evaluates tariff rules against job data to calculate dental pricing per tooth and per job.
 * Supports base rules, unit-level extra rules, and job-level extra rules with priority-based matching.
 * The engine processes each tooth through rule matching, applies additive extras, and determines
 * the final job status (Calculated, Review, Invalid, Pending, etc.).
 *
 * The `ignoreUnit` rule kind short-circuits the engine for the matched tooth: the tooth is marked
 * `isIgnored: true` and excluded from `unitCount`, the pending count, the teeth list, the invoice,
 * and the 3D viewer. The tooth record is preserved in the data so that the rule application is
 * auditable and reversible. If the rule is excluded for the tooth via `excludedRuleIds`, the
 * tooth stays visible and the rule's breakdown is recorded with `isExcluded: true` so the
 * expanded rule list can surface the exclusion.
 *
 * The `jobExtra` rule kind applies once per job whenever at least one tooth in the job matches
 * the rule's conditions (which may reference tooth-level fields like `material`/`type`).
 */

import type { Job, Tooth, TariffRule, AppliedRuleBreakdown } from '../types';
import {
    getRuleKind,
    createToothContext,
    buildRuleBreakdown,
    validateRule,
    validateJob
} from './pricingUtils';
import { evaluateRuleMatch } from './conditionEvaluator';

const evaluateBaseRules = (
    context: ReturnType<typeof createToothContext>,
    baseRules: TariffRule[],
    tooth: Tooth,
    job: Job
): { matchedBaseRule: TariffRule | null; appliedRules: AppliedRuleBreakdown[] } => {
    let matchedBaseRule: TariffRule | null = null;
    const appliedRules: AppliedRuleBreakdown[] = [];

    for (const rule of baseRules) {
        try {
            const isMatch = evaluateRuleMatch(context, rule);
            if (isMatch) {
                const isExcludedForTooth = tooth.excludedRuleIds?.includes(rule.id);
                const isExcludedForJob = job.excludedRuleIds?.includes(rule.id);
                const isExcluded = !!(isExcludedForTooth || isExcludedForJob);

                if (isExcluded) {
                    const originalPrice = rule.action.value || 0;
                    appliedRules.push(buildRuleBreakdown(rule, originalPrice, rule.action.currency || 'HUF', 'base', true));
                    continue;
                }

                matchedBaseRule = rule;
                break;
            }
        } catch (e) {
            console.warn(`Error evaluating rule '${rule.name}':`, e);
        }
    }
    return { matchedBaseRule, appliedRules };
};

const getBaseRuleActionDetails = (
    matchedBaseRule: TariffRule
): { basePrice: number; toothStatus: 'Calculated' | 'Review' | 'Invalid' } => {
    let basePrice = 0;
    let toothStatus: 'Calculated' | 'Review' | 'Invalid' = 'Calculated';

    switch (matchedBaseRule.kind || 'base') {
        case 'base':
        case 'unitExtra':
        case 'jobExtra':
            basePrice = matchedBaseRule.action.value || 0;
            break;
        case 'invalid':
            toothStatus = 'Invalid';
            break;
        case 'review':
            toothStatus = 'Review';
            break;
    }
    return { basePrice, toothStatus };
};

const evaluateExtraRules = (
    context: ReturnType<typeof createToothContext>,
    unitExtraRules: TariffRule[],
    tooth: Tooth,
    job: Job,
    toothCurrency: 'HUF' | 'EUR',
    appliedRules: AppliedRuleBreakdown[]
): { extraPrice: number } => {
    let extraPrice = 0;

    for (const extraRule of unitExtraRules) {
        try {
            const isExcludedForTooth = tooth.excludedRuleIds?.includes(extraRule.id);
            const isExcludedForJob = job.excludedRuleIds?.includes(extraRule.id);
            const isExtraExcluded = !!(isExcludedForTooth || isExcludedForJob);

            const isMatch = evaluateRuleMatch(context, extraRule);
            if (!isMatch) continue;

            const extraAmount = extraRule.action.value || 0;
            const extraCurrency = extraRule.action.currency || toothCurrency;

            if (extraCurrency !== toothCurrency) {
                console.warn(
                    `Unit extra rule '${extraRule.name}' skipped due to currency mismatch (${extraCurrency} vs ${toothCurrency}).`
                );
                continue;
            }

            if (!isExtraExcluded) {
                extraPrice += extraAmount;
            }
            appliedRules.push(buildRuleBreakdown(extraRule, extraAmount, toothCurrency, 'unitExtra', isExtraExcluded));
        } catch (e) {
            console.warn(`Error evaluating unit extra rule '${extraRule.name}':`, e);
        }
    }
    return { extraPrice };
};

/**
 * Evaluates `ignoreUnit` rules for a tooth. The first matching rule (in priority order) wins.
 * The returned tooth is marked `isIgnored: true` and clears all price fields.
 */
const evaluateIgnoreUnitRules = (
    context: ReturnType<typeof createToothContext>,
    ignoreUnitRules: TariffRule[],
    tooth: Tooth,
    job: Job
): { matchedRule: TariffRule | null; isExcluded: boolean } => {
    const matchedRule = ignoreUnitRules.find(rule => evaluateRuleMatch(context, rule)) || null;
    let isExcluded = false;
    if (matchedRule) {
        const isExcludedForTooth = tooth.excludedRuleIds?.includes(matchedRule.id);
        const isExcludedForJob = job.excludedRuleIds?.includes(matchedRule.id);
        isExcluded = !!(isExcludedForTooth || isExcludedForJob);
    }
    return { matchedRule, isExcluded };
};

interface ToothProcessStats {
    matched: boolean;
    ignored: boolean;
    price: number;
    basePrice: number;
    extraPrice: number;
    hasReview: boolean;
    hasInvalid: boolean;
}

const applyMatchedBaseRule = (
    matchedBaseRule: TariffRule,
    appliedRules: AppliedRuleBreakdown[],
    stats: ToothProcessStats
): { basePrice: number; toothStatus: 'Pending' | 'Calculated' | 'Review' | 'Invalid'; toothCurrency: 'HUF' | 'EUR' } => {
    const details = getBaseRuleActionDetails(matchedBaseRule);
    const basePrice = details.basePrice;
    const toothStatus = details.toothStatus;
    const toothCurrency = matchedBaseRule.action.currency || 'HUF';

    if (toothStatus === 'Invalid') stats.hasInvalid = true;
    if (toothStatus === 'Review') stats.hasReview = true;

    appliedRules.push(buildRuleBreakdown(matchedBaseRule, basePrice, toothCurrency, 'base'));
    stats.matched = true;

    return { basePrice, toothStatus, toothCurrency };
};

const buildInvoicedToothResult = (tooth: Tooth) => ({
    updatedTooth: tooth,
    stats: {
        matched: true,
        ignored: !!tooth.isIgnored,
        price: (tooth.price || 0),
        basePrice: (tooth.basePrice || tooth.price || 0),
        extraPrice: (tooth.extraPrice || 0),
        hasReview: false,
        hasInvalid: false
    }
});

const buildIgnoredToothResult = (tooth: Tooth, matchedRule: TariffRule): { updatedTooth: Tooth } => {
    const updatedTooth: Tooth = {
        ...tooth,
        status: 'Calculated',
        price: 0,
        basePrice: 0,
        extraPrice: 0,
        currency: 'HUF',
        appliedRuleId: matchedRule.id,
        appliedRuleName: matchedRule.name,
        appliedRuleLabel: matchedRule.label,
        appliedRulePriority: matchedRule.priority,
        appliedRules: [buildRuleBreakdown(matchedRule, 0, 'HUF', 'ignoreUnit')],
        isIgnored: true,
        ignoredByRuleId: matchedRule.id,
        ignoredByRuleName: matchedRule.name
    };
    return { updatedTooth };
};

const processTooth = (
    job: Job,
    tooth: Tooth,
    baseRules: TariffRule[],
    unitExtraRules: TariffRule[],
    ignoreUnitRules: TariffRule[],
    force: boolean = false
): {
    updatedTooth: Tooth;
    stats: ToothProcessStats;
} => {
    // Validate tooth structure
    if (!tooth || typeof tooth !== 'object') {
        throw new Error('Invalid tooth data in job');
    }

    const stats: ToothProcessStats = {
        matched: false,
        ignored: false,
        price: 0,
        basePrice: 0,
        extraPrice: 0,
        hasReview: false,
        hasInvalid: false
    };

    // Preserve Invoiced status (unless forced)
    if (!force && (tooth.status === 'Invoiced' || tooth.parentInvoiceId)) {
        return buildInvoicedToothResult(tooth);
    }

    const context = createToothContext(job, tooth);

    // Evaluate ignoreUnit rules first - they short-circuit the engine unless
    // the rule is excluded for this tooth. When excluded, the tooth stays
    // visible (isIgnored: false) and the rule's breakdown is recorded with
    // `isExcluded: true` so the expanded rule list can surface the exclusion.
    const { matchedRule: matchedIgnoreRule, isExcluded: ignoreExcluded } = evaluateIgnoreUnitRules(context, ignoreUnitRules, tooth, job);
    if (matchedIgnoreRule && !ignoreExcluded) {
        stats.matched = true;
        stats.ignored = true;
        return {
            updatedTooth: buildIgnoredToothResult(tooth, matchedIgnoreRule).updatedTooth,
            stats
        };
    }

    // If an `ignoreUnit` rule matches but is excluded for this tooth, fall
    // through to the normal base-rule flow. The rule's breakdown is recorded
    // as an `ignoreUnit` entry with `isExcluded: true` so the chevron
    // expansion can list it. We do NOT set isIgnored: true in this case;
    // the tooth is treated like any other visible tooth.
    const excludedIgnoreBreakdown: AppliedRuleBreakdown | null = matchedIgnoreRule && ignoreExcluded
        ? buildRuleBreakdown(matchedIgnoreRule, 0, 'HUF', 'ignoreUnit', true)
        : null;

    const { matchedBaseRule, appliedRules } = evaluateBaseRules(context, baseRules, tooth, job);

    let basePrice = 0;
    let toothStatus: 'Pending' | 'Calculated' | 'Review' | 'Invalid' = 'Pending';
    let toothCurrency: 'HUF' | 'EUR' = 'HUF';

    if (matchedBaseRule) {
        const applied = applyMatchedBaseRule(matchedBaseRule, appliedRules, stats);
        basePrice = applied.basePrice;
        toothStatus = applied.toothStatus;
        toothCurrency = applied.toothCurrency;
    }

    // Always evaluate unit extra rules regardless of whether base rules matched
    const result = evaluateExtraRules(context, unitExtraRules, tooth, job, toothCurrency, appliedRules);
    const extraPrice = result.extraPrice;

    // If an `ignoreUnit` rule matched but was excluded for this tooth, record
    // the breakdown so the chevron expansion can show the exclusion state.
    if (excludedIgnoreBreakdown) {
        appliedRules.push(excludedIgnoreBreakdown);
    }

    const toothPrice = toothStatus === 'Calculated' ? basePrice + extraPrice : 0;

    stats.price = toothPrice;
    stats.basePrice = basePrice;
    stats.extraPrice = extraPrice;

    return {
        updatedTooth: {
            ...tooth,
            status: toothStatus,
            price: toothPrice,
            basePrice,
            extraPrice,
            currency: toothCurrency,
            appliedRuleId: matchedBaseRule ? matchedBaseRule.id : undefined,
            appliedRuleName: matchedBaseRule ? matchedBaseRule.name : undefined,
            appliedRuleLabel: matchedBaseRule ? matchedBaseRule.label : undefined,
            appliedRulePriority: matchedBaseRule ? matchedBaseRule.priority : undefined,
            appliedRules,
            // Clear the ignore flag if it was set on a previous run but no longer matches
            isIgnored: false,
            ignoredByRuleId: undefined,
            ignoredByRuleName: undefined
        },
        stats
    };
};

const evaluateJobExtraRules = (
    jobExtraRules: TariffRule[],
    job: Job,
    appliedJobRules: AppliedRuleBreakdown[]
): { extraAmount: number } => {
    let extraAmount = 0;

    for (const jobExtraRule of jobExtraRules) {
        try {
            const isExcludedForJob = !!job.excludedRuleIds?.includes(jobExtraRule.id);

            // A `jobExtra` rule fires when at least one tooth in the job
            // matches all the rule's conditions. We therefore evaluate
            // against each tooth's per-unit context (which carries the
            // tooth-level material/type fields). This is what allows the
            // rule to express conditions like
            // `material ∈ {LowerJaw, UpperJaw} AND type == "3D Model"`.
            const anyToothMatches = job.teeth.some((tooth) => {
                const toothCtx = createToothContext(job, tooth);
                return evaluateRuleMatch(toothCtx, jobExtraRule);
            });
            if (!anyToothMatches) continue;

            const amount = jobExtraRule.action.value || 0;
            const currency = jobExtraRule.action.currency || 'HUF';

            if (!isExcludedForJob) {
                extraAmount += amount;
            }
            appliedJobRules.push(buildRuleBreakdown(jobExtraRule, amount, currency, 'jobExtra', isExcludedForJob));
        } catch (e) {
            console.warn(`Error evaluating job extra rule '${jobExtraRule.name}':`, e);
        }
    }
    return { extraAmount };
};

const determineJobCurrency = (updatedTeeth: Tooth[], appliedJobRules: AppliedRuleBreakdown[]): string => {
    const currencies = new Set<string>();
    updatedTeeth.forEach(tooth => {
        // Ignored units don't contribute to the job currency
        if (tooth.isIgnored) return;
        if (tooth.price && tooth.price > 0 && tooth.currency) {
            currencies.add(tooth.currency);
        }
    });
    appliedJobRules.forEach(rule => {
        if (rule.amount > 0) {
            currencies.add(rule.currency);
        }
    });

    if (currencies.size === 1) {
        return Array.from(currencies)[0] || 'HUF';
    } else if (currencies.size > 1) {
        return 'MIXED';
    }
    return 'HUF';
};

/**
 * Recomputes a job's `unitCount` from its teeth array, excluding any teeth flagged
 * `isIgnored: true`. Returns the count of billable units.
 */
const recomputeUnitCount = (teeth: Tooth[]): number => {
    return teeth.filter(t => !t.isIgnored).length;
};

/**
 * Applies a list of rules to a job to determine its price and status per tooth.
 * Rules are applied in order of priority.
 *
 * @param job The job to evaluate.
 * @param rules The list of active tariff rules.
 * @returns A new Job object with updated status and price, or null if validation fails
 */
export const calculateJobPrice = (job: Job, rules: TariffRule[], force: boolean = false): Job | null => {
    // Validate inputs
    if (!validateJob(job)) {
        console.error('Invalid job structure:', job);
        return null;
    }
    if (!Array.isArray(rules)) {
        console.error('Invalid rules: must be an array');
        return null;
    }

    // Validate all rules
    const invalidRules = rules.filter(rule => !validateRule(rule));
    if (invalidRules.length > 0) {
        console.warn('Some rules are invalid and will be skipped:', invalidRules.map(r => r?.id || 'unknown'));
    }

    // Filter out invalid rules and sort by priority (ascending: 1, 2, 3...)
    const sortedRules = rules.filter(validateRule).sort((a, b) => a.priority - b.priority);
    const baseRules = sortedRules.filter(rule => {
        const kind = getRuleKind(rule);
        return kind === 'base' || kind === 'invalid' || kind === 'review';
    });
    const unitExtraRules = sortedRules.filter(rule => getRuleKind(rule) === 'unitExtra');
    const jobExtraRules = sortedRules.filter(rule => getRuleKind(rule) === 'jobExtra');
    const ignoreUnitRules = sortedRules.filter(rule => getRuleKind(rule) === 'ignoreUnit');

    // If manually discarded or already fully invoiced, do not recalculate (unless forced)
    if (!force && (job.status === 'Discarded' || job.status === 'Invoiced')) {
        return job;
    }

    let totalJobPrice = 0;
    let totalBasePrice = 0;
    let totalExtraPrice = 0;
    let teethMatchedCount = 0;
    let hasReview = false;
    let hasInvalid = false;

    const updatedTeeth = job.teeth.map(tooth => {
        const { updatedTooth, stats } = processTooth(
            job,
            tooth,
            baseRules,
            unitExtraRules,
            ignoreUnitRules,
            force
        );

        // Ignored units don't count as matched for the pending-status calculation
        if (stats.matched && !stats.ignored) {
            teethMatchedCount++;
        }
        // Ignored units also don't contribute to the job's price
        if (!stats.ignored) {
            totalJobPrice += stats.price;
            totalBasePrice += stats.basePrice;
            totalExtraPrice += stats.extraPrice;
        }
        hasReview = hasReview || stats.hasReview;
        hasInvalid = hasInvalid || stats.hasInvalid;

        return updatedTooth;
    });

    // Recompute unitCount excluding ignored units, so they don't contribute to the
    // job's "Pending" status (i.e. a job with 1 ignored + 5 priced teeth behaves
    // like a job with 5 priced teeth, not 6).
    const billableUnitCount = recomputeUnitCount(updatedTeeth);
    const allBillableInvoiced = updatedTeeth
        .filter(t => !t.isIgnored)
        .every(t => t.status === 'Invoiced');

    const finalStatus = getFinalStatus(hasInvalid, hasReview, teethMatchedCount, billableUnitCount, allBillableInvoiced);

    const appliedJobRules: AppliedRuleBreakdown[] = [];
    const { extraAmount } = evaluateJobExtraRules(jobExtraRules, job, appliedJobRules);

    if (finalStatus === 'Calculated' || (force && (job.status === 'Invoiced'))) {
        totalExtraPrice += extraAmount;
        totalJobPrice += extraAmount;
    }

    const jobCurrency = determineJobCurrency(updatedTeeth, appliedJobRules);

    return {
        ...job,
        teeth: updatedTeeth,
        teethMatched: teethMatchedCount,
        unitCount: billableUnitCount,
        status: finalStatus,
        price: totalJobPrice,
        basePrice: totalBasePrice,
        extraPrice: totalExtraPrice,
        appliedJobRules,
        currency: jobCurrency
    };
};

const getFinalStatus = (hasInvalid: boolean, hasReview: boolean, teethMatchedCount: number, billableUnitCount: number, allInvoiced: boolean): 'Pending' | 'Calculated' | 'Review' | 'Invalid' | 'Discarded' | 'Invoiced' => {
    if (hasInvalid) return 'Invalid';
    if (hasReview) return 'Review';
    if (teethMatchedCount === billableUnitCount && billableUnitCount > 0) {
        return allInvoiced ? 'Invoiced' : 'Calculated';
    }
    return 'Pending';
};
