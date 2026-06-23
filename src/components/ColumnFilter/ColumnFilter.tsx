/**
 * @file ColumnFilter.tsx
 * Renders a column filter popover for data tables. Displays a filter icon button
 * that opens a menu with a search field and a list of checkboxes to toggle
 * individual values on/off.
 */

import { useState, useMemo } from 'react';
import { IconButton, Menu, MenuItem, Checkbox, ListItemText, Box, TextField, InputAdornment } from '@mui/material';
import { FilterList, FilterListOff, Search } from '@mui/icons-material';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './ColumnFilter-i11n.json';
import './ColumnFilter.css';

/** Props for the {@link ColumnFilter} component. */
interface ColumnFilterProps {
    /** The name of the field (column key) to extract values from each row. */
    field: string;
    /** The full array of row data objects from which unique values are derived. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: any[];
    /** Currently selected (checked) values for this column filter. */
    selectedValues: string[];
    /** Callback invoked with the updated array of selected values when the user toggles a checkbox. */
    onFilterChange: (values: string[]) => void;
    /**
     * Optional formatter to transform raw cell values before display and
     * comparison (e.g. formatting a number as a currency string).
     */
    formatter?: (val: unknown) => string;
    /**
     * Optional pre-computed list of filter options. When provided,
     * the component uses this list instead of deriving values from `rows`.
     */
    options?: string[];
}

/**
 * Column-level filter component for data tables.
 *
 * Renders an icon button that opens a popover menu containing a search field
 * and a scrollable list of unique column values with checkboxes. The user can
 * check/uncheck values to filter the table rows. Selected values are sorted to
 * the top of the list.
 *
 * @param props - Component props.
 * @param props.field - Column field name used to read values from each row.
 * @param props.rows - Full row data array; used to derive the set of unique filterable values.
 * @param props.selectedValues - Currently active filter values (checked items).
 * @param props.onFilterChange - Callback fired with the updated selection array when a checkbox is toggled.
 * @param props.formatter - Optional function to format raw cell values before display/comparison.
 * @param props.options - Optional pre-computed list of filter options (skips deriving from `rows`).
 * @returns A React element containing the filter button and the dropdown menu.
 */
export const ColumnFilter = ({ field, rows, selectedValues = [], onFilterChange, formatter, options }: ColumnFilterProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language]?.[key] || key;
    
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Extract unique values
    const uniqueValues = useMemo(() => {
        if (options) return options; // Use pre-calculated options if available

        const values = new Set<string>();
        rows.forEach(r => {
            let val = r[field];
            if (formatter) val = formatter(val);
            if (val !== undefined && val !== null) values.add(String(val));
        });
        return Array.from(values).sort();
    }, [rows, field, formatter, options]);

    // Filter options based on internal search and sort selected to top
    const displayedValues = useMemo(() => {
        let values = uniqueValues;
        if (searchTerm) {
            values = values.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        
        return [...values].sort((a, b) => {
            const aSelected = selectedValues.includes(a);
            const bSelected = selectedValues.includes(b);
            
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return 0; // Preserve existing sort order (alphabetical)
        });
    }, [uniqueValues, searchTerm, selectedValues]);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation(); // Prevent sorting trigger on header click
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
        setSearchTerm(''); // Reset search on close
    };

    const handleToggle = (value: string) => {
        const currentIndex = selectedValues.indexOf(value);
        const newChecked = [...selectedValues];

        if (currentIndex === -1) {
            newChecked.push(value);
        } else {
            newChecked.splice(currentIndex, 1);
        }
        onFilterChange(newChecked);
    };

    const isActive = selectedValues.length > 0;

    return (
        <>
            <ResponsiveTooltip title={localT('filterMenu')}>
                <IconButton size="small" onClick={handleClick}>
                    {isActive ? (
                        <FilterList fontSize="small" color="primary" />
                    ) : (
                        <FilterListOff fontSize="small" className="column-filter-icon-disabled" />
                    )}
                </IconButton>
            </ResponsiveTooltip>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                className="column-filter-menu-paper"
                MenuListProps={{ className: "column-filter-menu-list" }}
            >
                <Box className="column-filter-search-box">
                    <ResponsiveTooltip title={localT('searchField')}>
                        <TextField
                            size="small"
                            fullWidth
                            placeholder={localT('search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            variant="outlined"
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search fontSize="small" />
                                        </InputAdornment>
                                    ),
                                }
                            }}
                            onKeyDown={(e) => e.stopPropagation()} 
                            onClick={(e) => e.stopPropagation()}
                        />
                    </ResponsiveTooltip>
                </Box>
                {displayedValues.length === 0 ? (
                    <ResponsiveTooltip title={localT('noMatches')}>
                        <MenuItem disabled><ListItemText primary={localT('noMatches')} /></MenuItem>
                    </ResponsiveTooltip>
                ) : (
                    displayedValues.map((value, index) => (
                        <ResponsiveTooltip key={`${value}-${index}`} title={localT('toggleFilter')}>
                            <MenuItem onClick={() => handleToggle(value)} dense>
                                <Checkbox checked={selectedValues.indexOf(value) > -1} size="small" />
                                <ListItemText primary={value} />
                            </MenuItem>
                        </ResponsiveTooltip>
                    ))
                )}
            </Menu>
        </>
    );
};
