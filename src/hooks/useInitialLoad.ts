/**
 * @file Custom hook for loading initial data from IndexedDB into the application state.
 *       Should be invoked once at the root level or in the main layout component.
 */

import { useEffect } from 'react';
import { useJobs } from '../context/JobContext';
import { useTariffs } from '../context/TariffContext';
import { dbService } from '../services/db';
import { ensureJobTeethIds } from '../utils/teethTableUtils';

/**
 * Custom hook to load initial data from IndexedDB into the application state.
 * Should be called once at the root level or in the main layout.
 *
 * @returns {void}
 */
export const useInitialLoad = () => {
    const { dispatch: jobDispatch } = useJobs();
    const { dispatch: tariffDispatch } = useTariffs();

    useEffect(() => {
        const loadData = async () => {
            try {
                jobDispatch({ type: 'SET_LOADING', payload: true });
                
                // Load Jobs
                let jobs = await dbService.getAllJobs();

                // Data migration: backfill stable tooth IDs for any teeth missing an id.
                // This ensures that every tooth has a unique, stable identifier regardless
                // of whether it was created by the file scanner, imported via JSON, or
                // added manually through the UI.
                let anyMigrated = false;
                const migratedJobs = jobs.map(job => {
                    const m = ensureJobTeethIds(job);
                    if (m !== job) anyMigrated = true;
                    return m;
                });
                if (anyMigrated) {
                    await dbService.updateJobs(migratedJobs);
                    jobs = migratedJobs;
                }

                jobDispatch({ type: 'SET_JOBS', payload: jobs });

                // Reconcile any jobs that reference invoices which are missing
                // This fixes the scenario where data moved to another machine
                // left jobs marked as Invoiced but the Invoice record is absent.
                const reconciled = await dbService.reconcileOrphanedInvoicedJobs();
                if (reconciled && reconciled.length > 0) {
                    // Reload jobs after reconciliation to update in-memory state
                    const refreshed = await dbService.getAllJobs();
                    jobDispatch({ type: 'SET_JOBS', payload: refreshed });
                }

                // Load Tariffs
                const dbRules = await dbService.getAllRules();
                tariffDispatch({ type: 'SET_RULES', payload: dbRules });

            } catch (error) {
                console.error('Failed to load initial data', error);
                jobDispatch({ type: 'SET_ERROR', payload: 'Failed to load data from database.' });
            }
        };

        loadData();
    }, [jobDispatch, tariffDispatch]);
};
