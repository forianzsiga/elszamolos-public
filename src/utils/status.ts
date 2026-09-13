/** @file Utility functions for mapping JobStatus values to colors and human-readable labels. */

import type { JobStatus } from '../types';

/** MUI color palette values used to render status chips, badges, and icons. */
export type StatusColor = "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";

/**
 * Returns the color associated with a specific JobStatus.
 * Used for Chips, Badges, and Icons.
 *
 * @param status - The job status value.
 * @returns The MUI color key corresponding to the given status.
 */
export const getStatusColor = (status: JobStatus | string): StatusColor => {
    switch (status) {
        case 'Calculated': return 'success';
        case 'Review': return 'warning';
        case 'Invalid': return 'error';
        case 'Discarded': return 'error';
        case 'Invoiced': return 'info';
        case 'Manual': return 'secondary';
        default: return 'default';
    }
};

/**
 * Returns a human-readable label for a status.
 *
 * @param status - The job status value.
 * @returns A human-friendly label string (e.g. "Ignored" for "Discarded").
 */
export const getStatusLabel = (status: JobStatus | string): string => {
    if (status === 'Discarded') return 'Ignored';
    if (status === 'Manual') return 'Manual Entry';
    return status;
};
