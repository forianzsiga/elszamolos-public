import { describe, it, expect } from 'vitest';
import { calculateJobPrice } from './pricingEngine';
import type { Job, TariffRule, Tooth } from '../types';

const createMockJob = (overrides?: Partial<Job>): Job => ({
    id: 'test-job',
    patientName: 'Test Patient',
    doctorName: 'Gergő',
    fileName: 'test.dentalProject',
    createdAt: new Date().toISOString(),
    teeth: [],
    unitCount: 0,
    status: 'Pending',
    price: 0,
    currency: 'HUF',
    notes: '',
    ...overrides
});

const make3DTooth = (number: number, material: 'LowerJaw' | 'UpperJaw', id: string): Tooth => ({
    id,
    number,
    material,
    type: '3D Model'
});

/**
 * These tests cover the regression described in issue #63: a `jobExtra`
 * rule whose conditions reference tooth-level fields (material, type) was
 * never matching because the engine used a job-level context that omitted
 * those fields. The fix evaluates the rule against each tooth in the job
 * and fires once when at least one tooth matches.
 */
describe('jobExtra evaluation with tooth-level conditions (issue #63)', () => {
    const gipszmodellGergo: TariffRule = {
        id: 'gipszmodell-gergo',
        name: 'Gipszmodell Gergő',
        label: 'Gipszmodell Gergő',
        kind: 'jobExtra',
        priority: 23,
        conditions: [
            { field: 'material', operator: 'isOneOf', value: ['LowerJaw', 'UpperJaw'] },
            { field: 'type', operator: 'equals', value: '3D Model' },
            { field: 'doctorName', operator: 'equals', value: 'Gergő' }
        ],
        action: { value: 1000, currency: 'HUF' }
    };

    const baseFor3D: TariffRule = {
        id: 'base-3d',
        name: '3D Base',
        label: '3D Base',
        kind: 'base',
        priority: 24,
        conditions: [
            { field: 'material', operator: 'isOneOf', value: ['LowerJaw', 'UpperJaw'] },
            { field: 'type', operator: 'equals', value: '3D Model' },
            { field: 'doctorName', operator: 'equals', value: 'Gergő' }
        ],
        action: { value: 5000, currency: 'HUF' }
    };

    it('fires once per job when at least one tooth matches the jobExtra conditions', () => {
        // The user has 7 jobs, each with at least one 3D Model tooth on the
        // LowerJaw or UpperJaw material, all assigned to doctor Gergő. The
        // jobExtra rule should fire on every job.
        const jobs: Job[] = [];
        for (let i = 0; i < 7; i++) {
            const teeth: Tooth[] = [
                make3DTooth(17, i % 2 === 0 ? 'LowerJaw' : 'UpperJaw', `job-${i}-t17`),
                make3DTooth(18, i % 2 === 0 ? 'UpperJaw' : 'LowerJaw', `job-${i}-t18`)
            ];
            jobs.push(createMockJob({
                id: `job-${i}`,
                teeth,
                unitCount: teeth.length,
                projectId: `proj-${i}`
            }));
        }

        let matchedJobCount = 0;
        for (const job of jobs) {
            const result = calculateJobPrice(job, [gipszmodellGergo, baseFor3D]);
            expect(result).not.toBeNull();
            if (!result) continue;
            const applied = result.appliedJobRules?.find(r => r.id === gipszmodellGergo.id);
            expect(applied).toBeDefined();
            expect(applied?.isExcluded).toBeFalsy();
            if (applied) {
                matchedJobCount++;
            }
        }
        // The rule's "applied to N jobs" counter should report 7.
        expect(matchedJobCount).toBe(7);
    });

    it('does not fire the jobExtra rule when no tooth matches the conditions', () => {
        const teeth: Tooth[] = [
            { id: 't17', number: 17, material: 'Zirconia', type: 'Crown' }
        ];
        const job = createMockJob({ teeth, unitCount: 1 });
        const result = calculateJobPrice(job, [gipszmodellGergo]);
        expect(result).not.toBeNull();
        if (!result) return;
        expect(result.appliedJobRules?.find(r => r.id === gipszmodellGergo.id)).toBeUndefined();
    });

    it('records the jobExtra breakdown as isExcluded when the job excludes the rule', () => {
        const teeth: Tooth[] = [
            make3DTooth(17, 'LowerJaw', 't17')
        ];
        const job = createMockJob({ teeth, unitCount: 1, excludedRuleIds: ['gipszmodell-gergo'] });
        const result = calculateJobPrice(job, [gipszmodellGergo, baseFor3D]);
        expect(result).not.toBeNull();
        if (!result) return;
        const applied = result.appliedJobRules?.find(r => r.id === gipszmodellGergo.id);
        expect(applied).toBeDefined();
        expect(applied?.isExcluded).toBe(true);
        // The excluded rule does not contribute to the job total.
        const basePrice = result.teeth[0].basePrice || 0;
        expect(result.price).toBe(basePrice);
    });

    it('fires the jobExtra rule independently of base/extra rules for the same conditions', () => {
        // The jobExtra rule must fire even when no base rule of the same
        // shape has been defined. The previous regression was a side-effect
        // of coupling the jobExtra evaluation to the base-rule pass.
        const teeth: Tooth[] = [
            make3DTooth(17, 'LowerJaw', 't17')
        ];
        const job = createMockJob({ teeth, unitCount: 1 });
        const result = calculateJobPrice(job, [gipszmodellGergo]);
        expect(result).not.toBeNull();
        if (!result) return;
        const applied = result.appliedJobRules?.find(r => r.id === gipszmodellGergo.id);
        expect(applied).toBeDefined();
        expect(applied?.isExcluded).toBeFalsy();
    });
});
