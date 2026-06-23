import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LanguageProvider } from '../context/LanguageContext';
import { TeethVisualizer } from '../components/TeethVisualizer';
import { getThemeOptions } from '../theme';
import type { Tooth } from '../types';

/**
 * Wraps a component tree with the providers required by TeethVisualizer.
 */
function WithProviders({ children }: { children: React.ReactNode }) {
    const theme = createTheme(getThemeOptions('light'));
    return (
        <ThemeProvider theme={theme}>
            <LanguageProvider>
                {children}
            </LanguageProvider>
        </ThemeProvider>
    );
}

function makeTooth(overrides: Partial<Tooth> = {}): Tooth {
    return {
        number: 11,
        material: 'Zircon',
        type: 'Crown',
        status: 'Calculated',
        price: 50000,
        currency: 'HUF',
        ...overrides,
    };
}

describe('TeethVisualizer', () => {
    test('renders standard FDI arch for a normal job with a known tooth', () => {
        const teeth = [makeTooth({ number: 11 })];
        render(
            <WithProviders>
                <TeethVisualizer teeth={teeth} />
            </WithProviders>
        );
        // The label "11" should be rendered
        expect(screen.getByText('11')).toBeDefined();
        // The "no teeth" message should NOT appear
        expect(screen.queryByText('No teeth to display')).toBeNull();
    });

    test('does not crash with number: 0 STL 3D Model teeth', () => {
        const teeth: Tooth[] = [
            makeTooth({ number: 11 }),
            {
                id: 'stl-1',
                number: 0,
                type: '3D Model',
                material: 'UpperJaw',
                status: 'Calculated',
                price: 0
            },
        ];
        render(
            <WithProviders>
                <TeethVisualizer teeth={teeth} />
            </WithProviders>
        );
        // Normal tooth label should still render
        expect(screen.getByText('11')).toBeDefined();
        // The "no teeth" message should NOT appear
        expect(screen.queryByText('No teeth to display')).toBeNull();
    });

    test('renders 3D Model chips for STL units', () => {
        const teeth: Tooth[] = [
            {
                id: 'stl-1',
                number: 0,
                type: '3D Model',
                material: 'UpperJaw',
                status: 'Calculated',
                price: 0
            },
            {
                id: 'stl-2',
                number: 0,
                type: '3D Model',
                material: 'LowerJaw',
                status: 'Calculated',
                price: 0
            },
        ];
        render(
            <WithProviders>
                <TeethVisualizer teeth={teeth} />
            </WithProviders>
        );
        // Should show "no teeth" since there are no known FDI teeth
        expect(screen.getByText('No teeth to display')).toBeDefined();
        // Should show the Models label
        expect(screen.getByText('Models')).toBeDefined();
        // Should show chip labels for each STL unit
        expect(screen.getByText('UpperJaw')).toBeDefined();
        expect(screen.getByText('LowerJaw')).toBeDefined();
    });

    test('does NOT render anything for number: 0 non-3D-Model teeth (job-level ghosts)', () => {
        const teeth: Tooth[] = [
            {
                number: 0,
                material: '-',
                type: '-',
                price: 0,
                status: 'Calculated',
                currency: 'HUF'
            },
        ];
        render(
            <WithProviders>
                <TeethVisualizer teeth={teeth} />
            </WithProviders>
        );
        // Should show "no teeth" because the ghost entry is excluded from the FDI arch
        expect(screen.getByText('No teeth to display')).toBeDefined();
        // Should NOT show any model chips
        expect(screen.queryByText('Models')).toBeNull();
    });

    test('shows no-teeth fallback when job has no known FDI teeth', () => {
        render(
            <WithProviders>
                <TeethVisualizer teeth={[]} />
            </WithProviders>
        );
        expect(screen.getByText('No teeth to display')).toBeDefined();
    });
});
