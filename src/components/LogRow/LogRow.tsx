import React, { useRef, useLayoutEffect } from 'react';
import { Box, Typography, IconButton, Tooltip, Chip, type ChipProps } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { GridCell } from '../GridCell';
import { useLanguage } from '../../context/LanguageContext';
import type { LogEntry } from '../../context/LogContext';
import i11n from './LogRow-i11n.json';
import './LogRow.css';

interface LogRowProps {
    log: LogEntry;
    onCopy: (log: LogEntry) => void;
    visibleColumns: Record<string, boolean>;
    gridTemplateColumns: string;
}

const i11nData = i11n as Record<'en' | 'hu', Record<string, string>>;

export const LogRow = React.memo(({ log, onCopy, visibleColumns, gridTemplateColumns }: LogRowProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => i11nData[language as 'en' | 'hu']?.[key] || key;

    const rowRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (rowRef.current) {
            rowRef.current.style.setProperty('--grid-template-columns', gridTemplateColumns);
        }
    }, [gridTemplateColumns]);

    const getSeverityColor = (severity: string): ChipProps['color'] => {
        switch (severity) {
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'success': return 'success';
            case 'info': return 'info';
            default: return 'default';
        }
    };

    return (
        <Box
            ref={rowRef}
            className="log-row"
        >
            {visibleColumns.timestamp && (
                <GridCell colId="timestamp">
                    <Typography variant="body2" fontFamily="monospace">
                        {new Date(log.timestamp).toLocaleString()}
                    </Typography>
                </GridCell>
            )}

            {visibleColumns.severity && (
                <GridCell colId="severity" align="center">
                    <Chip
                        label={localT(`severity.${log.severity}`)}
                        color={getSeverityColor(log.severity)}
                        size="small"
                        className="severity-chip"
                    />
                </GridCell>
            )}

            {visibleColumns.message && (
                <GridCell colId="message">
                    <Typography variant="body2" noWrap title={log.message}>
                        {log.message}
                    </Typography>
                </GridCell>
            )}

            {visibleColumns.details && (
                <GridCell colId="details">
                    <Typography variant="caption" color="text.secondary" noWrap title={log.details || ''}>
                        {log.details || localT('noDetails')}
                    </Typography>
                </GridCell>
            )}

            {visibleColumns.copy && (
                <GridCell colId="copy" align="center" noBorder>
                    <Tooltip title={localT('copyTooltip')}>
                        <IconButton size="small" onClick={() => onCopy(log)}>
                            <ContentCopy fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </GridCell>
            )}
        </Box>
    );
}, (prev, next) => {
    return prev.log === next.log &&
           prev.visibleColumns === next.visibleColumns &&
           prev.gridTemplateColumns === next.gridTemplateColumns;
});

export default LogRow;
