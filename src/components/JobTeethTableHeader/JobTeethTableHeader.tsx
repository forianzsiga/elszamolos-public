/** @file JobTeethTableHeader.tsx
 *  Header component for the Job Teeth Table. Renders the table title and an
 *  optional expand-to-fullpage action. The previous "Columns" button has been
 *  removed along with the column-menu it opened: column selection was dropped
 *  by the redesign so all columns are always visible.
 */

import React, { useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { OpenInFull } from '@mui/icons-material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './JobTeethTableHeader-i11n.json';
import './JobTeethTableHeader.css';

interface JobTeethTableHeaderProps {
    title: string;
    onExpand?: () => void;
}

/** JobTeethTableHeader component.
 *  Renders a table header with the job title and an optional expand button.
 *
 * @param props - Component properties.
 * @param props.title - The title text displayed in the header.
 * @param props.onExpand - Optional callback invoked when the expand button is clicked.
 * @returns A React element containing the header with title and expand action.
 */
const JobTeethTableHeader: React.FC<JobTeethTableHeaderProps> = ({
    title,
    onExpand
}) => {
    const { language } = useLanguage();

    const t = useCallback((key: string) => {
        if (language === 'debug') return key;
        return (i11n as Record<'en' | 'hu', Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
    }, [language]);

    return (
        <Box className="job-teeth-table-header">
            <Typography variant="subtitle1" fontWeight="bold" className="job-teeth-table-title">
                {title}
            </Typography>
            <Box className="job-teeth-table-actions">
                {onExpand && (
                    <ResponsiveTooltip title={t('expandTooltip')}>
                        <Button
                            variant="outlined"
                            size="small"
                            color="inherit"
                            startIcon={<OpenInFull />}
                            onClick={onExpand}
                        >
                            {t('expand')}
                        </Button>
                    </ResponsiveTooltip>
                )}
            </Box>
        </Box>
    );
};

export default JobTeethTableHeader;
