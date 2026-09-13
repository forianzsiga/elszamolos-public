/**
 * @file AutocompleteWithHide.tsx
 * @brief MUI Autocomplete wrapper that lets the user move an option to a
 *        "hidden" list (stored in localStorage) via a minus ( - ) button on
 *        each option. Hidden options appear at the bottom of the dropdown
 *        in a separate group with a plus ( + ) button to restore them.
 *
 * This replaces the old `hideAttribute` tariff rule mechanism. The hidden
 * list is a per-user UI preference, not a rule.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { Autocomplete, Chip, IconButton, ListSubheader, Box, Divider, Typography } from '@mui/material';
import { Remove, Add } from '@mui/icons-material';
import type { AutocompleteProps } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';
import {
    getHiddenAttributes,
    toggleHiddenAttribute,
    type AttributeCategory
} from '../../utils/attributePreferences';
import i11n from './AutocompleteWithHide-i11n.json';

type SupportedLanguage = 'en' | 'hu';

const GROUP_VISIBLE = 'visible' as const;
const GROUP_HIDDEN = 'hidden' as const;
type GroupKey = typeof GROUP_VISIBLE | typeof GROUP_HIDDEN;

interface AutocompleteWithHideProps<ValueType>
    extends Omit<AutocompleteProps<ValueType, false, false, boolean>, 'renderOption' | 'groupBy'> {
    /** Which attribute category the value belongs to. Used for the hidden list. */
    category: AttributeCategory;
    /**
     * If provided, called whenever the user toggles a value's hidden state.
     * Use this to force a re-render of the parent that supplies `options`.
     */
    onHiddenChange?: () => void;
}

export function AutocompleteWithHide<ValueType extends string>(props: AutocompleteWithHideProps<ValueType>) {
    const { category, options, onHiddenChange, ...rest } = props;
    const { language } = useLanguage();
    const lang = (language === 'debug' ? 'en' : language) as SupportedLanguage;
    const localT = (key: string) => (i11n[lang] as Record<string, string>)?.[key] || key;

    // Local mirror of the hidden set so toggles re-render even if the parent
    // doesn't re-render. The source of truth is localStorage; we re-sync
    // whenever `category` changes (e.g. prop swap) or when the parent
    // explicitly bumps us via `onHiddenChange`.
    const [hiddenSet, setHiddenSet] = useState<Set<string>>(() => new Set(getHiddenAttributes(category)));

    useEffect(() => {
        setHiddenSet(new Set(getHiddenAttributes(category)));
    }, [category, onHiddenChange]);

    // Partition the options into visible and hidden, preserving the input order.
    const orderedOptions = useMemo(() => {
        const visible: ValueType[] = [];
        const hidden: ValueType[] = [];
        for (const opt of options) {
            const s = String(opt);
            if (hiddenSet.has(s)) hidden.push(opt);
            else visible.push(opt);
        }
        return [...visible, ...hidden] as ValueType[];
    }, [options, hiddenSet]);

    const groupBy = useCallback((option: ValueType): GroupKey => {
        return hiddenSet.has(String(option)) ? GROUP_HIDDEN : GROUP_VISIBLE;
    }, [hiddenSet]);

    const handleToggleHide = useCallback((value: string) => (e: React.MouseEvent) => {
        // Prevent the Autocomplete from picking this option as a selection
        e.preventDefault();
        e.stopPropagation();
        const isNowHidden = toggleHiddenAttribute(category, value);
        setHiddenSet(prev => {
            const next = new Set(prev);
            if (isNowHidden) next.add(value);
            else next.delete(value);
            return next;
        });
        onHiddenChange?.();
    }, [category, onHiddenChange]);

    return (
        <Autocomplete<ValueType, false, false, boolean>
            {...rest}
            options={orderedOptions}
            groupBy={groupBy as (option: ValueType) => string}
            renderGroup={(params) => {
                const groupKey = params.group as GroupKey;
                const label = groupKey === GROUP_HIDDEN
                    ? localT('hiddenGroup')
                    : localT('visibleGroup');
                return (
                    <li key={params.key}>
                        <ListSubheader
                            component="div"
                            disableSticky
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, lineHeight: 2, bgcolor: 'background.paper' }}
                        >
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                {label}
                            </Typography>
                        </ListSubheader>
                        <Divider />
                        <ul style={{ padding: 0 }}>{params.children}</ul>
                    </li>
                );
            }}
            renderOption={(renderProps, option) => {
                const value = String(option);
                const isHidden = hiddenSet.has(value);
                return (
                    <li
                        {...renderProps}
                        key={value}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            ...(renderProps.style || {})
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
                            {isHidden && (
                                <Chip
                                    size="small"
                                    label={localT('hiddenBadge')}
                                    variant="outlined"
                                    sx={{ flexShrink: 0 }}
                                />
                            )}
                        </Box>
                        <IconButton
                            size="small"
                            onClick={handleToggleHide(value)}
                            aria-label={isHidden ? localT('restoreAriaLabel') : localT('hideAriaLabel')}
                            title={isHidden ? localT('restoreTooltip') : localT('hideTooltip')}
                        >
                            {isHidden ? <Add fontSize="small" /> : <Remove fontSize="small" />}
                        </IconButton>
                    </li>
                );
            }}
        />
    );
}
