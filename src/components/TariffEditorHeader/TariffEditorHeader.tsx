import React, { useState } from 'react';
import { Box, Button, Typography, useMediaQuery, useTheme, TextField, InputAdornment, Menu, MenuItem } from '@mui/material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { Add, FileDownload, FileUpload, Refresh, Search } from '@mui/icons-material';
import { JobStatusSummary } from '../JobStatusSummary/JobStatusSummary';
import { useLanguage } from '../../context/LanguageContext';
import type { Job } from '../../types';
import i11n from './TariffEditorHeader-i11n.json';
import './TariffEditorHeader.css';

interface TariffEditorHeaderProps {
    jobs: Job[];
    isEditing: boolean;
    onRecalculate: () => void;
    onImportClick: () => void;
    onExport: (type: 'user' | 'system') => void;
    onCreate: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    /**
     * When `true`, dims the toolbar to signal that a debounced preview
     * recalculation is running in the background. Inputs remain disabled
     * via `pointer-events: none` so the user sees the work is happening
     * without being tempted to interact with the page chrome.
     */
    isRecalculating?: boolean;
}

export const TariffEditorHeader: React.FC<TariffEditorHeaderProps> = ({
    jobs,
    isEditing,
    onRecalculate,
    onImportClick,
    onExport,
    onCreate,
    searchTerm,
    onSearchChange,
    isRecalculating = false,
}) => {
    const { language } = useLanguage();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);

    const typedI11n = i11n as Record<'en' | 'hu', Record<string, string>>;
    const localT = (key: string) => {
        if (language === 'debug') return key;
        return typedI11n[language as 'en' | 'hu']?.[key] || key;
    };

    const handleExportClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setExportAnchor(event.currentTarget);
    };

    const handleExportClose = (type?: 'user' | 'system') => {
        setExportAnchor(null);
        if (type) {
            onExport(type);
        }
    };

    return (
        <Box
            className="tariff-header-container"
            sx={{
                opacity: isRecalculating ? 0.6 : 1,
                pointerEvents: isRecalculating ? 'none' : 'auto',
                transition: 'opacity 0.2s ease',
            }}
        >
            <Box className="search-container">
                <Typography variant="h5">{localT('title')}</Typography>
                {!isEditing && (
                    <TextField
                        size="small"
                        placeholder={localT('search')}
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="search-field"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                )}
            </Box>
            <JobStatusSummary jobs={jobs} />
            {!isEditing && (
                <Box className="actions-container">
                    <ResponsiveTooltip title={localT('recalculateTooltip')}>
                        <Button 
                            variant="outlined" 
                            color="secondary" 
                            size={isMobile ? 'medium' : 'small'}
                            startIcon={<Refresh />} 
                            onClick={onRecalculate}
                            fullWidth={isMobile}
                        >
                            {localT('recalculate')}
                        </Button>
                    </ResponsiveTooltip>
                    <ResponsiveTooltip title={localT('importTooltip')}>
                        <Button 
                            size={isMobile ? 'medium' : 'small'} 
                            startIcon={<FileUpload />} 
                            onClick={onImportClick}
                            fullWidth={isMobile}
                            variant={isMobile ? "outlined" : "text"}
                        >
                            {localT('import')}
                        </Button>
                    </ResponsiveTooltip>
                    <ResponsiveTooltip title={localT('exportTooltip')}>
                        <Button 
                            size={isMobile ? 'medium' : 'small'} 
                            startIcon={<FileDownload />} 
                            onClick={handleExportClick}
                            fullWidth={isMobile}
                            variant={isMobile ? "outlined" : "text"}
                        >
                            {localT('export')}
                        </Button>
                    </ResponsiveTooltip>
                    <Menu
                        anchorEl={exportAnchor}
                        open={Boolean(exportAnchor)}
                        onClose={() => handleExportClose()}
                    >
                        <ResponsiveTooltip title={localT('exportUser')}>
                            <MenuItem onClick={() => handleExportClose('user')}>{localT('exportUser')}</MenuItem>
                        </ResponsiveTooltip>
                        <ResponsiveTooltip title={localT('exportSystem')}>
                            <MenuItem onClick={() => handleExportClose('system')}>{localT('exportSystem')}</MenuItem>
                        </ResponsiveTooltip>
                    </Menu>
                    <ResponsiveTooltip title={localT('newRuleTooltip')}>
                        <Button 
                            variant="contained" 
                            size={isMobile ? 'medium' : 'small'} 
                            startIcon={<Add />} 
                            onClick={onCreate}
                            fullWidth={isMobile}
                        >
                            {localT('newRule')}
                        </Button>
                    </ResponsiveTooltip>
                </Box>
            )}
        </Box>
    );
};
