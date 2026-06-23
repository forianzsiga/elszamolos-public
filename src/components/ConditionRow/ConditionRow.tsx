/**
 * @file ConditionRow.tsx
 * A single condition row component used in the Rule Editor for defining
 * logical conditions. Renders a field selector, an operator selector, a
 * value input (text field or autocomplete), and a delete button.
 */

import { useState, useEffect } from 'react';
import { Box, TextField, MenuItem, IconButton, Autocomplete } from '@mui/material';
import { Delete } from '@mui/icons-material';
import type { TariffCondition } from '../../types';
import { dbService } from '../../services/db';
import i11n from './ConditionRow-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import './ConditionRow.css';

/**
 * Props for the {@link ConditionRow} component.
 */
interface ConditionRowProps {
    /** The current tariff condition to display and edit. */
    condition: TariffCondition;
    /** Callback invoked when any field of the condition changes. */
    onChange: (newCondition: TariffCondition) => void;
    /** Callback invoked when the delete button is clicked. */
    onDelete: () => void;
}

/**
 * A single row in the Rule Editor for defining a logical condition.
 *
 * @param props - The component props.
 * @param props.condition - The current tariff condition object.
 * @param props.onChange - Callback invoked when the condition changes.
 * @param props.onDelete - Callback invoked when the delete action is triggered.
 * @returns A React element representing a condition row.
 */
export const ConditionRow = ({ condition, onChange, onDelete }: ConditionRowProps) => {
    const [options, setOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const { language } = useLanguage();
    
    /**
     * Resolves a localized translation string for the given key based on the
     * current language selected in {@link useLanguage}.
     *
     * @param key - The translation key to look up.
     * @returns The translated string or the key itself if no translation exists.
     */
    const localT = (key: keyof typeof i11n.en) => i11n[language as 'en' | 'hu']?.[key] || key;

    useEffect(() => {
        const loadOptions = async () => {
            if (condition.field === 'material') {
                setLoading(true);
                const mats = await dbService.getMetadata('materials');
                setOptions(mats);
                setLoading(false);
            } else if (condition.field === 'type') {
                setLoading(true);
                const types = await dbService.getMetadata('types');
                setOptions(types);
                setLoading(false);
            } else {
                setOptions([]);
            }
        };
        loadOptions();
    }, [condition.field]);
    
    /**
     * Handles a change to one of the condition's fields (field, operator,
     * or value). When the operator changes to/from `isOneOf`, the value is
     * reset to the correct type (array or string).
     *
     * @param field - The condition key being updated.
     * @param newValue - The new value for the condition field.
     */
    const handleChange = (field: keyof TariffCondition, newValue: string | string[]) => {
        if (field === 'operator') {
            // Reset value when switching to/from isOneOf to match type expectation
            if (newValue === 'isOneOf') {
                onChange({ ...condition, operator: newValue as 'isOneOf', value: [] });
            } else if (condition.operator === 'isOneOf') {
                onChange({ ...condition, operator: newValue as 'equals', value: '' });
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange({ ...condition, operator: newValue as any });
            }
        } else {
            onChange({ ...condition, [field]: newValue });
        }
    };

    return (
        <Box className="condition-row-container">
            <TextField
                select
                label={localT('field')}
                size="small"
                value={condition.field}
                onChange={(e) => handleChange('field', e.target.value)}
                className="condition-row-field"
            >
                <ResponsiveTooltip title={localT('material')}>
                    <MenuItem value="material">material</MenuItem>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('type')}>
                    <MenuItem value="type">type</MenuItem>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('unitCount')}>
                    <MenuItem value="unitCount">unitCount</MenuItem>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('notes')}>
                    <MenuItem value="notes">notes</MenuItem>
                </ResponsiveTooltip>
            </TextField>

            <TextField
                select
                label={localT('operator')}
                size="small"
                value={condition.operator}
                onChange={(e) => handleChange('operator', e.target.value)}
                className="condition-row-operator"
            >
                <ResponsiveTooltip title={localT('equals')}>
                    <MenuItem value="equals">equals</MenuItem>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('contains')}>
                    <MenuItem value="contains">contains</MenuItem>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('greaterThan')}>
                    <MenuItem value="greaterThan">greaterThan</MenuItem>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('lessThan')}>
                    <MenuItem value="lessThan">lessThan</MenuItem>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('isOneOf')}>
                    <MenuItem value="isOneOf">isOneOf</MenuItem>
                </ResponsiveTooltip>
            </TextField>

            {(condition.field === 'material' || condition.field === 'type') ? (
                <Autocomplete
                    freeSolo
                    multiple={condition.operator === 'isOneOf'}
                    options={options}
                    value={(() => {
                        if (condition.operator === 'isOneOf') {
                            return Array.isArray(condition.value) ? condition.value : [];
                        }
                        return String(condition.value || '');
                    })()}
                    onChange={(_, newValue) => handleChange('value', newValue as string | string[])}
                    onInputChange={condition.operator === 'isOneOf' ? undefined : (_, newInputValue) => handleChange('value', newInputValue)}
                    className="condition-row-value"
                    renderInput={(params) => {
                        const getLabelSuffix = () => {
                            if (loading) return localT('loading');
                            return condition.operator === 'isOneOf' ? localT('selectMultiple') : localT('selectOrType');
                        };
                        return (
                            <TextField 
                                {...params} 
                                label={`${localT('value')} (${getLabelSuffix()})`} 
                                size="small" 
                            />
                        );
                    }}
                />
            ) : (
                <TextField
                    label={localT('value')}
                    size="small"
                    value={String(condition.value)}
                    onChange={(e) => handleChange('value', e.target.value)}
                    className="condition-row-value"
                />
            )}

            <ResponsiveTooltip title={localT('deleteCondition')}>
                <IconButton onClick={onDelete} color="error">
                    <Delete />
                </IconButton>
            </ResponsiveTooltip>
        </Box>
    );
};
