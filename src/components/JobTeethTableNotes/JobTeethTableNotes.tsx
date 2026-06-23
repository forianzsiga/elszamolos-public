/** @file JobTeethTableNotes.tsx
 *  @brief Displays notes for a tooth in the job teeth table.
 *
 *  Renders a labelled note section within the job teeth table,
 *  showing dentist-specific notes for the selected tooth.
 */

import React, { useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './JobTeethTableNotes-i11n.json';
import './JobTeethTableNotes.css';

/** Props interface for the JobTeethTableNotes component. */
interface JobTeethTableNotesProps {
    /** The note text to display for the tooth. */
    notes: string;
}

/**
 * Displays a labelled note block for a tooth entry in the job teeth table.
 *
 * @param props - Component props.
 * @param props.notes - The note content to render.
 * @returns The rendered note section.
 */
const JobTeethTableNotes: React.FC<JobTeethTableNotesProps> = ({ notes }) => {
    const { language } = useLanguage();
    
    const t = useCallback((key: string) => {
        if (language === 'debug') return key;
        return (i11n as Record<'en' | 'hu', Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
    }, [language]);

    return (
        <Box className="job-teeth-table-notes">
            <Typography variant="subtitle2" fontWeight="bold">{t('notes')}</Typography>
            <Typography variant="body2">{notes}</Typography>
        </Box>
    );
};

export default JobTeethTableNotes;
