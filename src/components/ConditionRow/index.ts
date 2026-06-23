/**
 * @file index.ts
 * Barrel module that re-exports the ConditionRow component and its
 * associated TypeScript interfaces for use throughout the application.
 */

/**
 * Re-exports the {@link ConditionRow} component and {@link ConditionRowProps}
 * interface from the ConditionRow module.
 *
 * @module ConditionRow
 * @export ConditionRow - A single condition row component used in the Rule
 *     Editor for defining logical conditions (field selector, operator
 *     selector, value input, and delete button).
 * @export ConditionRowProps - Props interface for the ConditionRow component.
 */
export * from './ConditionRow';
