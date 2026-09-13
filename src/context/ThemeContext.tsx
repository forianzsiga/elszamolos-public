/** @file ThemeContext.tsx - Provides the application-wide color mode (light/dark theme) context.
 *  Wraps MUI's ThemeProvider and CssBaseline so that all children can consume the current
 *  theme mode and toggle between light and dark.
 */

import { createContext, useState, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { ThemeProvider, createTheme, type PaletteMode, CssBaseline, useMediaQuery } from '@mui/material';
import { getThemeOptions } from '../theme';
import { ThemeCssVars } from '../styles/ThemeCssVars';

/** Describes the shape of the color-mode context value. */
interface ColorModeContextType {
    /** Toggles between light and dark mode. */
    toggleColorMode: () => void;
    /** The current palette mode: 'light' | 'dark'. */
    mode: PaletteMode;
    /** Whether the viewport is below the 'sm' breakpoint. */
    isMobile: boolean;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useColorMode = () => {
    const context = useContext(ColorModeContext);
    if (!context) {
        throw new Error('useColorMode must be used within a ColorModeProvider');
    }
    return context;
};

/** Provides the color-mode context and MUI theme to its children.
 *  Persists the user's choice to localStorage and respects the system
 *  preference (`prefers-color-scheme`) on first load.
 *  @param children - The React subtree that will receive the theme context.
 *  @returns The context provider wrapping MUI's ThemeProvider and CssBaseline.
 */
export const ColorModeProvider = ({ children }: { children: ReactNode }) => {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    
    const [mode, setMode] = useState<'light' | 'dark'>(() => {
        const savedMode = localStorage.getItem('themeMode');
        if (savedMode === 'light' || savedMode === 'dark') {
            return savedMode;
        }
        return prefersDarkMode ? 'dark' : 'light';

    });

    useEffect(() => {
        localStorage.setItem('themeMode', mode);
    }, [mode]);

    const theme = useMemo(() => createTheme(getThemeOptions(mode)), [mode]);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const colorMode = useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
            },
            mode,
            isMobile,
        }),
        [mode, isMobile],
    );

    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <ThemeCssVars />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};
