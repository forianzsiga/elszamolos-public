/** @file CustomColumnHeader.tsx
 *  Custom column header component for the data grid that provides sort and filter functionality.
 *  Renders a column header with a sort button and a column filter dropdown, supporting
 *  multi-language labels via an i11n JSON translation sheet.
 */

import { 
    Box, Typography, IconButton
} from '@mui/material';
import { 
    ArrowUpward, ArrowDownward, Sort
} from '@mui/icons-material';
import { useGridApiContext, useGridSelector, gridSortModelSelector } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { ColumnFilter } from '../ColumnFilter';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './CustomColumnHeader-i11n.json';
import type { Job } from '../../types';
import './CustomColumnHeader.css';


/** Properties for the CustomColumnHeader component. */
interface CustomColumnHeaderProps {
    /** The column definition object from MUI X Data Grid. */
    colDef: GridColDef;
    /** The field name this column header corresponds to. */
    field: string;
    /** The full row dataset used by the column filter. */
    rows: Job[];
    /** Available filter options for the column. */
    options: string[];
    /** Currently selected filter values. */
    selectedValues: string[];
    /** Callback invoked when the selected filter values change. */
    onFilterChange: (values: string[]) => void;
}

/** Custom column header component with sort and filter controls.
 *  Renders the column display name (clickable to sort), a sort-direction icon button,
 *  and a column filter dropdown. Supports both ascending and descending sort, as well
 *  as clearing the sort entirely (third click cycles back to unsorted).
 * @param props - Component properties.
 * @param props.colDef - The column definition from MUI X Data Grid.
 * @param props.field - The field name associated with this column.
 * @param props.rows - The full dataset rows used for filter value enumeration.
 * @param props.options - Available filter options for the column.
 * @param props.selectedValues - Currently active filter selections.
 * @param props.onFilterChange - Callback fired when filter values change.
 * @returns A React element containing the column header with sort icon and filter. */
export const CustomColumnHeader = ({ 
    colDef, 
    field, 
    rows, 
    options, 
    selectedValues, 
    onFilterChange 
}: CustomColumnHeaderProps) => {
    const { language } = useLanguage();
    const localT = (key: keyof typeof i11n.en) => i11n[language as 'en' | 'hu']?.[key] || key;
    const apiRef = useGridApiContext();
    const sortModel = useGridSelector(apiRef, gridSortModelSelector);
    const sortItem = sortModel.find(item => item.field === field);
    const isSorted = !!sortItem;
    const sortDirection = sortItem?.sort;
    
    /** Cycles the column sort state through asc → desc → unsorted.
     *  Reads the current sort direction from the Data Grid sort model and
     *  sets the next sort direction on the API ref.
     * @returns void */
    const handleSort = () => {
        let nextSort: 'asc' | 'desc' | null = 'asc';
        if (sortDirection === 'asc') {
            nextSort = 'desc';
        } else if (sortDirection === 'desc') {
            nextSort = null;
        }
        apiRef.current.setSortModel(nextSort ? [{ field, sort: nextSort }] : []);
    };

    /** Returns the appropriate sort icon based on the current sort state.
     *  Shows a muted default sort icon when unsorted, an upward arrow for
     *  ascending, and a downward arrow for descending.
     * @returns A MUI icon element representing the current sort direction. */
    const getSortIcon = () => {
        if (!isSorted) {
            return <Sort fontSize="small" className="sort-icon-disabled" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUpward fontSize="small" color="primary" />
        ) : (
            <ArrowDownward fontSize="small" color="primary" />
        );
    };

    return (
        <Box className="custom-column-header-container">
            <Box className="custom-column-header-content">
                <ResponsiveTooltip title={localT('clickToSort')}>
                    <Typography 
                        variant="body2" 
                        fontWeight="bold" 
                        noWrap 
                        className="custom-column-header-text"
                        onClick={handleSort}
                    >
                        {colDef.headerName}
                    </Typography>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('sortButton')}>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSort();
                        }}
                        className="custom-column-header-icon-button"
                    >
                        {getSortIcon()}
                    </IconButton>
                </ResponsiveTooltip>
            </Box>
            <ResponsiveTooltip title={localT('filterContainer')}>
                <Box onClick={(e) => e.stopPropagation()}>
                    <ColumnFilter 
                        field={field} 
                        rows={rows} 
                        options={options}
                        selectedValues={selectedValues} 
                        onFilterChange={onFilterChange}
                    />
                </Box>
            </ResponsiveTooltip>
        </Box>
    );
};
