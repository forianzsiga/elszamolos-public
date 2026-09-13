/**
 * @file CustomScrollbarStyles.tsx
 * Provides a global custom scrollbar style component that applies theme-aware
 * scrollbar styling (WebKit and Firefox) across the entire application.
 */

import { GlobalStyles } from '@mui/material';
import type { Theme } from '@mui/material/styles';

/**
 * Applies custom, theme-aware scrollbar styles across the entire application.
 * This ensures scrollbars match the light/dark mode and look more modern.
 *
 * @returns A React element rendering global CSS styles for custom scrollbars.
 */
export const CustomScrollbarStyles = () => (
    <GlobalStyles
        styles={(theme: Theme) => ({
            '*::-webkit-scrollbar': {
                width: '12px',
                height: '12px',
            },
            '*::-webkit-scrollbar-track': {
                background: theme.palette.mode === 'dark' ? '#2e2e2e' : '#f1f1f1',
            },
            '*::-webkit-scrollbar-thumb': {
                background: theme.palette.action.hover,
                borderRadius: '6px',
                border: `3px solid ${theme.palette.mode === 'dark' ? '#2e2e2e' : '#f1f1f1'}`,
            },
            '*::-webkit-scrollbar-thumb:hover': {
                background: theme.palette.action.selected,
            },
            // Firefox specific scrollbar styling
            '*': {
                scrollbarWidth: 'thin',
                scrollbarColor: `${theme.palette.action.hover} ${theme.palette.mode === 'dark' ? '#2e2e2e' : '#f1f1f1'}`,
            },
        })}
    />
);
