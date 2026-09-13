/**
 * @file GridCell.tsx
 * A reusable cell component for grid-based tables within the elszamolos application.
 * Provides standardized padding, alignment, border logic, and optional measurement tracking.
 */

import { Box, type SxProps, type Theme } from '@mui/material';
import i11n from './GridCell-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import './GridCell.css';

/**
 * Props for the GridCell component.
 */
interface GridCellProps {
    /** The column ID for measurement tracking */
    colId?: string;
    /** Content to render */
    children: React.ReactNode;
    /** Horizontal alignment */
    align?: 'left' | 'right' | 'center';
    /** Whether to remove the right border (last column) */
    noBorder?: boolean;
    /** Optional additional SX props */
    sx?: SxProps<Theme>;
    /** Whether to wrap the content in a measurement Box */
    measure?: boolean;
}

/**
 * A reusable cell component for Grid-based tables.
 * Standardizes padding, alignment, and border logic.
 *
 * @param props - Component props.
 * @param props.colId - The column ID for measurement tracking.
 * @param props.children - Content to render inside the cell.
 * @param props.align - Horizontal alignment of the cell content.
 * @param props.noBorder - Whether to remove the right border (last column).
 * @param props.sx - Optional additional MUI SX styling props.
 * @param props.measure - Whether to enable measurement tracking on this cell.
 * @returns A styled grid cell element wrapping the provided children.
 */
export const GridCell = ({ 
    colId, 
    children, 
    align = 'left', 
    noBorder = false, 
    measure = true
}: GridCellProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
    if (false as boolean) {
        localT('');
    }

    return (
        <div 
            className={`grid-cell-container align-${align} ${noBorder ? 'no-border' : ''}`}
        >
            <Box 
                data-vdt-measure-col={measure ? colId : undefined}
                className="grid-cell-content"
            >
                {children}
            </Box>
        </div>
    );
};
