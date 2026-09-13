/**
 * @file JobFilter toolbar component.
 * Renders a search field, clear-filters button, column-manage button,
 * and a delete-selected button for the jobs data table.
 */

import React from 'react';
import { Button, TextField, Paper, InputAdornment, Box } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Search, Clear, ViewColumn, DeleteSweep } from '@mui/icons-material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './JobFilter-i11n.json';
import './JobFilter.css';

/**
 * Properties for the {@link JobFilter} component.
 *
 * @property inputValue     - Current search text displayed in the search field.
 * @property onSearchChange - Callback invoked when the user types in the search field.
 * @property onClearFilters - Callback invoked when the user clicks the clear-filters button.
 * @property isFiltered     - Whether at least one filter is active (enables the clear button).
 * @property onColumnMenuOpen - Callback invoked when the user clicks the columns button.
 * @property onDeleteSelected - Callback invoked when the user clicks the delete-selected button.
 * @property selectedCount  - Number of currently selected rows (enables the delete button).
 */
interface JobFilterProps {
    inputValue: string;
    onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onClearFilters: () => void;
    isFiltered: boolean;
    onColumnMenuOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onDeleteSelected: () => void;
    selectedCount: number;
}

/**
 * Shape of the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON JSON}
 * translation file (`JobFilter-i11n.json`).
 *
 * @property en - English key → translated-string map.
 * @property hu - Hungarian key → translated-string map.
 */
interface I18nType {
    en: Record<string, string>;
    hu: Record<string, string>;
}

/**
 * Toolbar component placed above the jobs data table.
 *
 * Renders a text-search input, a clear-filters button, a delete-selected
 * button (with count badge), and a column-visibility toggle button.
 * All user-facing strings are resolved through the active locale's
 * translation map.
 *
 * @param props - {@link JobFilterProps} injected by the parent.
 * @param props.inputValue - Current search text value.
 * @param props.onSearchChange - Change handler for the search field.
 * @param props.onClearFilters - Click handler to reset all active filters.
 * @param props.isFiltered - `true` when at least one filter is applied.
 * @param props.onColumnMenuOpen - Click handler to open the column-visibility menu.
 * @param props.onDeleteSelected - Click handler to delete the currently selected rows.
 * @param props.selectedCount - Number of rows that are currently selected.
 * @returns The rendered toolbar fragment.
 */
export const JobFilter: React.FC<JobFilterProps> = ({
    inputValue,
    onSearchChange,
    onClearFilters,
    isFiltered,
    onColumnMenuOpen,
    onDeleteSelected,
    selectedCount
}) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as I18nType)[language as 'en' | 'hu']?.[key] || key;

    return (
        <Paper variant="outlined" className="job-filter-paper">
            <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Box
                        display="flex"
                        gap={1}
                        width="100%"
                        flexWrap="wrap"
                        alignItems="stretch"
                    >
                        <TextField
                            size="small"
                            placeholder={localT('search')}
                            value={inputValue}
                            onChange={onSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            className="job-filter-search-field"
                        />
                        <ResponsiveTooltip title={localT('clearTooltip')}>
                            <span>
                                <Button 
                                    variant="outlined" 
                                    color="inherit" 
                                    onClick={onClearFilters}
                                    startIcon={<Clear />}
                                    disabled={!isFiltered}
                                    className="toolbar-button clear-button"
                                >
                                    {localT('clear')}
                                </Button>
                            </span>
                        </ResponsiveTooltip>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Box
                        className="actions-box"
                    >
                    <ResponsiveTooltip title={localT('deleteTooltip')}>
                        <span>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteSweep />}
                                onClick={onDeleteSelected}
                                disabled={selectedCount === 0}
                                className="toolbar-button"
                            >
                                {localT('delete')} ({selectedCount})
                            </Button>
                        </span>
                    </ResponsiveTooltip>
                    <ResponsiveTooltip title={localT('columnsTooltip')}>
                        <Button 
                            variant="outlined" 
                            color="inherit" 
                            onClick={onColumnMenuOpen}
                            startIcon={<ViewColumn />}
                            className="toolbar-button"
                        >
                            {localT('columns')}
                        </Button>
                    </ResponsiveTooltip>
                    </Box>
                </Grid>
            </Grid>
        </Paper>
    );
};
