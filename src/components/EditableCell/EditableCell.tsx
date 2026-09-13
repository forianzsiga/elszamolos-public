/**
 * @file EditableCell.tsx
 * @description A reusable inline-editable cell component that toggles between a read-only display
 * and an editable input (text field, number field, or autocomplete). Supports save-on-blur,
 * keyboard navigation (Enter to save, Escape to cancel), and click-away detection.
 */

import { useState, useEffect } from 'react';
import { TextField, Autocomplete, IconButton, Box, Typography, ClickAwayListener } from '@mui/material';
import { Edit, Save } from '@mui/icons-material';
import './EditableCell.css';
import i11n from './EditableCell-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';

/**
 * Props for the {@link EditableCell} component.
 */
interface EditableCellProps {
    value: string | number;
    onSave: (value: string | number) => void;
    isEditing: boolean;
    onEdit: () => void;
    onCancel: () => void;
    type?: 'text' | 'number' | 'autocomplete';
    autocompleteOptions?: string[];
}

/**
 * A cell that displays a value in read-only mode and switches to an inline editor
 * (text, number, or autocomplete) when editing is activated.
 *
 * @param props           - The component props.
 * @param props.value     - The current value displayed in read-only mode.
 * @param props.onSave    - Callback invoked with the new value when the user saves (Enter, blur, or save button click).
 * @param props.isEditing - Whether the cell is currently in edit mode.
 * @param props.onEdit    - Callback to switch the cell into edit mode.
 * @param props.onCancel  - Callback to revert/cancel editing (e.g., on Escape key).
 * @param props.type      - The editor type: `'text'` (default), `'number'`, or `'autocomplete'`.
 * @param props.autocompleteOptions - Available options when `type` is `'autocomplete'`.
 * @returns The rendered inline-editable cell.
 */
export const EditableCell = ({
    value,
    onSave,
    isEditing,
    onEdit,
    onCancel,
    type = 'text',
    autocompleteOptions = [],
}: EditableCellProps) => {
    const [internalValue, setInternalValue] = useState(value);
    const { language } = useLanguage();
    const localT = (key: string) => (i11n[language as 'en' | 'hu'] as Record<string, string>)?.[key] || key;

    useEffect(() => {
        setInternalValue(value);
    }, [value]);

    const handleSave = () => {
        onSave(internalValue);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    const handleBlur = () => {
         handleSave();
    };

    if (isEditing) {
        return (
            <ClickAwayListener onClickAway={handleSave}>
                <Box className="editable-cell-edit-container" onKeyDown={handleKeyDown}>
                    {type === 'autocomplete' ? (
                        <Autocomplete
                            freeSolo
                            options={autocompleteOptions || []}
                            value={String(internalValue)}
                            onChange={(_, newValue) => setInternalValue(newValue || '')}
                            onInputChange={(_, newInputValue) => setInternalValue(newInputValue)}
                            renderInput={(params) => (
                                <TextField 
                                    {...params} 
                                    variant="standard" 
                                    size="small" 
                                    autoFocus 
                                    onBlur={handleBlur}
                                />
                            )}
                            className="editable-cell-autocomplete"
                        />
                    ) : (
                        <TextField
                            value={internalValue}
                            onChange={(e) => setInternalValue(e.target.value)}
                            type={type}
                            variant="standard"
                            InputProps={{ disableUnderline: true }}
                            className="editable-cell-textfield"
                            autoFocus
                            onBlur={handleBlur}
                        />
                    )}
                    <ResponsiveTooltip title={localT('save')}>
                        <IconButton 
                            size="small" 
                            onClick={handleSave} 
                            color="primary" 
                            onMouseDown={(e) => e.preventDefault()}
                            aria-label={localT('save')}
                        > 
                            <Save fontSize="small" />
                        </IconButton>
                    </ResponsiveTooltip>
                </Box>
            </ClickAwayListener>
        );
    }

    return (
        <ResponsiveTooltip title={localT('edit')}>
            <Box 
                className="editable-cell-view-container"
                onClick={onEdit}
            >
                <Typography variant="body2" noWrap>{value}</Typography>
                <ResponsiveTooltip title={localT('edit')}>
                    <IconButton 
                        className="edit-button"
                        size="small" 
                        onMouseDown={(e) => e.stopPropagation()} // Prevents click away from firing on the previous cell
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                        aria-label={localT('edit')}
                    >
                        <Edit fontSize="small" />
                    </IconButton>
                </ResponsiveTooltip>
            </Box>
        </ResponsiveTooltip>
    );
};
