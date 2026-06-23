import { describe, it, expect } from 'vitest';
import type { Job } from '../../types';
import { formatMixedCurrency, getDominantValueSummary } from '../text';

describe('formatMixedCurrency', () => {
    it('should format mixed currency correctly', () => {
        const jobs: Job[] = [
            {
                id: 'job-1',
                patientName: 'John Doe',
                doctorName: 'Dr. Smith',
                fileName: 'file1.json',
                createdAt: new Date().toISOString(),
                unitCount: 2,
                status: 'Calculated',
                price: 150,
                teeth: [
                    { number: 11, material: 'Zirconia', type: 'Crown', price: 100, currency: 'HUF' },
                    { number: 12, material: 'Zirconia', type: 'Crown', price: 50, currency: 'EUR' }
                ],
                notes: ''
            }
        ];

        const result = formatMixedCurrency(jobs);
        expect(result).toBe('100 Ft + 50 €');
    });

    it('should handle only HUF or only EUR in mixed format', () => {
        const jobs: Job[] = [
            {
                id: 'job-1',
                patientName: 'John Doe',
                doctorName: 'Dr. Smith',
                fileName: 'file1.json',
                createdAt: new Date().toISOString(),
                unitCount: 1,
                status: 'Calculated',
                price: 100,
                teeth: [
                    { number: 11, material: 'Zirconia', type: 'Crown', price: 100, currency: 'HUF' }
                ],
                notes: ''
            }
        ];

        const result = formatMixedCurrency(jobs);
        expect(result).toBe('100 Ft');
    });
});

describe('getDominantValueSummary', () => {
    it('should return Unknown for undefined/null/empty teeth', () => {
        expect(getDominantValueSummary(undefined, 'material')).toEqual({ dominant: 'Unknown', overflow: [] });
        expect(getDominantValueSummary([], 'material')).toEqual({ dominant: 'Unknown', overflow: [] });
    });

    it('should return Unknown when all teeth have empty/Unknown values', () => {
        const teeth = [
            { material: '', type: 'Crown' },
            { material: 'Unknown', type: 'Crown' }
        ];
        expect(getDominantValueSummary(teeth, 'material')).toEqual({ dominant: 'Unknown', overflow: [] });
    });

    it('should return the single value when all teeth share the same value', () => {
        const teeth = [
            { material: 'Zirconia', type: 'Crown' },
            { material: 'Zirconia', type: 'Crown' }
        ];
        expect(getDominantValueSummary(teeth, 'material')).toEqual({ dominant: 'Zirconia', overflow: [] });
    });

    it('should return the most common value and overflow for mixed values', () => {
        const teeth = [
            { material: 'Zirconia', type: 'Crown' },
            { material: 'Zirconia', type: 'Crown' },
            { material: 'PMMA', type: 'Bridge' },
            { material: 'Titanium', type: 'Abutment' }
        ];
        const result = getDominantValueSummary(teeth, 'material');
        expect(result.dominant).toBe('Zirconia');
        expect(result.overflow).toHaveLength(2);
        // Overflow sorted by count desc then alpha
        expect(result.overflow[0]).toEqual({ value: 'PMMA', count: 1 });
        expect(result.overflow[1]).toEqual({ value: 'Titanium', count: 1 });
    });

    it('should sort overflow by count desc then alphabetically', () => {
        const teeth = [
            { material: 'Zirconia', type: 'Crown' },
            { material: 'PMMA', type: 'Crown' },
            { material: 'PMMA', type: 'Crown' },
            { material: 'Titanium', type: 'Crown' }
        ];
        const result = getDominantValueSummary(teeth, 'material');
        expect(result.dominant).toBe('PMMA');
        expect(result.overflow).toHaveLength(2);
        // Zirconia (count 1) and Titanium (count 1) sorted alphabetically
        expect(result.overflow[0]).toEqual({ value: 'Titanium', count: 1 });
        expect(result.overflow[1]).toEqual({ value: 'Zirconia', count: 1 });
    });

    it('should break ties alphabetically for dominant value', () => {
        const teeth = [
            { material: 'Zirconia', type: 'Crown' },
            { material: 'PMMA', type: 'Crown' }
        ];
        const result = getDominantValueSummary(teeth, 'material');
        expect(result.dominant).toBe('PMMA'); // PMMA < Zirconia alphabetically
        expect(result.overflow).toHaveLength(1);
        expect(result.overflow[0]).toEqual({ value: 'Zirconia', count: 1 });
    });

    it('should handle type field identically', () => {
        const teeth = [
            { material: 'Zirconia', type: 'Crown' },
            { material: 'Zirconia', type: 'Crown' },
            { material: 'Zirconia', type: 'Bridge' }
        ];
        const result = getDominantValueSummary(teeth, 'type');
        expect(result.dominant).toBe('Crown');
        expect(result.overflow).toHaveLength(1);
        expect(result.overflow[0]).toEqual({ value: 'Bridge', count: 1 });
    });

    it('should filter out Unknown values when counting', () => {
        const teeth = [
            { material: 'Zirconia', type: 'Crown' },
            { material: 'Unknown', type: 'Crown' },
            { material: 'Unknown', type: 'Crown' }
        ];
        const result = getDominantValueSummary(teeth, 'material');
        expect(result.dominant).toBe('Zirconia');
        expect(result.overflow).toHaveLength(0);
    });

    it('should handle single tooth', () => {
        const teeth = [
            { material: 'Gold', type: 'Inlay' }
        ];
        expect(getDominantValueSummary(teeth, 'material')).toEqual({ dominant: 'Gold', overflow: [] });
        expect(getDominantValueSummary(teeth, 'type')).toEqual({ dominant: 'Inlay', overflow: [] });
    });

    it('should ignore teeth ignored by an ignoreUnit rule (isIgnored === true)', () => {
        const teeth = [
            { material: 'Healthy', type: 'Filling', isIgnored: true },
            { material: 'Healthy', type: 'Filling', isIgnored: true },
            { material: 'Healthy', type: 'Filling', isIgnored: true },
            { material: 'Zirconia', type: 'Crown' }
        ];
        const result = getDominantValueSummary(teeth, 'material');
        expect(result).toEqual({ dominant: 'Zirconia', overflow: [] });
    });

    it('should return Unknown when all non-ignored teeth are empty/Unknown', () => {
        const teeth = [
            { material: 'Healthy', type: 'Filling', isIgnored: true },
            { material: '', type: 'Crown' },
            { material: 'Unknown', type: 'Crown' }
        ];
        expect(getDominantValueSummary(teeth, 'material')).toEqual({ dominant: 'Unknown', overflow: [] });
    });
});
