import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import i11n from './StatCard-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import './StatCard.css';

interface StatCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    color?: string;
}

/**
 * Reusable component for displaying a single statistic.
 */
export const StatCard = ({ title, value, icon, color = 'primary.main' }: StatCardProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => {
        const translations = i11n as { en: Record<string, string>; hu: Record<string, string> };
        if (language === 'en' || language === 'hu') {
            return translations[language][key] || key;
        }
        return key;
    };

    return (
        <Card variant="outlined" className="stat-card">
            <CardContent>
                <Box className="stat-card-content-wrapper">
                    <Box>
                        <Typography color="textSecondary" gutterBottom variant="overline">
                            {localT(title)}
                        </Typography>
                        <Typography variant="h4" component="div" color={color} className="stat-card-value">
                            {value}
                        </Typography>
                    </Box>
                    {icon && <Box className="stat-card-icon" color={color}>{icon}</Box>}
                </Box>
            </CardContent>
        </Card>
    );
};
