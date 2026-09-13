/** @file JobTeethTableNotes/index.ts
 *  @brief Barrel export for the JobTeethTableNotes component.
 *
 *  Re-exports the default JobTeethTableNotes component under a named
 *  export for convenient, directory-based imports.
 */

/**
 * JobTeethTableNotes component.
 *
 * Displays a labelled note block for a tooth entry in the job teeth
 * table.  Accepts a `notes` prop containing the note text to render.
 *
 * @see {@link ./JobTeethTableNotes.tsx} for the full implementation.
 */
export { default as JobTeethTableNotes } from './JobTeethTableNotes';
