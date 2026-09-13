import type { PaletteMode } from '@mui/material';
import type { ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    custom: {
      invoiced: string;
      applied: string;
      pending: string;
    };
  }
  interface PaletteOptions {
    custom?: {
      invoiced?: string;
      applied?: string;
      pending?: string;
    };
  }
}

/**
 * Custom Material UI Theme for DentalRaktar Accounting.
 * Defines the color palette and global typography settings based on mode.
 */
export const getThemeOptions = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: '#1976d2', // Professional Blue
    },
    secondary: {
      main: '#26a69a', // Teal/Green for success/medical feel
    },
    custom: {
      invoiced: '#00bcd4', // Cyan 500
      applied: '#4caf50',  // Green 500
      pending: '#ff9800',  // Orange 500
    },
    divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
    ...(mode === 'light'
      ? {
          // Light mode specific
          background: {
            default: '#f5f5f5',
            paper: '#ffffff',
          },
          action: {
            disabled: '#424242', // Grey 800 - Very Dark Grey
          }
        }
      : {
          // Dark mode specific
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
          action: {
            disabled: '#757575', // Grey 600
          }
        }),
  },
  typography: {
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.75rem', fontWeight: 600 },
    h3: { fontSize: '1.5rem', fontWeight: 600 },
  },
});