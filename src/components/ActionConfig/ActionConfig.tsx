/**
 * @file ActionConfig.tsx
 * Component for configuring a tariff action's price value and currency.
 */

import { Grid2 as Grid, TextField, MenuItem, Box, Typography } from '@mui/material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import type { TariffAction } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './ActionConfig-i11n.json';
import './ActionConfig.css';

/**
 * Props for the ActionConfig component.
 *
 * @interface ActionConfigProps
 * @property {TariffAction} action - The current tariff action being configured.
 * @property {(action: TariffAction) => void} onChange - Callback fired when any field of the action changes.
 */
interface ActionConfigProps {
    action: TariffAction;
    onChange: (action: TariffAction) => void;
}

/**
 * Renders a row of form controls for editing a tariff action's price and currency.
 *
 * @param {ActionConfigProps} props - The component props.
 * @param {TariffAction} props.action - The current tariff action being configured.
 * @param {(action: TariffAction) => void} props.onChange - Change handler that receives the updated action object.
 * @returns {JSX.Element} The rendered action configuration form row.
 */
export const ActionConfig = ({ action, onChange }: ActionConfigProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => {
        if (language === 'debug') return key;
        const translations = i11n[language as keyof typeof i11n];
        return translations?.[key as keyof typeof translations] || key;
    };

    return (
        <Grid container spacing={2} alignItems="center" className="action-config-container">
            <Grid size={{ xs: 12, sm: 6 }}>
                <Box display="flex" gap={1}>
                    <TextField
                        fullWidth
                        type="number"
                        label={localT('priceValue')}
                        value={action.value ?? ''}
                        onChange={(e) => onChange({ ...action, value: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                        color={action.value === 0 ? "warning" : "primary"}
                        focused={action.value === 0}
                        helperText={action.value === 0 ? localT('priceIsZero') : ""}
                        slotProps={{
                            input: {
                                endAdornment: <Typography variant="caption">{action.currency === 'EUR' ? '\u20AC' : 'Ft'}</Typography>,
                                sx: { color: action.value === 0 ? 'warning.main' : 'inherit' }
                            },
                            formHelperText: {
                                className: 'price-field-helper-text',
                                sx: { color: 'warning.main' }
                            }
                        }}
                    />
                    <TextField
                        select
                        label={localT('currency')}
                        value={action.currency || 'HUF'}
                        onChange={(e) => onChange({ ...action, currency: e.target.value as 'HUF' | 'EUR' })}
                        className="currency-field"
                    >
                        <ResponsiveTooltip title={localT('hufTooltip')}>
                            <MenuItem value="HUF">Ft</MenuItem>
                        </ResponsiveTooltip>
                        <ResponsiveTooltip title={localT('eurTooltip')}>
                            <MenuItem value="EUR">€</MenuItem>
                        </ResponsiveTooltip>
                    </TextField>
                </Box>
            </Grid>
        </Grid>
    );
};
