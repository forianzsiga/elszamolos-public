/**
 * @file useListState.ts
 * Generic hook that persists a list component's ephemeral UI state
 * (such as expanded rows, scroll position) to `localStorage`, so that
 * the state survives unmount and page navigations.
 *
 * The hook returns a tuple similar to {@link React.useState} but the
 * setter accepts a {@link Partial} update that is shallow-merged into
 * the previous value and synchronously written to `localStorage`.
 *
 * Reads and writes are wrapped in `try/catch` so that a malformed
 * persisted value, full storage quota, or a disabled `localStorage`
 * (e.g. private mode) do not crash the application.
 */

import React from 'react';

const STORAGE_PREFIX = 'elszamolos_listState_';

/**
 * Try to read a previously persisted state object from `localStorage`.
 *
 * @param key - The hook-specific storage key (without prefix).
 * @returns The parsed state, or `null` if nothing usable was found.
 */
const readFromStorage = <T,>(key: string): T | null => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
        if (raw == null) {
            return null;
        }
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed as T;
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Persist the given state object to `localStorage`. Failures are
 * silently ignored so a quota error or unavailable storage does not
 * break the component.
 *
 * @param key - The hook-specific storage key (without prefix).
 * @param value - The state object to serialise.
 */
const writeToStorage = <T,>(key: string, value: T): void => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
        // Quota exceeded, disabled storage, or serialisation failure.
        // Ignore — persistence is a best-effort enhancement.
    }
};

/**
 * Persisted list state hook.
 *
 * On first render the hook returns the stored state when available,
 * otherwise the supplied `defaults`. The returned setter accepts a
 * {@link Partial} patch that is merged with the current state and
 * persisted to `localStorage` synchronously.
 *
 * @typeParam T - Shape of the persisted state object.
 * @param key - Unique key identifying this list's persisted state.
 * @param defaults - Default state used when nothing is stored yet.
 * @returns A `[state, setState]` tuple. `setState` shallow-merges the
 *          provided patch into the current state and writes it to
 *          `localStorage`.
 */
export function useListState<T extends object>(
    key: string,
    defaults: T
): [T, (update: Partial<T>) => void] {
    const [state, setState] = React.useState<T>(() => {
        const stored = readFromStorage<T>(key);
        if (stored == null) {
            return defaults;
        }
        // Merge with defaults so newly added state keys get sensible
        // values when the persisted payload was written by an older
        // version of the application.
        return { ...defaults, ...stored };
    });

    const setListState = React.useCallback((update: Partial<T>): void => {
        setState(prev => {
            const next = { ...prev, ...update };
            writeToStorage(key, next);
            return next;
        });
    }, [key]);

    return [state, setListState];
}
