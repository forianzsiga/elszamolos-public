/**
 * @file LogsPage.tsx
 * @description Page component for displaying and managing application logs.
 * Provides filtering, sorting, column visibility controls, and the ability
 * to clear or copy log entries.
 */

import {
    Box, Typography, Paper, TextField, InputAdornment, Button, Alert
} from '@mui/material';
import { Search, DeleteSweep, FilterList, ViewColumn } from '@mui/icons-material';
import { useLogs } from '../../context/LogContext';
import { LogTable } from '../../components/LogTable';
import { useLogManager } from '../../hooks/useLogManager';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../../components/ResponsiveTooltip';
import i11n from './LogsPage-i11n.json';
import './LogsPage.css';

/**
 * LogsPage component – the main page for viewing and managing application logs.
 *
 * Renders a header with a clear-all button, a filter bar with search and
 * column-visibility controls, an optional active-filter alert, and a
 * LogTable displaying the sorted/filtered log entries.
 *
 * @returns The rendered LogsPage layout.
 */
export const LogsPage = () => {
    const { state, clearLogs } = useLogs();
    const { language } = useLanguage();
    
    const typedI11n = i11n as Record<'en' | 'hu', Record<string, string>>;
    const localT = (key: string) => {
        const lang = language === 'debug' ? 'en' : language;
        return typedI11n[lang as 'en' | 'hu']?.[key] || key;
    };

    const {
        columnWidths,
        sortConfig,
        visibleColumns,
        columnMenuAnchor,
        inputValue,
        columnFilters,
        dateFilter,
        filterOptions,
        filteredLogs,
        sortedLogs,
        handleSearchChange,
        handleSort,
        handleClearFilters,
        handleColumnFilterChange,
        handleColumnMenuOpen,
        handleColumnMenuClose,
        handleColumnToggle,
        handleColumnResize,
        setDateFilter,
    } = useLogManager(state.logs);

    const handleCopy = (log: { timestamp: string; severity: string; message: string; details?: string }) => {
        let text = `${log.timestamp} [${log.severity.toUpperCase()}]: ${log.message}`;
        if (log.details) {
            text += `\n${localT('details')} ${log.details}`;
        }
        navigator.clipboard.writeText(text);
    };

    const isFiltered = state.logs.length !== filteredLogs.length;

    return (
        <Box className="logs-page-container">
            <Box className="logs-page-header">
                <Typography variant="h4">{localT('pageTitle')}</Typography>
                <ResponsiveTooltip title={localT('clearTooltip')}>
                    <Button 
                        variant="outlined" 
                        color="error" 
                        startIcon={<DeleteSweep />} 
                        onClick={clearLogs}
                        disabled={state.logs.length === 0}
                    >
                        {localT('clear')}
                    </Button>
                </ResponsiveTooltip>
            </Box>

            <Paper variant="outlined" className="logs-page-filter-paper">
                <TextField
                    size="small"
                    placeholder={localT('search')}
                    value={inputValue}
                    onChange={handleSearchChange}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
                    }}
                    className="logs-page-search-field"
                />
                
                {isFiltered && (
                    <ResponsiveTooltip title={localT('filterClearTooltip')}>
                        <Button 
                            size="small" 
                            onClick={handleClearFilters}
                            startIcon={<FilterList />}
                        >
                            {localT('filterClear')} ({state.logs.length - filteredLogs.length} {localT('filterHidden')})
                        </Button>
                    </ResponsiveTooltip>
                )}

                <Box className="logs-page-spacer" />

                <ResponsiveTooltip title={localT('columnsTooltip')}>
                    <Button
                        size="small"
                        startIcon={<ViewColumn />}
                        onClick={handleColumnMenuOpen}
                    >
                        {localT('columns')}
                    </Button>
                </ResponsiveTooltip>
            </Paper>
            
            {isFiltered && (
                <Alert severity="info" icon={<FilterList />} className="logs-page-alert">
                     {localT('filterShowing')} <b>{filteredLogs.length}</b> {localT('filterResults')} ({state.logs.length})
                </Alert>
            )}

            <Paper variant="outlined" className="logs-page-table-container">
                <LogTable 
                    logs={state.logs}
                    sortedLogs={sortedLogs}
                    onCopy={handleCopy}
                    
                    columnWidths={columnWidths}
                    sortConfig={sortConfig}
                    visibleColumns={visibleColumns}
                    columnMenuAnchor={columnMenuAnchor}
                    filterOptions={filterOptions}
                    columnFilters={columnFilters}
                    dateFilter={dateFilter}
                    onColumnResize={handleColumnResize}
                    onSort={handleSort}
                    onColumnMenuOpen={handleColumnMenuOpen}
                    onColumnMenuClose={handleColumnMenuClose}
                    onColumnToggle={handleColumnToggle}
                    onDateFilterChange={(start, end) => setDateFilter({ start, end })}
                    onColumnFilterChange={handleColumnFilterChange}
                    
                    noRowSeparator={true}
                    disableColumnMenu={true}
                />
            </Paper>
        </Box>
    );
};
