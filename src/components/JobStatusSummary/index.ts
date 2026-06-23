/**
 * @file
 * Barrel module that re-exports all public API from the JobStatusSummary submodule.
 *
 * The main export is the {@link JobStatusSummary} component — a memoized React
 * component that aggregates an array of jobs by their status values and renders a
 * horizontal bar of status summary items, each with an icon, label, count, and
 * tooltip.
 *
 * @module JobStatusSummary
 */

export * from './JobStatusSummary';
