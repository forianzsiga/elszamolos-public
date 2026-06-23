import { describe, it, expect } from 'vitest';
import { getDisplayRows, ensureToothId, ensureJobTeethIds } from '../teethTableUtils';
import type { Tooth, AppliedRuleBreakdown, Job } from '../../types';

describe('teethTableUtils', () => {
    const mockTeeth: Tooth[] = [
        {
            number: 14,
            material: 'Zirconia',
            type: 'Crown',
            status: 'Completed',
            price: 15000,
            currency: 'HUF',
            appliedRuleId: 'rule-1',
            appliedRuleLabel: 'Zirconia Crown Base',
            appliedRulePriority: 1,
            appliedRules: [
                {
                    id: 'extra-1',
                    label: 'Shoulder Prep Extra',
                    amount: 3000,
                    currency: 'HUF',
                    priority: 2,
                    kind: 'unitExtra'
                }
            ]
        },
        {
            number: 15,
            material: 'Zirconia',
            type: 'Crown',
            status: 'Completed',
            price: 15000,
            currency: 'HUF',
            appliedRuleId: 'rule-1',
            appliedRuleLabel: 'Zirconia Crown Base',
            appliedRulePriority: 1,
            appliedRules: []
        }
    ];

    const mockJobExtraRules: AppliedRuleBreakdown[] = [
        {
            id: 'job-extra-1',
            label: 'Express Delivery Fee',
            amount: 5000,
            currency: 'HUF',
            priority: 10,
            kind: 'jobExtra'
        }
    ];

    it('should correctly flatten teeth and their tooth-level extra rules', () => {
        const sortedTeeth = [...mockTeeth];
        const result = getDisplayRows(sortedTeeth, mockTeeth, []);

        expect(result).toHaveLength(3); // 2 teeth + 1 unitExtra

        // First row: Tooth 14
        expect(result[0]).toEqual({
            id: 'tooth-14',
            kind: 'tooth',
            tooth: mockTeeth[0]
        });

        // Second row: Tooth 14 Extra Rule, inlined directly after its parent tooth
        // (tooth has no id, so it uses tooth-<number> as fallback)
        expect(result[1]).toEqual({
            id: 'tooth-extra-tooth-14-extra-1',
            kind: 'unitExtra',
            tooth: mockTeeth[0],
            extraRule: mockTeeth[0].appliedRules?.[0]
        });

        // Third row: Tooth 15 (has no tooth-level extras)
        expect(result[2]).toEqual({
            id: 'tooth-15',
            kind: 'tooth',
            tooth: mockTeeth[1]
        });
    });

    it('should append job-level extra rules anchored to the first tooth', () => {
        const sortedTeeth = [...mockTeeth];
        const result = getDisplayRows(sortedTeeth, mockTeeth, mockJobExtraRules);

        expect(result).toHaveLength(4); // 2 teeth + 1 unitExtra + 1 jobExtra

        // Last row: Job Extra Rule
        expect(result[3]).toEqual({
            id: 'job-extra-job-extra-1',
            kind: 'jobExtra',
            tooth: {
                number: 0,
                material: '-',
                type: '-',
                price: 0,
                status: 'Calculated',
                currency: 'HUF'
            },
            extraRule: mockJobExtraRules[0]
        });
    });

    it('should return empty array if no teeth are provided', () => {
        const result = getDisplayRows([], [], []);
        expect(result).toHaveLength(0);
    });

    describe('ensureToothId / ensureJobTeethIds', () => {
        it('should keep existing id unchanged', () => {
            const tooth: Tooth = { id: 'my-custom-id', number: 14, material: 'Z', type: 'Crown' };
            const result = ensureToothId(tooth, 'job-1', 0);
            expect(result.id).toBe('my-custom-id');
        });

        it('should synthesise a stable id when tooth lacks an id', () => {
            const tooth: Tooth = { number: 18, material: 'Z', type: 'Crown' };
            const result = ensureToothId(tooth, 'job-abc', 2);
            expect(result.id).toBe('stable-job-abc-18-2');
        });

        it('should give distinct stable ids to two teeth with the same number in the same job', () => {
            const toothA: Tooth = { number: 11, material: 'Z', type: 'Crown' };
            const toothB: Tooth = { number: 11, material: 'Z', type: 'Bridge' };
            const resultA = ensureToothId(toothA, 'job-xyz', 0);
            const resultB = ensureToothId(toothB, 'job-xyz', 1);
            expect(resultA.id).toBe('stable-job-xyz-11-0');
            expect(resultB.id).toBe('stable-job-xyz-11-1');
            expect(resultA.id).not.toBe(resultB.id);
        });

        it('ensureJobTeethIds backfills all missing ids on a job', () => {
            const job: Job = {
                id: 'job-test',
                patientName: 'Test',
                doctorName: 'Dr',
                fileName: 'test.dentalproject',
                createdAt: new Date().toISOString(),
                teeth: [
                    { number: 14, material: 'Z', type: 'Crown' },
                    { number: 14, material: 'Z', type: 'Bridge' },
                    { id: 'keep-me', number: 15, material: 'P', type: 'Crown' }
                ],
                unitCount: 3,
                status: 'Pending',
                price: 0,
                notes: '',
            };
            const result = ensureJobTeethIds(job);
            expect(result.teeth[0].id).toBe('stable-job-test-14-0');
            expect(result.teeth[1].id).toBe('stable-job-test-14-1');
            expect(result.teeth[2].id).toBe('keep-me');
        });

        it('should not mutate the original job', () => {
            const job: Job = {
                id: 'job-test',
                patientName: 'Test',
                doctorName: 'Dr',
                fileName: 'test.dentalproject',
                createdAt: new Date().toISOString(),
                teeth: [{ number: 14, material: 'Z', type: 'Crown' }],
                unitCount: 1,
                status: 'Pending',
                price: 0,
                notes: '',
            };
            const originalId = job.teeth[0].id;
            ensureJobTeethIds(job);
            expect(job.teeth[0].id).toBe(originalId);
        });
    });

    describe('display row stable ids', () => {
        it('should use stable ids for teeth without an id when jobId is provided', () => {
            const teeth: Tooth[] = [
                { number: 11, material: 'Z', type: 'Crown' },
                { number: 11, material: 'Z', type: 'Bridge' }
            ];
            const result = getDisplayRows(teeth, teeth, [], 'job-1');
            expect(result[0].id).toBe('stable-job-1-11-0');
            expect(result[1].id).toBe('stable-job-1-11-1');
            expect(result[0].id).not.toBe(result[1].id);
        });

        it('should create unique tooth-extra row ids via stable ids', () => {
            const toothA: Tooth = {
                number: 14,
                material: 'Z',
                type: 'Crown',
                appliedRules: [{
                    id: 'extra-1',
                    name: 'Extra 1',
                    label: 'Extra 1',
                    amount: 1000,
                    currency: 'HUF',
                    priority: 2,
                    kind: 'unitExtra'
                }]
            };
            const toothB: Tooth = {
                number: 14,
                material: 'Z',
                type: 'Crown',
                appliedRules: [{
                    id: 'extra-2',
                    name: 'Extra 2',
                    label: 'Extra 2',
                    amount: 2000,
                    currency: 'HUF',
                    priority: 3,
                    kind: 'unitExtra'
                }]
            };
            const result = getDisplayRows([toothA, toothB], [toothA, toothB], [], 'job-2');
            // Tooth rows and their inlined extras (sorted by priority per tooth)
            expect(result[0].id).toBe('stable-job-2-14-0');
            expect(result[1].id).toBe('tooth-extra-stable-job-2-14-0-extra-1');
            expect(result[2].id).toBe('stable-job-2-14-1');
            expect(result[3].id).toBe('tooth-extra-stable-job-2-14-1-extra-2');
        });
    });

    describe('excluded ignoreUnit ghost rows', () => {
        it('does NOT emit a strikethrough ghost row for an excluded ignoreUnit applied rule (chevron expansion surfaces it instead)', () => {
            // The previous design emitted a "ghost" `unitExtra` row above the
            // tooth row for any excluded `ignoreUnit` rule. The redesigned
            // table surfaces exclusion state through the chevron expansion
            // and does not produce ghost rows.
            const visibleTooth: Tooth = {
                id: 't17',
                number: 17,
                material: 'bridge_slm_cad',
                type: '3D Model',
                isIgnored: false,
                excludedRuleIds: ['ignore-3d'],
                appliedRules: [
                    {
                        id: 'base-zircon',
                        name: 'Zircon Crown',
                        label: 'Zircon Crown',
                        amount: 9999,
                        currency: 'HUF',
                        priority: 5,
                        kind: 'base'
                    },
                    {
                        id: 'ignore-3d',
                        name: 'Hide all 3D models',
                        label: 'Hide all 3D models',
                        amount: 0,
                        currency: 'HUF',
                        priority: 1,
                        kind: 'ignoreUnit',
                        isExcluded: true
                    }
                ]
            };
            const result = getDisplayRows([visibleTooth], [visibleTooth], [], 'job-3');
            expect(result).toHaveLength(1);
            expect(result[0].kind).toBe('tooth');
            expect(result[0].tooth.id).toBe('t17');
            expect(result[0].tooth.isIgnored).toBe(false);
        });
    });
});
