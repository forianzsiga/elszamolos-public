/**
 * @file MaterialCell.spec.tsx
 * @description Basic render tests for the MaterialCell component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import type { DominantValueSummary } from '../../../utils/text';

// Mock the LanguageContext to always return English.
vi.mock('../../../context/LanguageContext', () => ({
    useLanguage: () => ({ language: 'en', t: (key: string) => key }),
}));

// Mock the ResponsiveTooltip to just render children + title in a data attribute.
vi.mock('../../ResponsiveTooltip', () => ({
    ResponsiveTooltip: ({ title, children }: { title: string; children: React.ReactElement }) => (
        <span data-testid="responsive-tooltip" data-tooltip-title={title}>
            {children}
        </span>
    ),
}));

import { MaterialCell } from '../MaterialCell';

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('MaterialCell', () => {
    it('should render just the dominant value when there is no overflow', () => {
        const summary: DominantValueSummary = { dominant: 'Zirconia', overflow: [] };
        renderWithTheme(<MaterialCell summary={summary} />);
        expect(screen.getByText('Zirconia')).toBeTruthy();
        // No chip for overflow
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('should render dominant value and +N chip when overflow exists', () => {
        const summary: DominantValueSummary = {
            dominant: 'Zirconia',
            overflow: [
                { value: 'PMMA', count: 2 },
                { value: 'Titanium', count: 1 },
            ],
        };
        renderWithTheme(<MaterialCell summary={summary} />);
        expect(screen.getByText('Zirconia')).toBeTruthy();
        expect(screen.getByText('+2')).toBeTruthy(); // 2 distinct overflow items
    });

    it('should pass the correct tooltip title to ResponsiveTooltip', () => {
        const summary: DominantValueSummary = {
            dominant: 'Zirconia',
            overflow: [
                { value: 'PMMA', count: 2 },
                { value: 'Titanium', count: 1 },
            ],
        };
        renderWithTheme(<MaterialCell summary={summary} />);
        const tooltip = screen.getByTestId('responsive-tooltip');
        const title = tooltip.getAttribute('data-tooltip-title');
        expect(title).toContain('PMMA (2 pcs)');
        expect(title).toContain('Titanium (1 pcs)');
    });
});
