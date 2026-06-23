import { describe, it, expect } from 'vitest';
import { processApplications } from '../RuleEditorUtils';
import type { Job, TariffRule, Tooth } from '../../../types';

const createMockTooth = (number: number, overrides: Partial<Tooth> = {}): Tooth => ({
    number,
    material: 'Zircon',
    type: 'Crown',
    ...overrides
});

const createMockJob = (overrides: Partial<Job> = {}): Job => ({
    id: 'job-1',
    patientName: 'Timi',
    doctorName: 'Dr. Maria Rodna',
    fileName: 'job1.dentalProject',
    createdAt: new Date().toISOString(),
    teeth: [],
    unitCount: 0,
    status: 'Calculated',
    price: 0,
    currency: 'HUF',
    notes: '',
    ...overrides
});

const ignoreUnitRule: TariffRule = {
    id: 'hide-attr-1',
    name: 'Hide 3D modeldie from dropdowns',
    label: 'Hide modeldie',
    priority: 14,
    kind: 'ignoreUnit',
    conditions: [{ field: 'material', operator: 'contains', value: 'modeldie' }],
    action: {}
};

describe('processApplications', () => {
    it('marks tooth application as calculated when a base rule also applies', () => {
        const tooth: Tooth = createMockTooth(21, {
            status: 'Calculated',
            price: 100,
            basePrice: 100,
            currency: 'HUF',
            appliedRuleId: 'base-1',
            appliedRuleName: 'Zircon Crown base',
            appliedRuleLabel: 'Crown',
            appliedRulePriority: 1,
            appliedRules: [
                { id: 'base-1', name: 'Zircon Crown base', label: 'Crown', priority: 1, kind: 'base', amount: 100, currency: 'HUF' },
                { id: 'hide-attr-1', name: 'Hide 3D modeldie from dropdowns', label: 'Hide modeldie', priority: 14, kind: 'ignoreUnit', amount: 0, currency: 'HUF' }
            ]
        });
        const job = createMockJob({ teeth: [tooth], unitCount: 1 });

        const result = processApplications(ignoreUnitRule, [job]);

        expect(result).toHaveLength(1);
        expect(result[0].isCalculatedByBaseRule).toBe(true);
        expect(result[0].type).toBe('tooth');
    });

    it('marks tooth application as not calculated when only ignoreUnit applies', () => {
        const tooth: Tooth = createMockTooth(21, {
            status: 'Calculated',
            price: 0,
            basePrice: 0,
            currency: 'HUF',
            appliedRules: [
                { id: 'hide-attr-1', name: 'Hide 3D modeldie from dropdowns', label: 'Hide modeldie', priority: 14, kind: 'ignoreUnit', amount: 0, currency: 'HUF' }
            ]
        });
        const job = createMockJob({ teeth: [tooth], unitCount: 1 });

        const result = processApplications(ignoreUnitRule, [job]);

        expect(result).toHaveLength(1);
        expect(result[0].isCalculatedByBaseRule).toBe(false);
    });

    it('does not mark tooth as calculated when the base rule is excluded', () => {
        const tooth: Tooth = createMockTooth(21, {
            status: 'Pending',
            price: 0,
            basePrice: 0,
            currency: 'HUF',
            appliedRuleId: 'base-1',
            appliedRules: [
                { id: 'base-1', name: 'Zircon Crown base', label: 'Crown', priority: 1, kind: 'base', amount: 100, currency: 'HUF', isExcluded: true },
                { id: 'hide-attr-1', name: 'Hide 3D modeldie from dropdowns', label: 'Hide modeldie', priority: 14, kind: 'ignoreUnit', amount: 0, currency: 'HUF' }
            ]
        });
        const job = createMockJob({ teeth: [tooth], unitCount: 1 });

        const result = processApplications(ignoreUnitRule, [job]);

        expect(result).toHaveLength(1);
        expect(result[0].isCalculatedByBaseRule).toBe(false);
    });

    it('returns empty list when no rule is provided', () => {
        const job = createMockJob();
        const result = processApplications(null, [job]);
        expect(result).toEqual([]);
    });
});
