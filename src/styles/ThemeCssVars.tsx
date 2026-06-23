import { GlobalStyles, useTheme } from '@mui/material';

/**
 * Injects MUI palette values as CSS custom properties (--mui-palette-*)
 * This bridges the gap between plain ThemeProvider and component CSS files
 * that reference var(--mui-palette-*) variables.
 */
export function ThemeCssVars() {
  const theme = useTheme();

  return (
    <GlobalStyles
      styles={{
        ':root': {
          '--mui-palette-primary-main': theme.palette.primary.main,
          '--mui-palette-primary-contrastText': theme.palette.primary.contrastText,
          '--mui-palette-secondary-main': theme.palette.secondary.main,
          '--mui-palette-divider': theme.palette.divider,
          '--mui-palette-background-default': theme.palette.background.default,
          '--mui-palette-background-paper': theme.palette.background.paper,
          '--mui-palette-action-disabled': theme.palette.action.disabled,
          '--mui-palette-action-hover': theme.palette.action.hover,
          '--mui-palette-action-selected': theme.palette.action.selected,
          '--mui-palette-text-primary': theme.palette.text.primary,
          '--mui-palette-text-secondary': theme.palette.text.secondary,
          '--mui-palette-text-disabled': theme.palette.text.disabled,
          '--mui-palette-warning-main': theme.palette.warning.main,
          '--mui-palette-warning-dark': theme.palette.warning.dark,
          '--mui-palette-success-main': theme.palette.success.main,
          '--mui-palette-success-dark': theme.palette.success.dark,
          '--mui-palette-error-main': theme.palette.error.main,
          '--mui-palette-info-main': theme.palette.info.main,
          '--mui-palette-custom-invoiced': theme.palette.custom.invoiced,
          '--mui-palette-custom-applied': theme.palette.custom.applied,
          '--mui-palette-custom-pending': theme.palette.custom.pending,
        },
      }}
    />
  );
}
