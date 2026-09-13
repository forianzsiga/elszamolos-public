/**
 * @file ModelLayersPanel.tsx
 * @brief Panel component for managing 3D model layer visibility.
 *
 * Renders a vertical list of all available model layers, each with a color swatch,
 * layer name, an eye-icon toggle for visibility, and an optional "Base" badge for
 * layers that are always visible.
 *
 * @see ModelViewer3D for the parent container
 * @see ModelLayersPanel-i11n.json for internationalization strings
 */

import { useCallback } from 'react';
import { Paper, Typography, IconButton, Box } from '@mui/material';
import { Visibility, VisibilityOff, Warning } from '@mui/icons-material';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './ModelLayersPanel-i11n.json';
import './ModelLayersPanel.css';

/**
 * @interface ModelLayersPanelProps
 * @brief Props for the ModelLayersPanel component.
 *
 * @property suffixes            - Array of all model suffix identifiers (e.g. `["lower", "upper", "crown"]`).
 * @property hiddenSuffixes      - Set of suffixes whose meshes are currently hidden (fresnel mode).
 * @property baseSuffixes        - Subset of suffixes that are "base" layers (always visible, locked).
 * @property layerColors         - Map from suffix to deterministic hex color string.
 * @property onToggleVisibility  - Callback invoked when the user toggles a layer's visibility.
 */
interface ModelLayersPanelProps {
    suffixes: string[];
    hiddenSuffixes: Set<string>;
    baseSuffixes: string[];
    layerColors: Map<string, string>;
    missingFiles?: Set<string>;
    onToggleVisibility: (suffix: string) => void;
}

/**
 * @component ModelLayersPanel
 * @brief Renders a layers management panel inside the 3D viewer canvas area.
 *
 * Each row shows:
 * - A color swatch (deterministic per suffix)
 * - The suffix name
 * - A "Base" badge for base layers (lower/upper/base)
 * - An eye-icon button to toggle visibility (disabled and shown as visible for base layers)
 *
 * @param props - Component properties (see ModelLayersPanelProps).
 * @returns JSX element for the layers panel.
 */
export const ModelLayersPanel = ({
    suffixes,
    hiddenSuffixes,
    baseSuffixes,
    layerColors,
    missingFiles,
    onToggleVisibility,
}: ModelLayersPanelProps) => {
    const { language } = useLanguage();
    const localT = useCallback(
        (key: string) =>
            (i11n as Record<string, Record<string, string>>)[language]?.[key] || key,
        [language]
    );

    const isBase = (suffix: string) => baseSuffixes.includes(suffix);
    const isVisible = (suffix: string) => !hiddenSuffixes.has(suffix);

    return (
        <Paper variant="outlined" className="layers-panel-root">
            <Box className="layers-panel-header">
                <Typography className="layers-panel-title">
                    {localT('layers')}
                </Typography>
            </Box>
            <Box className="layers-panel-scroll">
                {suffixes.map((suffix) => {
                    const base = isBase(suffix);
                    const visible = isVisible(suffix);
                    const color = layerColors.get(suffix) || '#888888';
                    const isMissing = missingFiles?.has(suffix) ?? false;

                    const ariaLabel = localT(visible ? 'hideLayer' : 'showLayer');

                    return (
                        <Box
                            key={suffix}
                            className={isMissing ? 'layer-row layer-row-missing' : 'layer-row'}
                        >
                            <Box
                                className="layer-color-swatch"
                                ref={(el: HTMLDivElement | null) => {
                                    if (el) el.style.setProperty('--swatch-color', color);
                                }}
                            />
                            <span className="layer-name">{suffix}</span>
                            {base && (
                                <span className="layer-base-badge">{localT('baseLayer')}</span>
                            )}
                            {isMissing && (
                                <ResponsiveTooltip title={localT('missingFile')}>
                                    <Warning
                                        className="layer-missing-icon"
                                        fontSize="small"
                                        aria-label={localT('missingFile')}
                                    />
                                </ResponsiveTooltip>
                            )}
                            <Box className="layer-visibility-switch">
                                {(() => {
                                    if (isMissing) {
                                        return (
                                            <ResponsiveTooltip title={localT('missingFile')}>
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        className="layer-visibility-button"
                                                        disabled={true}
                                                        aria-label={localT('missingFile')}
                                                    >
                                                        {visible ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
                                                    </IconButton>
                                                </span>
                                            </ResponsiveTooltip>
                                        );
                                    }
                                    if (visible) {
                                        return (
                                            <ResponsiveTooltip title={localT('hideLayer')}>
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        className="layer-visibility-button"
                                                        onClick={() => onToggleVisibility(suffix)}
                                                        aria-label={ariaLabel}
                                                    >
                                                        <Visibility fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </ResponsiveTooltip>
                                        );
                                    }
                                    return (
                                    <ResponsiveTooltip title={localT('showLayer')}>
                                        <span>
                                            <IconButton
                                                size="small"
                                                className="layer-visibility-button"
                                                onClick={() => onToggleVisibility(suffix)}
                                                aria-label={ariaLabel}
                                            >
                                                <VisibilityOff fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </ResponsiveTooltip>
                                );
                                })()}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Paper>
    );
};
