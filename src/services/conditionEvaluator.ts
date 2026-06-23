/**
 * @file Evaluates tariff conditions and rule matches for the accounting system.
 * Provides the core logic to determine whether a given job/tooth context
 * satisfies one or more TariffCondition constraints.
 */

import type { Job, TariffRule, TariffCondition } from '../types';

/**
 * Type for the context used in condition evaluation.
 * Combines Job properties with tooth-specific overrides.
 */
export interface EvaluationContext extends Omit<Job, 'teeth'> {
    material: string;
    type: string;
    isScrewRetained?: boolean;
    number?: number;
    [key: string]: string | number | boolean | undefined | null | object;
}

/**
 * Evaluates a single condition against a context object (Job + Tooth).
 *
 * @param context  The evaluation context containing Job properties and tooth-specific fields.
 * @param condition  The tariff condition to test against the context.
 * @returns `true` if the condition is satisfied by the context, `false` otherwise.
 */
export const evaluateCondition = (context: EvaluationContext, condition: TariffCondition): boolean => {
    const value = context[condition.field];

    // Safety check for undefined values
    if (value === undefined || value === null) return false;

    // Handle boolean values (e.g. isScrewRetained)
    if (typeof value === 'boolean' || typeof condition.value === 'boolean') {
        if (condition.operator === 'equals') return value === condition.value;
        if (condition.operator === 'notEquals') return value !== condition.value;
        return false;
    }

    const stringValue = String(value).toLowerCase();
    const compareValue = String(condition.value).toLowerCase();

    switch (condition.operator) {
        case 'equals':
            return stringValue === compareValue;
        case 'notEquals':
            return stringValue !== compareValue;
        case 'contains':
            return stringValue.includes(compareValue);
        case 'notContains':
            return !stringValue.includes(compareValue);
        case 'greaterThan':
            return Number(value) > Number(condition.value);
        case 'lessThan':
            return Number(value) < Number(condition.value);
        case 'isOneOf':
            if (Array.isArray(condition.value)) {
                return condition.value.some(v => String(v).toLowerCase() === stringValue);
            }
            return false;
        case 'notOneOf':
            if (Array.isArray(condition.value)) {
                return !condition.value.some(v => String(v).toLowerCase() === stringValue);
            }
            return false;
        default:
            return false;
    }
};

/**
 * Evaluates whether all conditions of a rule are met.
 *
 * @param context  The evaluation context to test against every condition in the rule.
 * @param rule     The tariff rule whose conditions must all be satisfied.
 * @returns `true` if **every** condition in the rule evaluates to `true`, `false` otherwise.
 */
export const evaluateRuleMatch = (context: EvaluationContext, rule: TariffRule): boolean => {
    return rule.conditions.every(condition => evaluateCondition(context, condition));
};
