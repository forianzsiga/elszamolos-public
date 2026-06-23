import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Typography, Paper, IconButton } from '@mui/material';
import { ContentCopy, Edit, ExpandLess, ExpandMore } from '@mui/icons-material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { truncate } from '../../utils/text';
import { useLanguage } from '../../context/LanguageContext';
import type { Job, Tooth } from '../../types';
import i11n from './UnmatchedUnits-i11n.json';
import './UnmatchedUnits.css';

interface UnmatchedUnit {
    job: Job;
    tooth: { material: string; type: string };
}

interface UnmatchedUnitsProps {
    unmatchedUnits: UnmatchedUnit[];
    onUseAsTemplate: (material: string, type: string, doctorName: string, patientName: string, jobTeeth: Tooth[]) => void;
    onEditJob: (job: Job) => void;
}

const PREVIEW_LIMIT = 20;

interface UnmatchedUnitsTranslations {
    expand: string;
    collapse: string;
    title: string;
    allMatched: string;
    createRule: string;
    modifyJob: string;
    more: string;
}

const typedI11n = i11n as Record<'en' | 'hu', UnmatchedUnitsTranslations>;

export const UnmatchedUnits: React.FC<UnmatchedUnitsProps> = ({ unmatchedUnits, onUseAsTemplate, onEditJob }) => {
    const { t, language } = useLanguage();
    const [isCollapsed, setIsCollapsed] = useState(true);
    const previewUnits = unmatchedUnits.slice(0, PREVIEW_LIMIT);
    const remainingUnits = unmatchedUnits.length - PREVIEW_LIMIT;
    const titleCount = unmatchedUnits.length > PREVIEW_LIMIT ? `${PREVIEW_LIMIT} / ${unmatchedUnits.length}` : unmatchedUnits.length;
    
    const localT = (key: keyof UnmatchedUnitsTranslations) => {
        const lang = language as 'en' | 'hu';
        const translations = typedI11n[lang];
        return translations?.[key] || key;
    };

    return (
        <Paper
            variant="outlined"
            className={`unmatched-units-container ${isCollapsed ? 'is-collapsed' : ''}`}
        >
            <Box className={`unmatched-units-header ${isCollapsed ? 'is-collapsed' : ''}`}>
                {isCollapsed ? (
                    <ResponsiveTooltip title={localT('expand')}>
                        <IconButton
                            size="small"
                            color="inherit"
                            aria-label={localT('expand')}
                            onClick={() => setIsCollapsed(prev => !prev)}
                        >
                            <ExpandMore />
                        </IconButton>
                    </ResponsiveTooltip>
                ) : (
                    <ResponsiveTooltip title={localT('collapse')}>
                        <IconButton
                            size="small"
                            color="inherit"
                            aria-label={localT('collapse')}
                            onClick={() => setIsCollapsed(prev => !prev)}
                        >
                            <ExpandLess />
                        </IconButton>
                    </ResponsiveTooltip>
                )}
                <Typography variant="h6" className="unmatched-units-title">
                    {localT('title')} ({titleCount})
                </Typography>
            </Box>

            {!isCollapsed && (
                <Box className="unmatched-units-content">
                {unmatchedUnits.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">{localT('allMatched')}</Typography>
                ) : (
                    <>
                        {previewUnits.map((item, index) => (
                            <Card variant="outlined" key={`${item.job.id}-${index}`} className="unmatched-units-card">
                                <CardContent className="unmatched-units-card-content">
                                    <Box className="unmatched-units-grid">
                                        <Typography variant="caption" color="text.secondary">{t('jobs.column.material')}:</Typography>
                                        <Typography variant="body2" fontWeight="bold">
                                            {item.tooth.material}
                                        </Typography>
                                        
                                        <Typography variant="caption" color="text.secondary">{t('jobs.column.type')}:</Typography>
                                        <Typography variant="body2" fontWeight="bold">
                                            {item.tooth.type}
                                        </Typography>

                                        <Typography variant="caption" color="text.secondary">{t('preview.doctor')}</Typography>
                                        <Typography variant="body2" noWrap title={item.job.doctorName} className="unmatched-units-text-limited">
                                            {item.job.doctorName}
                                        </Typography>
                                        
                                        <Typography variant="caption" color="text.secondary">{t('jobs.column.patient')}:</Typography>
                                        <Typography variant="body2" noWrap title={item.job.patientName} className="unmatched-units-text-limited">
                                            {item.job.patientName}
                                        </Typography>
                                        
                                        <Typography variant="caption" color="text.secondary">{t('teethTable.notes')}</Typography>
                                        <Typography variant="body2" title={item.job.notes} className="unmatched-units-text-limited">
                                            {item.job.notes ? truncate(item.job.notes, 25) : '-'}
                                        </Typography>
                                    </Box>
                                    <Box className="unmatched-units-buttons">
                                        <ResponsiveTooltip title={localT('createRule')}>
                                            <Button
                                                variant="outlined"
                                                color="info"
                                                size="small"
                                                startIcon={<ContentCopy />}
                                                onClick={() => onUseAsTemplate(item.tooth.material, item.tooth.type, item.job.doctorName || '', item.job.patientName || '', item.job.teeth || [])}
                                                fullWidth
                                            >
                                                {localT('createRule')}
                                            </Button>
                                        </ResponsiveTooltip>
                                        <ResponsiveTooltip title={localT('modifyJob')}>
                                            <Button
                                                variant="outlined"
                                                color="primary"
                                                size="small"
                                                startIcon={<Edit />}
                                                onClick={() => onEditJob(item.job)}
                                                fullWidth
                                            >
                                                {localT('modifyJob')}
                                            </Button>
                                        </ResponsiveTooltip>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                        {remainingUnits > 0 && (
                            <Card variant="outlined" className="unmatched-units-remaining">
                                <Typography variant="subtitle1" color="text.secondary" fontWeight="bold">
                                    + {remainingUnits} {localT('more')}
                                </Typography>
                            </Card>
                        )}
                    </>
                )}
                </Box>
            )}
        </Paper>
    );
};
