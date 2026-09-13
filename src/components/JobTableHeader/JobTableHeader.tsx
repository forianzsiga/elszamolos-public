/** @file JobTableHeader.tsx
 *  @brief Renders a single column header cell for the job table.
 */

import React from 'react';
import './JobTableHeader.css';

/** Properties for the {@link JobTableHeader} component. */
interface JobTableHeaderProps {
    /** Fixed width in pixels for this header cell. */
    width: number;
    /** Display text for the column header. */
    label: string;
}

/**
 * Extracted renderer for the right-most actions column header.
 * This keeps the style details out of JobTable while preserving behavior.
 *
 * @param props - Component properties.
 * @param props.width - Pixel width to apply to this header cell.
 * @param props.label - Text label to display inside the header.
 * @returns A styled header cell `<div>` element.
 */
export const JobTableHeader: React.FC<JobTableHeaderProps> = ({ width, label }) => {
    return (
        <div
            className={`job-table-header width-${width}`}
        >
            {label}
        </div>
    );
};

export default JobTableHeader;
