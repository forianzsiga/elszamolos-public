import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import type { TariffRule } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './RuleEditorHeader-i11n.json';
import './RuleEditorHeader.css';

interface RuleEditorHeaderProps {
    initialRule: TariffRule | null;
    onCancel: () => void;
}

export const RuleEditorHeader: React.FC<RuleEditorHeaderProps> = ({ initialRule, onCancel }) => {
    const { language } = useLanguage();
    const localT = (key: keyof typeof i11n['en']) => (i11n[language as 'en' | 'hu'] || i11n['en'])[key] || key;

    return (
        <Box className="rule-editor-header">
            <Typography variant="h6">{initialRule ? localT('title_edit') : localT('title_new')}</Typography>
            <ResponsiveTooltip title={localT('cancel')}>
                <IconButton onClick={onCancel} size="small"><Close /></IconButton>
            </ResponsiveTooltip>
        </Box>
    );
};

export default RuleEditorHeader;
