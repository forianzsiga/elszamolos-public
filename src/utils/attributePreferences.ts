/**
 * @file attributePreferences.ts
 * @brief Per-user preferences for which attribute values should be hidden
 *        from the editor dropdowns. Backed by localStorage so the list
 *        persists across sessions on the same browser.
 *
 * The UI exposes a minus ( - ) button on every dropdown option. Clicking
 * it adds the value to the hidden list; clicking a plus ( + ) on a hidden
 * option restores it. Hidden options are rendered at the bottom of every
 * sort mode of the dropdown.
 */

const STORAGE_KEY_PREFIX = 'elszamolos:hidden-attrs:';

export type AttributeCategory = 'material' | 'type' | 'doctorName' | 'patientName';

const ALL_CATEGORIES: readonly AttributeCategory[] = ['material', 'type', 'doctorName', 'patientName'];

/**
 * Reads the hidden-attribute list for a category from localStorage.
 * Returns an empty array if no list is stored or if localStorage is
 * unavailable (e.g. SSR, private mode quota).
 *
 * @param category - The attribute category (material, type, etc.)
 * @returns Array of hidden values, in insertion order.
 */
export const getHiddenAttributes = (category: AttributeCategory): string[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_PREFIX + category);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v): v is string => typeof v === 'string');
    } catch {
        return [];
    }
};

/**
 * Persists the hidden-attribute list for a category to localStorage.
 * No-op if localStorage is unavailable.
 *
 * @param category - The attribute category.
 * @param values   - The full list of hidden values to persist.
 */
export const setHiddenAttributes = (category: AttributeCategory, values: string[]): void => {
    try {
        localStorage.setItem(STORAGE_KEY_PREFIX + category, JSON.stringify(values));
    } catch {
        // ignore quota / privacy mode errors
    }
};

/**
 * Adds a value to the hidden-attribute list for a category. No-op if
 * the value is already in the list.
 *
 * @param category - The attribute category.
 * @param value    - The value to hide.
 */
export const addHiddenAttribute = (category: AttributeCategory, value: string): void => {
    const current = getHiddenAttributes(category);
    if (current.includes(value)) return;
    setHiddenAttributes(category, [...current, value]);
};

/**
 * Removes a value from the hidden-attribute list for a category.
 * No-op if the value is not in the list.
 *
 * @param category - The attribute category.
 * @param value    - The value to restore.
 */
export const removeHiddenAttribute = (category: AttributeCategory, value: string): void => {
    const current = getHiddenAttributes(category);
    if (!current.includes(value)) return;
    setHiddenAttributes(category, current.filter(v => v !== value));
};

/**
 * Toggles a value's hidden state for a category. Returns the new state.
 *
 * @param category - The attribute category.
 * @param value    - The value to toggle.
 * @returns `true` if the value is now hidden, `false` if restored.
 */
export const toggleHiddenAttribute = (category: AttributeCategory, value: string): boolean => {
    const isHidden = getHiddenAttributes(category).includes(value);
    if (isHidden) {
        removeHiddenAttribute(category, value);
        return false;
    }
    addHiddenAttribute(category, value);
    return true;
};

/**
 * Returns all attribute categories. Useful for "Clear all hidden" UI.
 */
export const ALL_ATTRIBUTE_CATEGORIES = ALL_CATEGORIES;
