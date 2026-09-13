import React from 'react';
import { Box, useTheme } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './ResizeHandle-i11n.json';
import './ResizeHandle.css';

interface ResizeHandleProps {
    width: number;
    minWidth: number;
    onResize: (width: number) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

/**
 * A reusable resize handle for table headers.
 * Handles the mouse events and UI logic for column resizing.
 */
export const ResizeHandle = React.forwardRef<HTMLDivElement, ResizeHandleProps>(
    ({ width, minWidth, onResize, ...rest }, ref) => {
        const { language } = useLanguage();
        const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
        const theme = useTheme();
        const isDark = theme.palette.mode === 'dark';

        return (
            <Box 
                ref={ref}
                {...rest}
                className={`resize-handle ${isDark ? 'dark' : ''}`}
            onMouseDown={(e) => {
                e.preventDefault(); 
                e.stopPropagation();
                const startX = e.pageX; 
                const startWidth = width;
                let animationFrameId: number;

                const handleMove = (ev: MouseEvent) => {
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    animationFrameId = requestAnimationFrame(() => {
                        onResize(Math.max(startWidth + (ev.pageX - startX), minWidth));
                    });
                };

                const handleUp = () => { 
                    if (animationFrameId) cancelAnimationFrame(animationFrameId);
                    document.removeEventListener('mousemove', handleMove); 
                    document.removeEventListener('mouseup', handleUp); 
                    document.body.style.cursor = ''; 
                };

                document.addEventListener('mousemove', handleMove); 
                document.addEventListener('mouseup', handleUp); 
                document.body.style.cursor = 'col-resize';
            }}
        >
            <span className="resize-handle-label">{localT('resize')}</span>
        </Box>
    );
});
