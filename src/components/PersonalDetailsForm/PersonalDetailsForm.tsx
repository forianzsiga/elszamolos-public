/** @file PersonalDetailsForm.tsx - Form component for managing personal/business details with Google Drive integration */

import { useState, useEffect } from 'react';
import { TextField, Typography, Paper, Grid, Button, Box, CircularProgress } from '@mui/material';
import { Save, CloudDownload } from '@mui/icons-material';
import type { PersonalDetails } from '../../types';
import { googleDriveService } from '../../services/googleDrive';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './PersonalDetailsForm-i11n.json';
import './PersonalDetailsForm.css';

/**
 * Props for the PersonalDetailsForm component
 * @interface PersonalDetailsFormProps
 */
interface PersonalDetailsFormProps {
    /** Current personal details data */
    details: PersonalDetails;
    /** Callback function invoked when details are changed */
    onDetailsChange: (details: PersonalDetails) => void;
}

/**
 * Form component for editing personal/business details with Google Drive integration
 * 
 * @component
 * @example
 * ```tsx
 * <PersonalDetailsForm 
 *   details={initialDetails} 
 *   onDetailsChange={(newDetails) => console.log(newDetails)} 
 * />
 * ```
 * 
 * @param {PersonalDetailsFormProps} props - Component properties
 * @param {PersonalDetails} props.details - Initial personal details data
 * @param {Function} props.onDetailsChange - Callback when details change
 * @returns {JSX.Element} The rendered form component
 */
export const PersonalDetailsForm = ({ details, onDetailsChange }: PersonalDetailsFormProps) => {
    const { language } = useLanguage();
    const tData = i11n as Record<'en' | 'hu', Record<string, string>>;
    const localT = (key: string) => tData[language as 'en' | 'hu']?.[key] || key;
    const [formState, setFormState] = useState<PersonalDetails>(details);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setFormState(details);
    }, [details]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState((prevState: PersonalDetails) => ({
            ...prevState,
            [name]: name === 'taxRate' ? parseFloat(value) || 0 : value,
        }));
    };

    const handleBlur = () => {
        onDetailsChange(formState);
    };

    const handleSaveToDrive = async () => {
        setIsSaving(true);
        try {
            await googleDriveService.loadScripts();
            await googleDriveService.signIn();
            await googleDriveService.uploadPersonalDetails(formState);
            alert(localT('alert.saved'));
        } catch (error) {
            console.error('Error saving to Google Drive:', error);
            alert(localT('alert.saveError'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadFromDrive = async () => {
        setIsLoading(true);
        try {
            await googleDriveService.loadScripts();
            await googleDriveService.signIn();
            const file = await googleDriveService.findFileByName('personalDetails.json');
            if (file) {
                const loadedDetails = await googleDriveService.downloadPersonalDetails(file.id) as PersonalDetails;
                onDetailsChange(loadedDetails);
                alert(localT('alert.loaded'));
            } else {
                alert(localT('alert.noFile'));
            }
        } catch (error) {
            console.error('Error loading from Google Drive:', error);
            alert(localT('alert.loadError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Paper variant="outlined" className="personal-details-form-container">
            <Box className="personal-details-header-container">
                <Typography variant="h6" gutterBottom>{localT('title')}</Typography>
                <Box className="button-container">
                    <ResponsiveTooltip title={localT('tooltip.loadFromDrive')}>
                        <Button
                            variant="outlined"
                            startIcon={isLoading ? <CircularProgress size={20} /> : <CloudDownload />}
                            onClick={handleLoadFromDrive}
                            disabled={isLoading || isSaving}
                        >
                            {localT('loadDrive')}
                        </Button>
                    </ResponsiveTooltip>
                    <ResponsiveTooltip title={localT('tooltip.saveToDrive')}>
                        <Button
                            variant="contained"
                            startIcon={isSaving ? <CircularProgress size={20} /> : <Save />}
                            onClick={handleSaveToDrive}
                            disabled={isLoading || isSaving}
                        >
                            {localT('saveDrive')}
                        </Button>
                    </ResponsiveTooltip>
                </Box>
            </Box>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="companyName"
                        label={localT('companyName')}
                        value={formState.companyName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="organization"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="streetAddress"
                        label={localT('streetAddress')}
                        value={formState.streetAddress}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="street-address"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="cityStateZip"
                        label={localT('cityStateZip')}
                        value={formState.cityStateZip}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="postal-code"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="phone"
                        label={localT('phone')}
                        value={formState.phone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="tel"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="fax"
                        label={localT('fax')}
                        value={formState.fax}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="off"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="website"
                        label={localT('website')}
                        value={formState.website}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="url"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="contactName"
                        label={localT('contactName')}
                        value={formState.contactName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="name"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="contactPhone"
                        label={localT('contactPhone')}
                        value={formState.contactPhone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="tel"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="contactEmail"
                        label={localT('contactEmail')}
                        value={formState.contactEmail}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="email"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        fullWidth
                        name="taxRate"
                        label={localT('taxRate')}
                        type="number"
                        value={formState.taxRate}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        autoComplete="off"
                    />
                </Grid>
            </Grid>
        </Paper>
    );
};
