import { memo, useMemo, useRef, useEffect } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import type { Tooth } from '../../types';
import { stringToColor } from '../../utils/color';
import teethCenters from '../../data/teethCenters.json';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './TeethVisualizer-i11n.json';
import './TeethVisualizer.css';

/**
 * Props for the {@link TeethVisualizer} component.
 */
interface TeethVisualizerProps {
    /** Array of teeth/units to render on the dental arch chart. */
    teeth: Tooth[];
    /** Currently hovered tooth number string (for cross-highlighting). */
    hoveredTooth?: string | null;
    /** Callback fired when the user hovers over a tooth label. */
    onHoverTooth?: (toothNum: string | null) => void;
    /** Callback to clear the hovered row ID (for table-row-only hover isolation). */
    onHoverRowId?: (rowId: string | null) => void;
}

/**
 * Computes the relative luminance of a hex color string.
 * Uses the WCAG relative luminance formula.
 * @param hex - Hex color string (e.g., "#FF0000").
 * @returns Luminance value between 0 (darkest) and 1 (lightest).
 */
function getLuminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * A single SVG-based mask layer for a tooth on the dental arch chart.
 * Renders either the base outline (mask) or the coloured filling layer.
 */
const ToothLayer = memo(({
    number,
    data,
    isFilling = false,
    isHovered = false
}: {
    number: string;
    data?: Tooth;
    isFilling?: boolean;
    isHovered?: boolean;
}) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const getBgColor = () => {
        if (!isFilling) {
            return isDark ? '#e0e0e0' : '#bdbdbd';
        }
        if (!data) return 'transparent';
        const seed = `${data.type}-${data.material}`;
        const raw = stringToColor(seed);
        const lum = getLuminance(raw);
        if (!isDark && lum > 0.85) {
            return stringToColor(seed, 100, 65);
        }
        if (isDark && lum < 0.15) {
            return stringToColor(seed, 55, 100);
        }
        return raw;
    };
    const bgColor = getBgColor();

    const isLower = number.startsWith('3') || number.startsWith('4');

    if (isFilling && bgColor === 'transparent') return null;

    const isHidden = isFilling && data?.isIgnored === true;
    const layerClassNames = [
        'tooth-layer',
        isLower ? 'lower' : 'upper',
        isFilling ? 'filling' : 'base',
        isHidden ? 'hidden' : '',
        isHovered ? 'hovered' : '',
        `tooth-mask-${number}${isFilling ? '-filling' : ''}`
    ].filter(Boolean).join(' ');

    return (
        <Box
            className={layerClassNames}
            bgcolor={bgColor}
        />
    );
});

/**
 * Dental arch chart visualiser that renders:
 * - A full FDI dental arch with SVG mask layers for each tooth position.
 * - Colour-coded fillings based on tooth type, material, and status.
 * - Hover-able tooth number labels with tooltips.
 * - A "no data" fallback text when no known FDI teeth are present.
 */
export const TeethVisualizer = memo(({ teeth, hoveredTooth, onHoverTooth, onHoverRowId }: TeethVisualizerProps) => {
    const { language } = useLanguage();
    const translations = i11n as Record<'en' | 'hu', Record<string, string>>;
    const localT = (key: string) => translations[language as 'en' | 'hu']?.[key] || key;

    const teethCentersMap = teethCenters as Record<string, { x: number; y: number }>;
    const innerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = innerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            const w = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
            el.style.setProperty('--chart-width', `${w}`);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    /**
     * Teeth that belong to known FDI positions (number is in teethCenters.json).
     */
    const knownTeeth = useMemo(() => {
        return teeth.filter(t => t.number !== 0 && teethCentersMap[String(t.number)] != null);
    }, [teeth, teethCentersMap]);

    /**
     * 3D Model / STL units (number === 0, type === '3D Model').
     * Job-level ghost entries (number === 0, not 3D Model) are excluded.
     */
    const hasKnownFdiTeeth = knownTeeth.length > 0;

    const teethMap = useMemo(() => {
        return new Map(teeth.map(t => [t.number.toString(), t]));
    }, [teeth]);

    const renderHoverHalo = () => {
        if (!hoveredTooth || hoveredTooth === '0' || !teethMap.has(hoveredTooth)) {
            return null;
        }
        const tooth = teethMap.get(hoveredTooth)!;
        const toothColor = stringToColor(`${tooth.type}-${tooth.material}`);
        return (
            <Box
                className={`halo-layer tooth-pos-${hoveredTooth}`}
                bgcolor={toothColor}
            />
        );
    };

    const renderArch = () => {
        if (!hasKnownFdiTeeth) {
            return (
                <Typography
                    variant="body2"
                    className="no-teeth-message"
                >
                    {localT('noTeeth')}
                </Typography>
            );
        }

        return (
            <>
                {renderHoverHalo()}

                {Object.keys(teethCentersMap).map((toothNum) => (
                    <Box key={toothNum}>
                        <ToothLayer
                            number={toothNum}
                            isHovered={hoveredTooth === toothNum}
                        />
                        <ToothLayer
                            number={toothNum}
                            data={teethMap.get(toothNum)}
                            isFilling
                            isHovered={hoveredTooth === toothNum}
                        />
                    </Box>
                ))}

                {Object.entries(teethCentersMap).map(([num]) => {
                    const data = teethMap.get(num);
                    const isLower = num.startsWith('3') || num.startsWith('4');

                    return (
                        <ResponsiveTooltip
                            key={num}
                            title={data ? `${num}: ${data.material} - ${data.type}` : `${localT('tooth')} ${num}`}
                        >
                            <Typography
                                className={`tooth-label tooth-pos-${num} ${isLower ? 'lower' : 'upper'} ${data ? 'has-data' : 'no-data'}`}
                                onMouseEnter={() => {
                                    onHoverTooth?.(num);
                                    onHoverRowId?.(null);
                                }}
                                onMouseLeave={() => onHoverTooth?.(null)}
                            >
                                {num}
                            </Typography>
                        </ResponsiveTooltip>
                    );
                })}
            </>
        );
    };

    return (
        <Box className="teeth-visualizer-container">
            <Box className="teeth-visualizer-inner" ref={innerRef}>
                {renderArch()}
            </Box>
        </Box>
    );
});
