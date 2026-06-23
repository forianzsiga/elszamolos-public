import { describe, it, expect } from 'vitest';
import { calculateJobPrice } from './pricingEngine';
import type { Job, TariffRule, Tooth } from '../types';

const createMockJob = (overrides?: Partial<Job>): Job => ({
    id: 'test-job',
    patientName: 'John Doe',
    doctorName: 'Dr. Smith',
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

const createMockTooth = (number: number, material: string = 'Zircon', type: string = 'Crown'): Tooth => ({
    number,
    material,
    type
});

describe('ignoreUnit exclusion placement', () => {
    const ignore3DRule: TariffRule = {
        id: 'ignore-3d',
        name: 'Hide all 3D models',
        label: 'Hide all 3D models',
        kind: 'ignoreUnit',
        priority: 1,
        conditions: [{ field: 'type', operator: 'equals', value: '3D Model' }],
        action: {}
    };

    it('keeps the original tooth visible and records the excluded ignoreUnit breakdown when the rule is excluded for the tooth', () => {
        // The user has previously excluded the ignoreUnit rule for the tooth.
        // The engine must keep the tooth visible (isIgnored: false), process
        // it through the normal base-rule flow, and record the ignoreUnit
        // breakdown with isExcluded: true so the chevron expansion can show
        // the exclusion state. No companion/fake unit is created.
        const baseZircon: TariffRule = {
            id: 'base-zircon',
            name: 'Zircon Crown',
            label: 'Zircon Crown',
            kind: 'base',
            priority: 5,
            conditions: [
                { field: 'material', operator: 'equals', value: 'bridge_slm_cad' },
                { field: 'type', operator: 'equals', value: '3D Model' }
            ],
            action: { value: 9999, currency: 'HUF' }
        };
        const teeth: Tooth[] = [
            {
                ...createMockTooth(17, 'bridge_slm_cad', '3D Model'),
                id: 't17',
                excludedRuleIds: ['ignore-3d']
            }
        ];
        const job = createMockJob({ teeth, unitCount: 1 });

        const result = calculateJobPrice(job, [ignore3DRule, baseZircon]);
        expect(result).not.toBeNull();
        if (!result) return;

        const t17 = result.teeth.find(t => t.id === 't17')!;
        // The original tooth stays visible.
        expect(t17.isIgnored).toBe(false);
        expect(t17.ignoredByRuleId).toBeUndefined();
        // The base rule prices the tooth normally.
        expect(t17.price).toBe(9999);
        expect(t17.basePrice).toBe(9999);
        // The job total reflects the priced tooth.
        expect(result.price).toBe(9999);
        expect(result.unitCount).toBe(1);
        // The chevron expansion breakdown: an ignoreUnit entry with isExcluded: true.
        const excludedEntry = t17.appliedRules?.find(r => r.kind === 'ignoreUnit');
        expect(excludedEntry).toBeDefined();
        expect(excludedEntry?.isExcluded).toBe(true);
        expect(excludedEntry?.id).toBe('ignore-3d');
        // The base rule is also recorded (not excluded).
        const baseEntry = t17.appliedRules?.find(r => r.kind === 'base');
        expect(baseEntry).toBeDefined();
        expect(baseEntry?.isExcluded).toBeFalsy();
    });

    it('keeps a previously-ignored tooth ignored when no exclusion has been applied', () => {
        // The user has not excluded the ignoreUnit rule. The engine should
        // mark the tooth as ignored and exclude it from the job total.
        const teeth: Tooth[] = [
            {
                ...createMockTooth(17, 'bridge_slm_cad', '3D Model'),
                id: 't17'
            }
        ];
        const job = createMockJob({ teeth, unitCount: 1 });

        const result = calculateJobPrice(job, [ignore3DRule]);
        expect(result).not.toBeNull();
        if (!result) return;

        const t17 = result.teeth.find(t => t.id === 't17')!;
        expect(t17.isIgnored).toBe(true);
        expect(t17.ignoredByRuleId).toBe('ignore-3d');
        expect(t17.price).toBe(0);
        // The job total excludes the hidden unit.
        expect(result.price).toBe(0);
        expect(result.unitCount).toBe(0);
    });

    it('re-evaluates the same tooth after a rule is un-excluded: a previously-ignored tooth becomes visible', () => {
        // The same tooth is run through the engine twice: first with the
        // ignoreUnit rule excluded (visible + priced), then without the
        // exclusion (ignored). The engine must not leave stale `isIgnored`
        // or `ignoredByRuleId` fields on the tooth after the second pass.
        const baseZircon: TariffRule = {
            id: 'base-zircon',
            name: 'Zircon Crown',
            label: 'Zircon Crown',
            kind: 'base',
            priority: 5,
            conditions: [
                { field: 'material', operator: 'equals', value: 'bridge_slm_cad' },
                { field: 'type', operator: 'equals', value: '3D Model' }
            ],
            action: { value: 9999, currency: 'HUF' }
        };
        const tooth: Tooth = {
            ...createMockTooth(17, 'bridge_slm_cad', '3D Model'),
            id: 't17',
            excludedRuleIds: ['ignore-3d']
        };
        const job = createMockJob({ teeth: [tooth], unitCount: 1 });

        const withExclusion = calculateJobPrice(job, [ignore3DRule, baseZircon]);
        expect(withExclusion).not.toBeNull();
        if (!withExclusion) return;
        const visibleTooth = withExclusion.teeth.find(t => t.id === 't17')!;
        expect(visibleTooth.isIgnored).toBe(false);
        expect(visibleTooth.price).toBe(9999);

        // Now flip the exclusion off and re-run the engine.
        const flipped: Tooth = { ...visibleTooth, excludedRuleIds: [] };
        const withoutExclusion = calculateJobPrice(
            createMockJob({ teeth: [flipped], unitCount: 1 }),
            [ignore3DRule, baseZircon]
        );
        expect(withoutExclusion).not.toBeNull();
        if (!withoutExclusion) return;
        const hiddenTooth = withoutExclusion.teeth.find(t => t.id === 't17')!;
        expect(hiddenTooth.isIgnored).toBe(true);
        expect(hiddenTooth.ignoredByRuleId).toBe('ignore-3d');
        expect(hiddenTooth.price).toBe(0);
    });
});
