/**
 * @file index.ts
 * @description Barrel module for the JobEditModal feature. Re-exports the
 *              {@link JobEditModal} component used to view, edit, create, and
 *              duplicate dental job records.
 */

/**
 * JobEditModal — Modal dialog for creating, editing, or duplicating a dental job.
 *
 * Provides form fields for job metadata (date, patient, doctor), a teeth table
 * for managing dental units, a dental chart visualizer, a 3D model viewer section,
 * a notes field, and optional developer debug information.
 *
 * @see {@link import('./JobEditModal').JobEditModal} for full prop definitions.
 */
export * from './JobEditModal';
