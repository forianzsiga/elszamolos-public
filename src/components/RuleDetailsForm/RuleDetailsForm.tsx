import { Paper, Typography, Box, Button, TextField, FormControlLabel, Switch, CircularProgress } from '@mui/material';
import { Launch, CheckCircle, DoDisturb, HelpOutline, Warning } from '@mui/icons-material';
import { Virtuoso } from 'react-virtuoso';
import { type NavigateFunction } from 'react-router-dom';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import type { TariffRule, TariffRuleKind } from '../../types';
import type { ActiveItem } from '../RuleEditor/RuleEditorUtils';
import Grid from '@mui/material/Grid2';
import './RuleDetailsForm.css';

export const ExclusionList = ({ 
    exclusions, 
    localT, 
    navigate, 
    onRemoveExclusion, 
    initialRule 
}: { 
    exclusions: ActiveItem[];
    localT: (key: string, params?: Record<string, string>) => string;
    navigate: NavigateFunction;
    onRemoveExclusion?: (ruleId: string, jobId: string, toothId?: string) => void;
    initialRule: TariffRule | null;
}) => (
    <Paper variant="outlined" className="active-section-paper">
        <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="error">
            {localT('exclusions')} ({exclusions.length}):
        </Typography>
        <Box className="exclusion-list">
            {exclusions.map(ex => (
                <Box key={ex.id} className="exclusion-item">
                    <Box className="flex-align-center-gap-1-5">
                        <DoDisturb fontSize="small" color="error" />
                        <Box>
                            <Typography variant="body2" fontWeight="bold">
                                {ex.type === 'job' 
                                    ? localT('entireJob', { projectId: ex.projectId })
                                    : localT('tooth', { toothNumber: String(ex.toothNumber), projectId: ex.projectId })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {localT('patientDoctor', { patientName: ex.patientName, doctorName: ex.doctorName })}
                            </Typography>
                        </Box>
                    </Box>
                    <Box className="flex-gap-1">
                        <ResponsiveTooltip title={localT('jumpToJobTooltip')}>
                            <Button
                                variant="outlined"
                                color="secondary"
                                size="small"
                                startIcon={<Launch />}
                                onClick={() => {
                                    navigate('/jobs', { 
                                        state: { 
                                            highlightJobId: ex.jobId, 
                                            expandJob: true, 
                                            openEditModal: true 
                                        } 
                                    });
                                }}
                            >
                                {localT('jumpToJob')}
                            </Button>
                        </ResponsiveTooltip>
                        {onRemoveExclusion && initialRule && (
                            <ResponsiveTooltip title={localT('removeExclusionTooltip')}>
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    size="small"
                                    onClick={() => onRemoveExclusion(initialRule.id, ex.jobId, ex.toothId)}
                                >
                                    {localT('removeExclusion')}
                                </Button>
                            </ResponsiveTooltip>
                        )}
                    </Box>
                </Box>
            ))}
        </Box>
    </Paper>
);

export const ApplicationList = ({
    applications,
    localT,
    navigate,
    ruleKind,
    isRecalculating = false,
}: {
    applications: ActiveItem[];
    localT: (key: string, params?: Record<string, string>) => string;
    navigate: NavigateFunction;
    ruleKind?: TariffRuleKind;
    /**
     * When `true`, overlays a spinner + "Recalculating…" message on top of
     * the application list. Sourced from the debounced preview recalc
     * triggered by field blurs in the rule editor.
     */
    isRecalculating?: boolean;
}) => {
    const isCalculatedByDefault = !ruleKind || ruleKind === 'base' || ruleKind === 'ignoreUnit';
    const allItemsCalculated = isCalculatedByDefault || applications.every(app => app.isCalculatedByBaseRule);

    return (
        <Paper
            variant="outlined"
            className="active-section-paper"
            sx={{ position: 'relative' }}
        >
            <Typography
                variant="subtitle2"
                gutterBottom
                fontWeight="bold"
                color={allItemsCalculated ? "success.main" : "warning.main"}
                className="section-title"
            >
                {localT('applications')} ({applications.length}):
            </Typography>
            <Box className="application-list-container">
                <Virtuoso
                    className="virtuoso-list"
                    data={applications}
                    itemContent={(_index, app) => {
                        const isItemCalculated = isCalculatedByDefault || app.isCalculatedByBaseRule;
                        return (
                            <Box key={app.id} className="application-item">
                                <Box className="flex-align-center-gap-1-5">
                                    {isItemCalculated ? (
                                        <CheckCircle fontSize="small" color="success" />
                                    ) : (
                                        <ResponsiveTooltip title={localT('ruleDoesNotCalculate')}>
                                            <Warning fontSize="small" sx={{ color: 'warning.main' }} />
                                        </ResponsiveTooltip>
                                    )}
                                    <Box>
                                        <Typography variant="body2" fontWeight="bold">
                                            {app.type === 'job'
                                                ? localT('entireJob', { projectId: app.projectId })
                                                : localT('tooth', { toothNumber: String(app.toothNumber), projectId: app.projectId })}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {localT('patientDoctor', { patientName: app.patientName, doctorName: app.doctorName })}
                                        </Typography>
                                    </Box>
                                </Box>
                                <ResponsiveTooltip title={localT('jumpToJobTooltip')}>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        size="small"
                                        startIcon={<Launch />}
                                        onClick={() => {
                                            navigate('/jobs', {
                                                state: {
                                                    highlightJobId: app.jobId,
                                                    expandJob: true,
                                                    openEditModal: true
                                                }
                                            });
                                        }}
                                    >
                                        {localT('jumpToJob')}
                                    </Button>
                                </ResponsiveTooltip>
                            </Box>
                        );
                    }}
                />
            </Box>
            {isRecalculating && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'background.paper',
                        opacity: 0.92,
                        zIndex: 1,
                    }}
                    data-testid="application-list-recalc-overlay"
                >
                    <CircularProgress size={32} />
                    <Typography variant="body2" sx={{ mt: 2 }}>
                        {localT('recalculating')}
                    </Typography>
                </Box>
            )}
        </Paper>
    );
};

interface RuleFormFieldsProps {
    name: string;
    setName: (val: string) => void;
    label: string;
    setLabel: (val: string) => void;
    priority: number | undefined;
    isSystem: boolean;
    setIsSystem: (val: boolean) => void;
    t: (key: string) => string;
    localT: (key: string, params?: Record<string, string>) => string;
    nameError: string;
    setNameError: (val: string) => void;
    setLabelError: (val: string) => void;
    validateName: () => void;
    onNameChange?: () => void;
}

export const RuleFormFields = ({
    name, setName, label, setLabel, priority,
    isSystem, setIsSystem,
    t, localT, nameError, setNameError, setLabelError,
    validateName, onNameChange
}: RuleFormFieldsProps) => (
    <Grid container spacing={2} className="margin-bottom-3">
        <Grid size={{ xs: 12, md: 4 }}>
            <TextField
                fullWidth
                label={t('tariff.editor.ruleName')}
                value={name}
                onChange={(e) => {
                    setName(e.target.value);
                    if (e.target.value.trim()) setNameError('');
                }}
                onBlur={() => {
                    validateName();
                    if (onNameChange) onNameChange();
                }}
                error={!!nameError}
                helperText={nameError}
            />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
            <TextField
                fullWidth
                label={t('tariff.editor.invoiceLabel')}
                value={label}
                onChange={(e) => {
                    setLabel(e.target.value);
                    if (e.target.value) setLabelError('');
                }}
                helperText={t('tariff.editor.invoiceLabelHint')}
            />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
            <TextField
                fullWidth
                disabled
                label={t('tariff.editor.priority')}
                value={priority ?? ''}
                helperText={t('tariff.editor.priorityHint')}
            />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }} className="flex-gap-1">
            <FormControlLabel
                control={
                    <Switch
                        checked={isSystem}
                        onChange={(e) => setIsSystem(e.target.checked)}
                        color="warning"
                    />
                }
                label={
                    <Box className="flex-align-center-gap-1">
                        <Box>
                            <Typography variant="body2" component="span" fontWeight="bold">
                                {t('tariff.editor.systemRule')}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary">
                                {t('tariff.editor.systemRuleHint')}
                            </Typography>
                        </Box>
                        <ResponsiveTooltip title={localT('systemRuleTooltip')}>
                            <HelpOutline fontSize="small" color="action" />
                        </ResponsiveTooltip>
                    </Box>
                }
            />
        </Grid>
    </Grid>
);
