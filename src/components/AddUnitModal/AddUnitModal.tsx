/**
 * @file AddUnitModal.tsx
 * A modal dialog component for adding or editing a dental unit (tooth) entry.
 * Provides form fields for tooth number, material, type, screw-retained status,
 * and job-level flag. Supports both creation and editing modes via initialValues.
 */

import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Checkbox, FormControlLabel
} from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';
import type { Tooth } from '../../types';
import teethCenters from '../../data/teethCenters.json';
import i11n from './AddUnitModal-i11n.json';
import './AddUnitModal.css';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { AutocompleteWithHide } from '../AutocompleteWithHide';

/**
 * Props for the AddUnitModal component.
 */
interface AddUnitModalProps {
    /** Whether the dialog is open. */
    open: boolean;
    /** Callback invoked when the dialog requests to close. */
    onClose: () => void;
    /** Callback invoked with the new unit data when the form is submitted. */
    onAdd: (newUnit: Omit<Tooth, '_tempId' | 'price' | 'status' | 'appliedRule'>) => void;
    /** Available material options for the Autocomplete field. */
    materials: string[];
    /** Available type options for the Autocomplete field. */
    types: string[];
    /** When set, the dialog operates in edit mode pre-filled with these values. */
    initialValues?: Tooth | null;
    /** Optional callback invoked when the user hides/restores a dropdown option. */
    onAttrListChange?: () => void;
}

/**
 * Modal dialog for adding a new tooth unit or editing an existing one.
 * Provides input fields for tooth number, material, type, screw retention,
 * and a job-level toggle. Supports free-form Autocomplete for material/type.
 *
 * @param props - The component props.
 * @param props.open - Controls the visibility of the dialog.
 * @param props.onClose - Callback to close the dialog.
 * @param props.onAdd - Callback invoked with the created/edited unit data.
 * @param props.materials - List of available material options.
 * @param props.types - List of available type options.
 * @param props.initialValues - Existing tooth data for edit mode; null/undefined for create mode.
 * @returns The rendered dialog component.
 */
export const AddUnitModal = ({ open, onClose, onAdd, materials, types, initialValues, onAttrListChange }: AddUnitModalProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language]?.[key] || key;
    
    const [number, setNumber] = useState<number | null>(null);
    const [material, setMaterial] = useState<string | null>(null);
    const [type, setType] = useState<string | null>(null);
    const [isScrewRetained, setIsScrewRetained] = useState(false);
    const [isJobLevel, setIsJobLevel] = useState(false);

    useEffect(() => {
        if (initialValues) {
            setNumber(initialValues.number);
            setMaterial(initialValues.material);
            setType(initialValues.type);
            setIsScrewRetained(!!initialValues.isScrewRetained);
            setIsJobLevel(initialValues.number === 0);
        } else {
            setNumber(null);
            setMaterial(null);
            setType(null);
            setIsScrewRetained(false);
            setIsJobLevel(false);
        }
    }, [initialValues, open]);

    const isToothNumberValid = isJobLevel || number === null || String(number) in teethCenters;

    const handleAdd = () => {
        if ((isJobLevel || (number !== null && isToothNumberValid)) && material && type) {
            onAdd({
                id: initialValues?.id || crypto.randomUUID(),
                number: isJobLevel ? 0 : number!,
                material,
                type,
                isScrewRetained
            });
            onClose();
            // Reset form
            setNumber(null);
            setMaterial(null);
            setType(null);
            setIsScrewRetained(false);
            setIsJobLevel(false);
        }
    };

    const isFormValid = (isJobLevel || (number !== null && isToothNumberValid)) && material && type;

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="sm" 
            fullWidth
            PaperProps={{ variant: 'outlined', elevation: 0 }}
        >
            <DialogTitle>{initialValues ? localT('editUnit') : localT('addUnit')}</DialogTitle>
            <DialogContent>
                <Box className="add-unit-modal-content">
                    <ResponsiveTooltip title={localT('tooltipIsJobLevel')}>
                        <FormControlLabel
                            control={
                                <Checkbox 
                                    checked={isJobLevel} 
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setIsJobLevel(checked);
                                        if (checked) {
                                            setNumber(0);
                                        } else {
                                            setNumber(null);
                                        }
                                    }} 
                                />
                            }
                            label={localT('isJobLevel')}
                        />
                    </ResponsiveTooltip>
                    <TextField
                        label={localT('toothNumber')}
                        type="number"
                        value={isJobLevel || number === null ? '' : number}
                        onChange={(e) => setNumber(e.target.value === '' ? null : parseInt(e.target.value))}
                        error={!isJobLevel && !isToothNumberValid}
                        helperText={!isJobLevel && !isToothNumberValid ? localT('invalidToothNumber') : ''}
                        disabled={isJobLevel}
                        fullWidth
                    />
                    <AutocompleteWithHide
                        category="material"
                        options={materials}
                        value={material}
                        onChange={(_, newValue) => setMaterial(newValue)}
                        renderInput={(params) => <TextField {...params} label={localT('material')} />}
                        freeSolo
                        onInputChange={(_, newInputValue) => {
                            setMaterial(newInputValue);
                        }}
                        onHiddenChange={onAttrListChange}
                    />
                    <AutocompleteWithHide
                        category="type"
                        options={types}
                        value={type}
                        onChange={(_, newValue) => setType(newValue)}
                        renderInput={(params) => <TextField {...params} label={localT('type')} />}
                        freeSolo
                        onInputChange={(_, newInputValue) => {
                            setType(newInputValue);
                        }}
                        onHiddenChange={onAttrListChange}
                    />
                    <ResponsiveTooltip title={localT('tooltipScrew')}>
                        <FormControlLabel
                            control={<Checkbox checked={isScrewRetained} onChange={(e) => setIsScrewRetained(e.target.checked)} />}
                            label={localT('screw')}
                        />
                    </ResponsiveTooltip>
                </Box>
            </DialogContent>
            <DialogActions>
                <ResponsiveTooltip title={localT('tooltipCancel')}>
                    <Button onClick={onClose} color="secondary">{localT('cancel')}</Button>
                </ResponsiveTooltip>
                {initialValues ? (
                    <ResponsiveTooltip title={localT('tooltipSave')}>
                        <Button onClick={handleAdd} variant="contained" color="primary" disabled={!isFormValid}>
                            {localT('save')}
                        </Button>
                    </ResponsiveTooltip>
                ) : (
                    <ResponsiveTooltip title={localT('tooltipAdd')}>
                        <Button onClick={handleAdd} variant="contained" color="primary" disabled={!isFormValid}>
                            {localT('add')}
                        </Button>
                    </ResponsiveTooltip>
                )}
            </DialogActions>
        </Dialog>
    );
};
