/**
 * @file FPSMonitor.tsx
 *
 * Real-time performance monitor component that displays the current
 * frame rate (FPS) in a small overlay panel. Styled with MUI Paper
 * and Typography, the indicator colour changes based on performance:
 * green (>=55 FPS), orange (>=30 FPS), or red (<30 FPS).
 *
 * Includes a per-component i18n translation helper backed by
 * {@link FPSMonitor-i11n.json}.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Typography, Paper } from '@mui/material';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './FPSMonitor-i11n.json';
import './FPSMonitor.css';

/**
 * FPSMonitor component.
 *
 * Renders a small floating paper panel that displays the current
 * frames-per-second (FPS) value, computed via
 * `requestAnimationFrame` callbacks, and colour-coded to indicate
 * performance tiers.
 *
 * @returns A Paper element containing the FPS reading and a
 *          "Performance" label, wired to the active locale via
 *          {@link useLanguage}.
 */
export const FPSMonitor = () => {
    const [fps, setFps] = useState(0);
    const { language } = useLanguage();
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());
    const requestRef = useRef<number>();

    /**
     * Localised translation helper.
     *
     * Resolves `key` against the per-component translation dictionary
     * (`FPSMonitor-i11n.json`) for the currently active language. Falls
     * back to the raw `key` string when no translation is found.
     *
     * @param key - The translation key to look up.
     * @returns The translated string or, as a fallback, `key` itself.
     */
    const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language]?.[key] || key;

    /**
     * FPS calculator callback.
     *
     * Invoked by `requestAnimationFrame` on every frame. Counts frames
     * and, once at least one second has elapsed, updates the displayed
     * FPS value and resets the counters.
     *
     * @param time - The DOMHighResTimeStamp provided by
     *               `requestAnimationFrame` (milliseconds).
     * @returns void. The result of `requestAnimationFrame` is stored
     *          in `requestRef` for later cleanup.
     */
    const calculateFPS = useCallback((time: number) => {
        frameCount.current++;
        if (time >= lastTime.current + 1000) {
            setFps(Math.round((frameCount.current * 1000) / (time - lastTime.current)));
            lastTime.current = time;
            frameCount.current = 0;
        }
        requestRef.current = requestAnimationFrame(calculateFPS);
    }, []);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(calculateFPS);
        return () => {
            if (requestRef.current !== undefined) cancelAnimationFrame(requestRef.current);
        };
    }, [calculateFPS]);

    /**
     * Maps an FPS value to a status class.
     *
     * - `>= 55` → 'high'
     * - `>= 30` → 'medium'
     * - `< 30`  → 'low'
     *
     * @param val - The current FPS reading.
     * @returns A CSS class name representing the performance tier.
     */
    const getStatusClass = (val: number) => {
        if (val >= 55) return 'high';
        if (val >= 30) return 'medium';
        return 'low';
    };

    return (
        <Paper
            elevation={4}
            className="fps-monitor-paper"
        >
            <Typography variant="caption" display="block" className="fps-monitor-label">
                {localT('performance')}
            </Typography>
            <Typography variant="h6" className={`fps-monitor-value ${getStatusClass(fps)}`}>
                {fps} {localT('fps')}
            </Typography>
        </Paper>
    );
};
