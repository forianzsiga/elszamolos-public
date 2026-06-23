/**
 * @file migrate-rule-kinds.ts
 * @brief Idempotent migration that converts legacy rule kinds to the new
 *        taxonomy introduced when `hide` / `hideAttribute` were replaced by
 *        `ignoreUnit` (and `toothExtra` was renamed to `unitExtra`).
 *
 * The migration runs on app boot via `runRuleKindMigration(db)`. It is safe
 * to run multiple times: rules already in the new shape are left untouched.
 *
 * Behavior:
 * - `kind: 'hide'`           → `kind: 'ignoreUnit'`
 * - `kind: 'hideAttribute'`  → rule is DELETED (the new manual hide UI replaces it)
 * - `kind: 'toothExtra'`     → `kind: 'unitExtra'`
 * - All other kinds          → no change
 */
import type { IDBPDatabase } from 'idb';
import type { TariffRule } from '../types';

/** Kind values that existed before the `ignoreUnit` refactor. */
const LEGACY_KINDS = new Set(['hide', 'hideAttribute', 'toothExtra']);

const isLegacyKind = (kind: TariffRule['kind'] | string | undefined): boolean => {
    return typeof kind === 'string' && LEGACY_KINDS.has(kind);
};

export interface MigrationResult {
    /** Number of rules that were converted from `hide` to `ignoreUnit`. */
    hideConverted: number;
    /** Number of rules deleted because they were `hideAttribute`. */
    hideAttributeDeleted: number;
    /** Number of rules that were renamed from `toothExtra` to `unitExtra`. */
    toothExtraRenamed: number;
    /** Total rules scanned. */
    totalScanned: number;
}

const hasTariffsStore = (db: IDBPDatabase<unknown>): boolean => {
    try {
        return Array.from((db as IDBPDatabase).objectStoreNames).includes('tariffs');
    } catch {
        return false;
    }
};

/**
 * Runs the rule-kind migration in place. Accepts any `idb` connection
 * regardless of the schema generic so it can be called from the App boot
 * path with the typed `IDBPDatabase<DentalDB>` instance.
 *
 * @param db - An open `idb` database connection.
 * @returns Summary of changes made.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runRuleKindMigration = async (db: IDBPDatabase<any>): Promise<MigrationResult> => {
    const result: MigrationResult = {
        hideConverted: 0,
        hideAttributeDeleted: 0,
        toothExtraRenamed: 0,
        totalScanned: 0
    };

    if (!hasTariffsStore(db)) {
        // The DB might not be at the expected version yet (e.g. fresh install
        // mid-upgrade). The caller should retry after `initDB()` completes.
        return result;
    }

    const tx = db.transaction('tariffs', 'readwrite');
    const store = tx.objectStore('tariffs');
    const allKeys = await store.getAllKeys();
    result.totalScanned = allKeys.length;

    for (const key of allKeys) {
        const rule = (await store.get(key)) as TariffRule | undefined;
        if (!rule) continue;
        // The persisted kind can be any of the legacy values (from data
        // created before the migration), so we widen the comparison to
        // a plain string check rather than relying on the typed union.
        const rawKind = rule.kind as string | undefined;
        if (!isLegacyKind(rawKind)) continue;

        if (rawKind === 'hideAttribute') {
            await store.delete(key);
            result.hideAttributeDeleted++;
        } else if (rawKind === 'hide') {
            rule.kind = 'ignoreUnit';
            await store.put(rule);
            result.hideConverted++;
        } else {
            // rawKind === 'toothExtra'
            rule.kind = 'unitExtra';
            await store.put(rule);
            result.toothExtraRenamed++;
        }
    }

    await tx.done;
    return result;
};
