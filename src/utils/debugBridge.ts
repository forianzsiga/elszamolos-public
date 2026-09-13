/** @file Debug bridge for development and testing. Exposes a global {@code __DEBUG_BRIDGE__} object on the window to allow LLMs, automated agents, and developers to inspect, modify, and test the application state directly via the browser console. */
import { dbService, initDB } from '../services/db';
import { calculateJobPrice } from '../services/pricingEngine';

/**
 * Exposes a global debugging bridge on the window object when in development or developer mode.
 * This allows LLMs, automated agents, and developers to inspect, modify, and test the application state directly.
 */
export const initDebugBridge = () => {
    if (import.meta.env.DEV || localStorage.getItem('developerMode') === 'true') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__DEBUG_BRIDGE__ = {
            // --- Database Inspection & Manipulation ---
            /** Retrieve all jobs from the database. */
            getJobs: async () => await dbService.getAllJobs(),
            /** Retrieve all pricing rules from the database. */
            getRules: async () => await dbService.getAllRules(),
            /** Retrieve all invoices from the database. */
            getInvoices: async () => await dbService.getAllInvoices(),
            /** Retrieve all application logs from the database. */
            getLogs: async () => await dbService.getAllLogs(),
            
            /**
             * Inject an array of jobs into the database, then reload the page.
             * @param jobs - Array of job objects to insert.
             * @returns A promise that resolves once all jobs have been inserted and the page has reloaded.
             */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            injectJobs: async (jobs: any[]) => {
                for (const job of jobs) {
                    await dbService.addJob(job);
                }
                console.log(`Successfully injected ${jobs.length} jobs.`);
                window.location.reload();
            },
            
            /**
             * Inject an array of pricing rules into the database, then reload the page.
             * @param rules - Array of rule objects to insert.
             * @returns A promise that resolves once all rules have been inserted and the page has reloaded.
             */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            injectRules: async (rules: any[]) => {
                for (const rule of rules) {
                    await dbService.addRule(rule);
                }
                console.log(`Successfully injected ${rules.length} rules.`);
                window.location.reload();
            },

            /**
             * Restore a complete backup of all database stores.
             * Clears existing data in 'jobs', 'tariffs', and 'invoices' stores, then re-inserts the provided backup data and reloads the page.
             * @param backupData - Object containing optional arrays of jobs, rules, invoices, and metadata (materials and types).
             * @returns A promise that resolves once the backup has been fully restored and the page has reloaded.
             */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            restoreFullBackup: async (backupData: { jobs?: any[], rules?: any[], invoices?: any[], metadata?: { materials?: string[], types?: string[] } }) => {
                const db = await initDB();
                
                // Clear existing stores
                await db.clear('jobs');
                await db.clear('tariffs');
                await db.clear('invoices');
                
                // Restore Jobs
                if (backupData.jobs) {
                    for (const job of backupData.jobs) {
                        await dbService.addJob(job);
                    }
                }
                
                // Restore Rules
                if (backupData.rules) {
                    for (const rule of backupData.rules) {
                        await dbService.addRule(rule);
                    }
                }
                
                // Restore Invoices
                if (backupData.invoices) {
                    for (const invoice of backupData.invoices) {
                        await dbService.addInvoice(invoice);
                    }
                }

                // Restore Metadata
                if (backupData.metadata) {
                    if (backupData.metadata.materials) {
                        await dbService.addMetadata('materials', backupData.metadata.materials);
                    }
                    if (backupData.metadata.types) {
                        await dbService.addMetadata('types', backupData.metadata.types);
                    }
                }
                
                console.log("Full backup successfully restored via debug bridge.");
                window.location.reload();
            },
            
            /**
             * Clear all data from every IndexedDB store after prompting the user for confirmation.
             * @returns A promise that resolves once all stores have been cleared and the page has reloaded.
             */
            clearAllData: async () => {
                if (window.confirm("Are you sure you want to clear all IndexedDB data?")) {
                    const db = await initDB();
                    await db.clear('jobs');
                    await db.clear('tariffs');
                    await db.clear('invoices');
                    await db.clear('logs');
                    console.log("All IndexedDB stores cleared.");
                    window.location.reload();
                }
            },

            // --- Pricing Engine Debugging ---
            /**
             * Run a dry test of the pricing engine against all stored jobs and rules.
             * Logs a comparison table to the console showing original vs. calculated prices.
             * @returns A promise that resolves to an array of pricing comparison results for each job.
             */
            testPricingEngine: async () => {
                const jobs = await dbService.getAllJobs();
                const rules = await dbService.getAllRules();
                console.log(`Testing pricing engine on ${jobs.length} jobs with ${rules.length} rules...`);
                
                const results = jobs.map(job => {
                    const calculated = calculateJobPrice(job, rules);
                    return {
                        id: job.id,
                        patientName: job.patientName,
                        originalPrice: job.price,
                        calculatedPrice: calculated ? calculated.price : null,
                        status: calculated ? calculated.status : 'Error',
                        teethMatched: calculated ? calculated.teethMatched : 0
                    };
                });
                
                console.table(results);
                return results;
            },

            /**
             * Compare "Force Import" vs. "Checked Import" pricing results for all jobs.
             * Logs any price or status discrepancies found and returns a summary object.
             * @returns A promise that resolves to an object containing the total number of jobs checked,
             *          the count of discrepancies, and the full list of discrepancy details.
             */
            compareImportMethods: async () => {
                const jobs = await dbService.getAllJobs();
                const rules = await dbService.getAllRules();
                console.log(`Comparing Force Import vs Checked Import on ${jobs.length} jobs...`);

                const discrepancies = [];

                for (const job of jobs) {
                    // Dry-run the pricing engine on the job
                    const calculated = calculateJobPrice(job, rules);

                    if (!calculated) {
                        discrepancies.push({
                            id: job.id,
                            patientName: job.patientName,
                            forceImportPrice: job.price,
                            checkedImportPrice: null,
                            forceImportStatus: job.status,
                            checkedImportStatus: 'Error',
                            priceDifference: job.price || 0
                        });
                        continue;
                    }

                    // Compare price and status
                    const priceDiff = Math.abs((job.price || 0) - (calculated.price || 0));
                    const statusMismatch = job.status !== calculated.status;

                    if (priceDiff > 0 || statusMismatch) {
                        discrepancies.push({
                            id: job.id,
                            patientName: job.patientName,
                            forceImportPrice: job.price,
                            checkedImportPrice: calculated.price,
                            forceImportStatus: job.status,
                            checkedImportStatus: calculated.status,
                            priceDifference: priceDiff
                        });
                    }
                }

                if (discrepancies.length === 0) {
                    console.log("✅ Parity Check Passed! Force Import and Checked Import yield identical results for all jobs.");
                } else {
                    console.warn(`⚠️ Parity Check Failed! Found ${discrepancies.length} discrepancies.`);
                    console.table(discrepancies);
                }

                return {
                    totalJobsChecked: jobs.length,
                    discrepanciesCount: discrepancies.length,
                    discrepancies
                };
            },

            // --- State & Environment Info ---
            /**
             * Retrieve current application and environment information.
             * @returns An object containing the app version, environment mode, developer mode flag,
             *          active language, user agent, and screen resolution.
             */
            getAppInfo: () => {
                return {
                    version: "1.0.0",
                    environment: import.meta.env.MODE,
                    developerMode: localStorage.getItem('developerMode') === 'true',
                    language: localStorage.getItem('language') || 'hu',
                    userAgent: navigator.userAgent,
                    screenResolution: `${window.innerWidth}x${window.innerHeight}`
                };
            }
        };
        console.log("🚀 __DEBUG_BRIDGE__ successfully initialized on window object.");
    }
};
