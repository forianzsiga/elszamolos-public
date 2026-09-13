/**
 * @file attributeFilter.ts
 * @brief Utilities for partitioning attribute lists into "visible" and
 *        "user-hidden" segments. Hidden values come from per-user
 *        preferences (localStorage), not from tariff rules.
 *
 * This replaces the previous `hideAttribute` rule mechanism, which was
 * removed in favor of an in-UI minus button on each dropdown option.
 */

import {
    getHiddenAttributes,
    type AttributeCategory
} from './attributePreferences';

export type AttributeField = AttributeCategory;

/**
 * Partitions a list of attribute values into non-hidden (suggestions) and
 * user-hidden values. Returns the merged list (non-hidden first, then
 * hidden) and a Set of hidden values.
 *
 * @param values - The original metadata array.
 * @param field  - The attribute category to look up the hidden list for.
 * @returns An object containing `ordered` (visible-first) array and `hidden` Set.
 */
export const partitionAttributes = (
    values: string[],
    field: AttributeField
): { ordered: string[]; hidden: Set<string> } => {
    const hiddenList = new Set(getHiddenAttributes(field));

    if (hiddenList.size === 0) {
        return { ordered: values, hidden: hiddenList };
    }

    const nonHidden: string[] = [];
    const hiddenSeen: string[] = [];

    for (const val of values) {
        if (hiddenList.has(val)) {
            hiddenSeen.push(val);
        } else {
            nonHidden.push(val);
        }
    }

    // Also include any hidden values that aren't in the input (e.g. the user
    // hid a value that was later removed from the metadata). The hidden
    // section is sorted alphabetically to be predictable.
    const extraHidden = Array.from(hiddenList).filter(v => !hiddenSeen.includes(v));
    const hiddenOrdered = [...hiddenSeen, ...extraHidden].sort();

    return {
        ordered: [...nonHidden, ...hiddenOrdered],
        hidden: hiddenList
    };
};

/**
 * @deprecated Kept for API compatibility. The hidden-attribute list now
 * comes from per-user preferences (localStorage), not from tariff rules.
 * Use `partitionAttributes(values, field)` instead.
 */
export const filterAttributes = (
    values: string[],
    field: AttributeField
): string[] => {
    return partitionAttributes(values, field).ordered;
};
