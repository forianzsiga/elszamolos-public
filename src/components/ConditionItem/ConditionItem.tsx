/**
 * @file ConditionItem.tsx
 * @brief A form row component for editing a single tariff condition.
 *
 * Renders a field selector, an operator selector, and a dynamic value
 * input (text, select, autocomplete, or boolean) depending on the
 * selected field and operator.  Also provides a delete button to
 * remove the condition row.
 */

import React, { useState, useMemo } from 'react';
import { 
    Grid2 as Grid, TextField, MenuItem, IconButton, FormControl, 
    InputLabel, Select, Checkbox, ListItemText, Typography, Autocomplete,
    ListSubheader, Divider, Box, Chip, Paper
} from '@mui/material';
import type { PaperProps } from '@mui/material';
import { Delete, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import type { TariffCondition, ConditionField, ConditionOperator, TariffRule } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './ConditionItem-i11n.json';
import './ConditionItem.css';

/**
 * Helper to compare two occurrence counts, falling back to name ordering on tie.
 *
 * @param countA - Count for item A.
 * @param countB - Count for item B.
 * @param sortOrder - Ascending or descending ordering.
 * @param nameA - Name of item A.
 * @param nameB - Name of item B.
 * @returns Comparison integer.
 */
function compareCounts(
    countA: number,
    countB: number,
    sortOrder: 'asc' | 'desc',
    nameA: string,
    nameB: string
): number {
    if (countA !== countB) {
        return (countA < countB ? -1 : 1) * (sortOrder === 'asc' ? 1 : -1);
    }
    return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
}

/**
 * Compares two items based on their occurrences count.
 * First checks active job occurrences, then falls back to database occurrences.
 *
 * @param a - Name of item A.
 * @param b - Name of item B.
 * @param sortOrder - Ascending or descending ordering.
 * @param jobOccurrences - Map of active job occurrences.
 * @param occurrences - Map of database occurrences.
 * @returns Comparison integer.
 */
function compareOccurrence(
    a: string,
    b: string,
    sortOrder: 'asc' | 'desc',
    jobOccurrences?: Map<string, number>,
    occurrences?: Map<string, number>
): number {
    const jobA = jobOccurrences?.get(a) || 0;
    const jobB = jobOccurrences?.get(b) || 0;

    if (jobA > 0 && jobB === 0) return -1;
    if (jobA === 0 && jobB > 0) return 1;
    if (jobA > 0 && jobB > 0) {
        return compareCounts(jobA, jobB, sortOrder, a, b);
    }

    const dbA = occurrences?.get(a) || 0;
    const dbB = occurrences?.get(b) || 0;
    return compareCounts(dbA, dbB, sortOrder, a, b);
}

/**
 * Compares two items alphabetically by name or chronologically by recency.
 *
 * @param a - Name of item A.
 * @param b - Name of item B.
 * @param sortBy - Sorting mode ('name' or 'recency').
 * @param sortOrder - Ascending or descending ordering.
 * @param lastUsed - Map of last used date strings.
 * @returns Comparison integer.
 */
function compareNameOrRecency(
    a: string,
    b: string,
    sortBy: 'name' | 'recency',
    sortOrder: 'asc' | 'desc',
    lastUsed?: Map<string, string>
): number {
    let valA: string | number = '';
    let valB: string | number = '';

    if (sortBy === 'name') {
        valA = a.toLowerCase();
        valB = b.toLowerCase();
    } else {
        valA = lastUsed?.get(a) || '';
        valB = lastUsed?.get(b) || '';
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
}

/**
 * Props for the ConditionItem component.
 */
interface ConditionItemProps {
    /** The condition data to render and edit. */
    condition: TariffCondition;
    /** The zero-based index of this condition within the parent list. */
    index: number;
    /** Optional validation error message to display. */
    error?: string;
    /** Available field choices for the condition (e.g. "unitCount", "isScrewRetained"). */
    fieldOptions: { label: string; value: ConditionField }[];
    /** Available operator choices for the condition (e.g. "equals", "isOneOf"). */
    operatorOptions: { label: string; value: ConditionOperator }[];
    /** Available option values shown when the operator is "isOneOf" or "notOneOf". */
    availableOptions: string[];
    /** Set of hidden option values to show in a separate grouped section at the bottom. */
    hiddenOptions?: Set<string>;
    /** Occurrences statistic mapping count for sorting. */
    occurrences?: Map<string, number>;
    /** Occurrences statistic mapping count in the active job. */
    jobOccurrences?: Map<string, number>;
    /** Last used date string mapping for sorting. */
    lastUsed?: Map<string, string>;
    /** Called when a field of the condition changes. */
    onChange: (index: number, field: keyof TariffCondition, value: TariffCondition['value']) => void;
    /** Called when the remove / delete button is clicked. */
    onRemove: (index: number) => void;
    /**
     * Called when a plain text/number value input loses focus. Used to run
     * the local validation flow (the parent may re-run it through
     * `validateCondition`). Dropdowns do NOT go through this path — they
     * fire `onFieldChange` directly on value pick / menu close.
     */
    onBlur: (index: number) => void;
    /**
     * Live snapshot of the parent rule (with the in-progress form state)
     * — used to build a `TariffRule` with the freshly-picked value when
     * the row fires `onFieldChange`, since React's state update from
     * `onChange` is not yet committed at that point.
     */
    currentRule?: TariffRule | null;
    /**
     * Fired on dropdown value pick (`onChange`) and on dropdown close
     * (`onClose`, the safety net). The page wires this to the recalc
     * trigger. Always passes the freshly-built `TariffRule` so the recalc
     * uses the new value, not the stale one from the previous render.
     */
    onFieldChange?: (field: 'condition', rule: TariffRule) => void;
}

/**
 * A single condition editing row.
 *
 * Renders a field selector, an operator selector, and a value input
 * whose type (boolean dropdown, multi-select, autocomplete, or plain
 * text/number) adapts to the chosen field and operator.  A delete
 * button removes the row.
 *
 * @param props - Component props.
 * @returns A React element representing the condition row.
 */
export const ConditionItem = ({
    condition,
    index,
    error,
    fieldOptions,
    operatorOptions,
    availableOptions,
    hiddenOptions,
    occurrences,
    jobOccurrences,
    lastUsed,
    onChange,
    onRemove,
    onBlur,
    currentRule,
    onFieldChange
}: ConditionItemProps) => {
    const { language, t } = useLanguage();
    const typedI11n = i11n as Record<'en' | 'hu', Record<string, string>>;
    const localT = (key: string) => typedI11n[language as 'en' | 'hu']?.[key] || key;

    const [sortBy, setSortBy] = useState<'name' | 'occurrence' | 'recency'>('occurrence');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    /**
     * Builds a fresh `TariffRule` snapshot with the given value applied to
     * this condition row. The state update from `onChange` is not yet
     * committed when the dropdown fires, so we synthesize the new rule
     * here to make sure the parent's recalc uses the picked value.
     */
    const buildRuleWithValue = (newValue: TariffCondition['value']): TariffRule | null => {
        if (!currentRule) return null;
        const newConditions = currentRule.conditions.map((c, i) =>
            i === index ? { ...c, value: newValue } : c
        );
        return { ...currentRule, conditions: newConditions };
    };

    /**
     * Wraps an `onChange` value mutation with a recalc trigger. Used by
     * the field, operator, screw-retained, multi-select, and autocomplete
     * dropdowns — every place that needs to fire `onFieldChange` with the
     * freshly-built rule.
     */
    const fireConditionChange = (newValue: TariffCondition['value']) => {
        const next = buildRuleWithValue(newValue);
        if (onFieldChange && next) {
            onFieldChange('condition', next);
        }
    };


    const sortedOptions = useMemo(() => {
        const nonHidden = availableOptions.filter(opt => !hiddenOptions?.has(opt));
        const hidden = availableOptions.filter(opt => hiddenOptions?.has(opt));

        const compare = (a: string, b: string) => {
            if (sortBy === 'occurrence') {
                return compareOccurrence(a, b, sortOrder, jobOccurrences, occurrences);
            }
            return compareNameOrRecency(a, b, sortBy, sortOrder, lastUsed);
        };

        return [
            ...nonHidden.sort(compare),
            ...hidden.sort(compare)
        ];
    }, [availableOptions, hiddenOptions, sortBy, sortOrder, occurrences, jobOccurrences, lastUsed]);

    const renderDropdownSortHeader = () => (
        <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="flex-start" 
            px={1.5} 
            py={0.75} 
            bgcolor="action.hover"
            borderBottom="1px solid"
            borderColor="divider"
            onClick={(e) => e.stopPropagation()} 
            onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="dropdown-sort-header"
            sx={{
                outline: 'none',
                cursor: 'default',
                gap: 1
            }}
        >
            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>
                {localT('sortBy')}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5}>
                <Chip
                    size="small"
                    label={localT('sortByNameShort')}
                    color={sortBy === 'name' ? 'primary' : 'default'}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSortBy('name');
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    sx={{ fontSize: '0.7rem', height: 18, cursor: 'pointer' }}
                />
                <Chip
                    size="small"
                    label={localT('sortByOccurrenceShort')}
                    color={sortBy === 'occurrence' ? 'primary' : 'default'}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSortBy('occurrence');
                        setSortOrder('desc');
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    sx={{ fontSize: '0.7rem', height: 18, cursor: 'pointer' }}
                />
                <Chip
                    size="small"
                    label={localT('sortByRecencyShort')}
                    color={sortBy === 'recency' ? 'primary' : 'default'}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSortBy('recency');
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    sx={{ fontSize: '0.7rem', height: 18, cursor: 'pointer' }}
                />
            </Box>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
            <ResponsiveTooltip title={sortOrder === 'asc' ? localT('sortAsc') : localT('sortDesc')}>
                <IconButton 
                    size="small" 
                    onClick={(e) => {
                        e.stopPropagation();
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    sx={{ p: 0.25 }}
                >
                    {sortOrder === 'asc' ? <ArrowUpward fontSize="small" style={{ fontSize: '0.9rem' }} /> : <ArrowDownward fontSize="small" style={{ fontSize: '0.9rem' }} />}
                </IconButton>
            </ResponsiveTooltip>
        </Box>
    );

    /**
     * Renders the dynamic value input based on the selected field and operator.
     *
     * - For `isScrewRetained`: a boolean Yes/No select.
     * - For `isOneOf` / `notOneOf`: a multi-select with checkboxes.
     * - For `equals` / `notEquals` with available options: an autocomplete.
     * - Otherwise: a plain TextField (text or number).
     *
     * @returns A React element for the value input.
     */
    const renderValueInput = () => {
        /**
         * Converts a boolean `TariffCondition` value to a select-compatible string.
         *
         * @param value - The condition value to convert.
         * @returns `"true"` for `true`, `"false"` for `false`, or `""` otherwise.
         */
        const getScrewValue = (value: TariffCondition['value']) => {
            if (value === true) return 'true';
            if (value === false) return 'false';
            return '';
        };

        if (condition.field === 'isScrewRetained') {
            const labelId = `condition-screw-label-${index}`;
            return (
                <FormControl size="small" fullWidth error={!!error}>
                    <InputLabel id={labelId}>{t('tariff.editor.value')}</InputLabel>
                    <Select
                        labelId={labelId}
                        id={`condition-screw-select-${index}`}
                        value={getScrewValue(condition.value)}
                        onChange={(e) => {
                            const newValue = e.target.value === 'true';
                            onChange(index, 'value', newValue);
                            fireConditionChange(newValue);
                        }}
                        onClose={() => fireConditionChange(condition.value)}
                        label={t('tariff.editor.value')}
                    >
                        <MenuItem value="true">{localT('yes')}</MenuItem>
                        <MenuItem value="false">{localT('no')}</MenuItem>
                    </Select>
                    {error && <Typography variant="caption" color="error">{error}</Typography>}
                </FormControl>
            );
        }

        if (condition.operator === 'isOneOf' || condition.operator === 'notOneOf') {
            const labelId = `condition-values-label-${index}`;
            return (
                <FormControl size="small" fullWidth error={!!error}>
                    <InputLabel id={labelId}>{localT('values')}</InputLabel>
                    <Select
                        labelId={labelId}
                        id={`condition-values-select-${index}`}
                        multiple
                        value={Array.isArray(condition.value) ? condition.value : []}
                        onChange={(e) => {
                            const newValue = e.target.value as string[];
                            onChange(index, 'value', newValue);
                            fireConditionChange(newValue);
                        }}
                        onClose={() => fireConditionChange(condition.value)}
                        renderValue={(selected: unknown) => (selected as string[]).join(', ')}
                        label={localT('values')}
                        MenuProps={{
                            PaperProps: {
                                sx: {
                                    '& .MuiList-root': {
                                        paddingTop: 0
                                    }
                                }
                            }
                        }}
                    >
                        {renderDropdownSortHeader()}
                        <Divider />
                        {sortedOptions.length > 0 ? (
                            (() => {
                                const menuItems: React.ReactNode[] = [];
                                let renderedHiddenHeader = false;
                                let renderedJobHeader = false;
                                let renderedDbHeader = false;

                                sortedOptions.forEach((name) => {
                                    const isOptionHidden = hiddenOptions?.has(name);
                                    if (isOptionHidden) {
                                        if (!renderedHiddenHeader) {
                                            menuItems.push(
                                                <ListSubheader key="hidden-header" disableSticky className="dropdown-subheader">
                                                    {localT('hiddenAttributesGroup')}
                                                </ListSubheader>
                                            );
                                            renderedHiddenHeader = true;
                                        }
                                    } else if (sortBy === 'occurrence') {
                                        const isInJob = (jobOccurrences?.get(name) || 0) > 0;
                                        if (isInJob) {
                                            if (!renderedJobHeader) {
                                                menuItems.push(
                                                    <ListSubheader key="job-header" disableSticky className="dropdown-subheader">
                                                        {localT('mostFrequentInJob')}
                                                    </ListSubheader>
                                                );
                                                renderedJobHeader = true;
                                            }
                                        } else {
                                            if (!renderedDbHeader) {
                                                menuItems.push(
                                                    <ListSubheader key="db-header" disableSticky className="dropdown-subheader">
                                                        {localT('mostFrequentInDb')}
                                                    </ListSubheader>
                                                );
                                                renderedDbHeader = true;
                                            }
                                        }
                                    }

                                    const jobCount = jobOccurrences?.get(name) || 0;
                                    const dbCount = occurrences?.get(name) || 0;
                                    const count = jobCount > 0 ? jobCount : dbCount;
                                    const hasFreq = sortBy === 'occurrence';

                                    menuItems.push(
                                        <MenuItem key={name} value={name}>
                                            <Checkbox checked={(Array.isArray(condition.value) ? condition.value : []).indexOf(name) > -1} />
                                            {hasFreq && (
                                                <Typography 
                                                    variant="caption" 
                                                    color="text.secondary" 
                                                    sx={{ mr: 1, fontWeight: 'bold', minWidth: '24px', display: 'inline-block' }}
                                                >
                                                    {count}x
                                                </Typography>
                                            )}
                                            <ListItemText primary={name} />
                                        </MenuItem>
                                    );
                                });
                                return menuItems;
                            })()
                        ) : (
                            <MenuItem disabled value="">{localT('noOptions')}</MenuItem>
                        )}
                    </Select>
                    {error && <Typography variant="caption" color="error">{error}</Typography>}
                </FormControl>
            );
        } 
        
        if ((condition.operator === 'equals' || condition.operator === 'notEquals') && sortedOptions.length > 0) {
            return (
                <Autocomplete
                    freeSolo
                    options={sortedOptions}
                    groupBy={(option) => {
                        if (hiddenOptions?.has(option)) {
                            return localT('hiddenAttributesGroup');
                        }
                        if (sortBy === 'occurrence') {
                            const jobCount = jobOccurrences?.get(option) || 0;
                            return jobCount > 0 ? localT('mostFrequentInJob') : localT('mostFrequentInDb');
                        }
                        return '';
                    }}
                    value={String(condition.value)}
                    onChange={(_, newValue) => {
                        const newVal = newValue || '';
                        onChange(index, 'value', newVal);
                        fireConditionChange(newVal);
                    }}
                    onInputChange={(_, newInputValue) => onChange(index, 'value', newInputValue)}
                    onClose={(_, reason) => {
                        if (reason === 'selectOption' || reason === 'createOption') {
                            fireConditionChange(condition.value);
                        }
                    }}
                    PaperComponent={({ children, ...paperProps }) => {
                        const sx = (paperProps as PaperProps).sx;
                        return (
                            <Paper {...paperProps} sx={{ 
                                ...sx, 
                                '& .MuiAutocomplete-listbox': { 
                                    paddingTop: 0 
                                } 
                            }}>
                                {renderDropdownSortHeader()}
                                {children}
                            </Paper>
                        );
                    }}
                    renderGroup={(params) => (
                        <li key={params.key}>
                            {params.group ? (
                                <ListSubheader disableSticky sx={{ bgcolor: 'background.paper', lineHeight: '32px' }}>
                                    {params.group}
                                </ListSubheader>
                            ) : null}
                            <ul style={{ padding: 0, listStyle: 'none' }}>
                                {params.children}
                            </ul>
                        </li>
                    )}
                    renderOption={(props, option) => {
                        const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key?: React.Key };
                        const hasFreq = sortBy === 'occurrence';
                        const jobCount = jobOccurrences?.get(option) || 0;
                        const dbCount = occurrences?.get(option) || 0;
                        const count = jobCount > 0 ? jobCount : dbCount;
                        
                        return (
                            <li key={key} {...rest}>
                                {hasFreq && (
                                    <Typography 
                                        variant="caption" 
                                        color="text.secondary" 
                                        sx={{ mr: 1, fontWeight: 'bold', minWidth: '24px', display: 'inline-block' }}
                                    >
                                        {count}x
                                    </Typography>
                                )}
                                <span style={{ textDecoration: hiddenOptions?.has(option) ? 'line-through' : 'none' }}>
                                    {option}
                                </span>
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField 
                            {...params} 
                            label={t('tariff.editor.value')} 
                            size="small" 
                            fullWidth 
                            error={!!error}
                            helperText={error}
                        />
                    )}
                />
            );
        }

        return (
            <TextField
                fullWidth
                size="small"
                label={t('tariff.editor.value')}
                value={condition.value}
                onChange={(e) => onChange(index, 'value', e.target.value)}
                onBlur={() => onBlur(index)}
                error={!!error}
                helperText={error}
                type={condition.field === 'unitCount' ? 'number' : 'text'}
            />
        );
    };

    return (
        <Grid container spacing={1} alignItems="flex-start" className="condition-item-container">
            <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('tariff.editor.field')}
                    value={condition.field}
                    onChange={(e) => {
                        const newValue = e.target.value as ConditionField;
                        onChange(index, 'field', newValue);
                        // Field change resets the value to '' in the parent
                        // (see `handleConditionChange`), so build the rule
                        // accordingly. The state update is not yet committed.
                        if (onFieldChange && currentRule) {
                            const newConditions = currentRule.conditions.map((c, i) =>
                                i === index ? { ...c, field: newValue, value: '' } : c
                            );
                            onFieldChange('condition', { ...currentRule, conditions: newConditions });
                        }
                    }}
                    slotProps={{
                        select: {
                            onClose: () => {
                                if (onFieldChange && currentRule) {
                                    onFieldChange('condition', currentRule);
                                }
                            }
                        }
                    }}
                >
                    {fieldOptions.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}

                </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                    select
                    fullWidth
                    size="small"
                    label={t('tariff.editor.operator')}
                    value={condition.operator}
                    onChange={(e) => {
                        const newValue = e.target.value as ConditionOperator;
                        onChange(index, 'operator', newValue);
                        // Operator change may swap single-vs-array value
                        // (see `handleConditionChange`); keep the current
                        // value, the parent normalises it.
                        if (onFieldChange && currentRule) {
                            const newConditions = currentRule.conditions.map((c, i) =>
                                i === index ? { ...c, operator: newValue } : c
                            );
                            onFieldChange('condition', { ...currentRule, conditions: newConditions });
                        }
                    }}
                    slotProps={{
                        select: {
                            onClose: () => {
                                if (onFieldChange && currentRule) {
                                    onFieldChange('condition', currentRule);
                                }
                            }
                        }
                    }}
                >
                    {operatorOptions.map(opt => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}

                </TextField>
            </Grid>
            <Grid size={{ xs: 10, sm: 5 }}>
                {renderValueInput()}
            </Grid>
            <Grid size={{ xs: 2, sm: 1 }}>
                <ResponsiveTooltip title={localT('deleteCondition')}>
                    <IconButton size="small" color="error" onClick={() => onRemove(index)} className="delete-button">
                        <Delete fontSize="small" />
                    </IconButton>
                </ResponsiveTooltip>
            </Grid>
        </Grid>
    );
};
