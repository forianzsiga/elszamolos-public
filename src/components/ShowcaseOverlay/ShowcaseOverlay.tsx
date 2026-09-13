import React from 'react';
import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import './ShowcaseOverlay.css';

interface ShowcaseOverlayProps {
    /** Whether to show the demo state (greyout + label) */
    isDemo: boolean;
    /** The localized label to display in the overlay */
    label: React.ReactNode;
    /** The actual content to be displayed (and greyed out in demo mode) */
    children: React.ReactNode;
    /** Optional SX props for the outer container */
    sx?: SxProps<Theme>;
}

/**
 * A unified wrapper component that provides a "Demo Mode" visual state.
 * When isDemo is true, it greys out the content and shows a centered label.
 */
export const ShowcaseOverlay = ({ isDemo, label, children }: ShowcaseOverlayProps) => {
    return (
        <Box className="showcase-overlay">
            <Box
                className={`showcase-overlay__content ${isDemo ? 'showcase-overlay__content--demo' : ''}`}
            >
                {children}
            </Box>

            {isDemo && (
                <Box className="showcase-overlay__demo-wrapper">
                    <Typography 
                        variant="h6" 
                        className="showcase-overlay__label"
                        sx={{
                            backgroundColor: 'background.paper',
                            color: 'text.primary',
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        {label}
                    </Typography>
                </Box>
            )}
        </Box>
    );
};
