/**
 * @file DateColumnFilter.tsx
 * @description A date range filter component that renders two DatePicker inputs (from/to)
 * inside a dropdown Menu, with apply and clear actions. Integrates with the app's
 * language context for translations.
 */

import { useState } from 'react';
import { IconButton, Menu, Box, Button, Badge } from '@mui/material';
import { DateRange, FilterListOff, Clear } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './DateColumnFilter-i11n.json';
import './DateColumnFilter.css';

/**
 * Props for the DateColumnFilter component.
 *
 * @interface DateColumnFilterProps
 */
interface DateColumnFilterProps {
    /** Callback invoked with ISO date strings (YYYY-MM-DD) when the user applies or clears the filter. */
    onFilterChange: (start: string, end: string) => void;
    /** Currently selected start date (ISO string or empty string). */
    startDate: string;
    /** Currently selected end date (ISO string or empty string). */
    endDate: string;
}

/** Union of all translation keys used by this component. */
type TranslationKeys = 'from' | 'to' | 'clear' | 'apply' | 'openFilter' | 'clearFilter' | 'applyFilter';

/** Translation map type keyed by supported locales (en, hu). */
type I11n = Record<'en' | 'hu', Record<TranslationKeys, string>>;

/**
 * A date range filter component displayed as an icon button that opens a Menu
 * containing two DatePicker inputs (from / to) and apply / clear buttons.
 *
 * @param {Object} props - Component props.
 * @param {function} props.onFilterChange - Callback invoked with (start, end) ISO date strings when the filter is applied or cleared.
 * @param {string} props.startDate - The current start date value (ISO string or empty string when no filter is set).
 * @param {string} props.endDate - The current end date value (ISO string or empty string when no filter is set).
 * @returns {JSX.Element} The rendered date range filter with icon button and dropdown menu.
 */
export const DateColumnFilter = ({ onFilterChange, startDate, endDate }: DateColumnFilterProps) => {
    const { language } = useLanguage();
    const localT = (key: TranslationKeys) => {
        if (language === 'debug') return key;
        return (i11n as I11n)[language as 'en' | 'hu']?.[key] || key;
    };
    
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [localStart, setLocalStart] = useState(startDate ? dayjs(startDate) : null);
    const [localEnd, setLocalEnd] = useState(endDate ? dayjs(endDate) : null);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setLocalStart(startDate ? dayjs(startDate) : null);
        setLocalEnd(endDate ? dayjs(endDate) : null);
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleApply = () => {
        const start = localStart ? localStart.format('YYYY-MM-DD') : '';
        const end = localEnd ? localEnd.format('YYYY-MM-DD') : '';
        onFilterChange(start, end);
        handleClose();
    };

    const handleClear = () => {
        setLocalStart(null);
        setLocalEnd(null);
        onFilterChange('', '');
        handleClose();
    };

    const isActive = !!startDate || !!endDate;

    return (
        <>
            <ResponsiveTooltip title={localT('openFilter')}>
                <IconButton size="small" onClick={handleClick}>
                    {isActive ? (
                        <Badge color="secondary" variant="dot">
                            <DateRange fontSize="small" color="primary" />
                        </Badge>
                    ) : (
                        <FilterListOff fontSize="small" className="date-filter-inactive-icon" />
                    )}
                </IconButton>
            </ResponsiveTooltip>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                slotProps={{ 
                    paper: { 
                        className: 'date-filter-menu-paper',
                        sx: { borderColor: 'divider' }
                    } 
                }}
            >
                <Box className="filter-container">
                    <DatePicker
                        label={localT('from')}
                        value={localStart}
                        onChange={(newValue) => setLocalStart(newValue)}
                        slotProps={{ 
                            textField: { size: 'small', fullWidth: true, onClick: (e) => e.stopPropagation() },
                            popper: { onClick: (e) => e.stopPropagation() }
                        }}
                        format="YYYY-MM-DD"
                    />
                    <DatePicker
                        label={localT('to')}
                        value={localEnd}
                        onChange={(newValue) => setLocalEnd(newValue)}
                        slotProps={{ 
                            textField: { size: 'small', fullWidth: true, onClick: (e) => e.stopPropagation() },
                            popper: { onClick: (e) => e.stopPropagation() }
                        }}
                        format="YYYY-MM-DD"
                    />
                    <Box className="filter-actions">
                        <ResponsiveTooltip title={localT('clearFilter')}>
                            <Button size="small" onClick={handleClear} color="inherit" startIcon={<Clear />}>
                                {localT('clear')}
                            </Button>
                        </ResponsiveTooltip>
                        <ResponsiveTooltip title={localT('applyFilter')}>
                            <Button size="small" variant="contained" onClick={handleApply}>
                                {localT('apply')}
                            </Button>
                        </ResponsiveTooltip>
                    </Box>
                </Box>
            </Menu>
        </>
    );
};
