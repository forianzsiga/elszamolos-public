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

describe('Pricing Engine', () => {
    it('should calculate price for a single tooth match', () => {
        const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
        const job = createMockJob({ teeth, unitCount: 1 });
        
        const rules: TariffRule[] = [{
            id: 'rule-1',
            name: 'Zircon Crown',
            label: 'Zircon Crown',
            priority: 1,
            conditions: [
                { field: 'material', operator: 'equals', value: 'Zircon' },
                { field: 'type', operator: 'equals', value: 'Crown' }
            ],
            action: { value: 5000, currency: 'HUF' }
        }];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.status).toBe('Calculated');
            expect(result.price).toBe(5000);
            expect(result.teeth[0].price).toBe(5000);
            expect(result.teeth[0].status).toBe('Calculated');
        }
    });

    it('should handle "Review" action', () => {
        const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
        const job = createMockJob({ teeth, unitCount: 1 });
        
        const rules: TariffRule[] = [{
            id: 'rule-review',
            name: 'Review Rule',
            label: 'Review',
            priority: 1,
            kind: 'review',
            conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
            action: {}
        }];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.status).toBe('Review');
            expect(result.price).toBe(0); 
            expect(result.teeth[0].status).toBe('Review');
        }
    });

    it('should prioritize invalid status over calculated', () => {
        const teeth = [createMockTooth(18, 'Zircon'), createMockTooth(19, 'BadMaterial')];
        const job = createMockJob({ teeth, unitCount: 2 });
        
        const rules: TariffRule[] = [
            {
                id: 'rule-ok',
                name: 'Zircon',
                label: 'Zircon',
                priority: 2,
                conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                action: { value: 100, currency: 'HUF' }
            },
            {
                id: 'rule-bad',
                name: 'Bad',
                label: 'Bad',
                priority: 1,
                kind: 'invalid',
                conditions: [{ field: 'material', operator: 'equals', value: 'BadMaterial' }],
                action: {}
            }
        ];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.status).toBe('Invalid');
            expect(result.teeth[0].status).toBe('Calculated');
            expect(result.teeth[1].status).toBe('Invalid');
        }
    });

    it('should respect rule priority', () => {
        const teeth = [createMockTooth(18, 'Zircon')];
        const job = createMockJob({ teeth, unitCount: 1 });
        
        const rules: TariffRule[] = [
            {
                id: 'rule-low-prio',
                name: 'General',
                label: 'General',
                priority: 10,
                conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                action: { value: 100, currency: 'HUF' }
            },
            {
                id: 'rule-high-prio',
                name: 'Specific',
                label: 'Specific',
                priority: 1,
                conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                action: { value: 500, currency: 'HUF' }
            }
        ];
        
        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.price).toBe(500);
            expect(result.teeth[0].appliedRuleId).toBe('rule-high-prio');
        }
    });

    it('should return null for invalid job structure', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invalidJob = null as any;
        const rules: TariffRule[] = [];
        
        const result = calculateJobPrice(invalidJob, rules);
        expect(result).toBeNull();
    });

    it('should return null for invalid rules', () => {
        const job = createMockJob();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invalidRules = 'not-an-array' as any;
        
        const result = calculateJobPrice(job, invalidRules);
        expect(result).toBeNull();
    });

    it('should skip invalid rules and continue with valid ones', () => {
        const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
        const job = createMockJob({ teeth, unitCount: 1 });
        
        const rules: TariffRule[] = [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'invalid-rule', name: 'Invalid', label: 'Invalid', priority: 1 } as any, // Invalid rule - missing conditions and action
            {
                id: 'valid-rule',
                name: 'Zircon Crown',
                label: 'Zircon Crown',
                priority: 2,
                conditions: [
                    { field: 'material', operator: 'equals', value: 'Zircon' },
                    { field: 'type', operator: 'equals', value: 'Crown' }
                ],
                action: { value: 5000, currency: 'HUF' }
            }
        ];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.status).toBe('Calculated');
            expect(result.price).toBe(5000);
        }
    });

    it('should not recalculate discarded jobs', () => {
        const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
        const job = createMockJob({ teeth, unitCount: 1, status: 'Discarded', price: 999 });
        
        const rules: TariffRule[] = [{
            id: 'rule-1',
            name: 'Zircon Crown',
            label: 'Zircon Crown',
            priority: 1,
            conditions: [
                { field: 'material', operator: 'equals', value: 'Zircon' },
                { field: 'type', operator: 'equals', value: 'Crown' }
            ],
            action: { value: 5000, currency: 'HUF' }
        }];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.status).toBe('Discarded');
            expect(result.price).toBe(999); // Should remain unchanged
        }
    });

    it('should not recalculate invoiced jobs', () => {
        const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
        const job = createMockJob({ teeth, unitCount: 1, status: 'Invoiced', price: 999 });
        
        const rules: TariffRule[] = [{
            id: 'rule-1',
            name: 'Zircon Crown',
            label: 'Zircon Crown',
            priority: 1,
            conditions: [
                { field: 'material', operator: 'equals', value: 'Zircon' },
                { field: 'type', operator: 'equals', value: 'Crown' }
            ],
            action: { value: 5000, currency: 'HUF' }
        }];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.status).toBe('Invoiced');
            expect(result.price).toBe(999); // Should remain unchanged
        }
    });

    it('should stack tooth extras independent from priority race ordering', () => {
        const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
        const job = createMockJob({ teeth, unitCount: 1, doctorName: 'Dr. Smith' });

        const rulesA: TariffRule[] = [
            {
                id: 'base-zircon',
                name: 'Base Zircon Crown',
                label: 'Zircon Crown',
                kind: 'base',
                priority: 50,
                conditions: [
                    { field: 'material', operator: 'equals', value: 'Zircon' },
                    { field: 'type', operator: 'equals', value: 'Crown' }
                ],
                action: { value: 5000, currency: 'HUF' }
            },
            {
                id: 'extra-doctor',
                name: 'Doctor Extra',
                label: 'Doctor Extra',
                kind: 'unitExtra',
                priority: 1,
                conditions: [{ field: 'doctorName', operator: 'equals', value: 'Dr. Smith' }],
                action: { value: 1000, currency: 'HUF' }
            },
            {
                id: 'extra-material',
                name: 'Material Extra',
                label: 'Material Extra',
                kind: 'unitExtra',
                priority: 999,
                conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                action: { value: 500, currency: 'HUF' }
            }
        ];

        const rulesB = [rulesA[2], rulesA[0], rulesA[1]];

        const resultA = calculateJobPrice(job, rulesA);
        const resultB = calculateJobPrice(job, rulesB);

        expect(resultA).not.toBeNull();
        expect(resultB).not.toBeNull();

        if (resultA && resultB) {
            expect(resultA.price).toBe(6500);
            expect(resultB.price).toBe(6500);
            expect(resultA.teeth[0].extraPrice).toBe(1500);
            expect(resultB.teeth[0].extraPrice).toBe(1500);
            expect(resultA.teeth[0].appliedRules?.filter(r => r.kind === 'unitExtra').length).toBe(2);
            expect(resultB.teeth[0].appliedRules?.filter(r => r.kind === 'unitExtra').length).toBe(2);
        }
    });

    it('should apply job-level extra once per job', () => {
        const teeth = [createMockTooth(11, 'Zircon', 'Crown'), createMockTooth(12, 'Zircon', 'Crown')];
        const job = createMockJob({ teeth, unitCount: 2, doctorName: 'Dr. Smith' });

        const rules: TariffRule[] = [
            {
                id: 'base-zircon',
                name: 'Base Zircon Crown',
                label: 'Zircon Crown',
                kind: 'base',
                priority: 10,
                conditions: [
                    { field: 'material', operator: 'equals', value: 'Zircon' },
                    { field: 'type', operator: 'equals', value: 'Crown' }
                ],
                action: { value: 5000, currency: 'HUF' }
            },
            {
                id: 'job-doctor-extra',
                name: 'Doctor Setup Fee',
                label: 'Setup Fee',
                kind: 'jobExtra',
                priority: 20,
                conditions: [{ field: 'doctorName', operator: 'equals', value: 'Dr. Smith' }],
                action: { value: 3000, currency: 'HUF' }
            }
        ];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.basePrice).toBe(10000);
            expect(result.extraPrice).toBe(3000);
            expect(result.price).toBe(13000);
            expect(result.appliedJobRules?.length).toBe(1);
        }
    });

    it('should keep base priority winner while still adding extras', () => {
        const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
        const job = createMockJob({ teeth, unitCount: 1, doctorName: 'Dr. Smith' });

        const rules: TariffRule[] = [
            {
                id: 'base-low',
                name: 'Low Priority Base',
                label: 'Low Base',
                kind: 'base',
                priority: 99,
                conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                action: { value: 1000, currency: 'HUF' }
            },
            {
                id: 'base-high',
                name: 'High Priority Base',
                label: 'High Base',
                kind: 'base',
                priority: 1,
                conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                action: { value: 7000, currency: 'HUF' }
            },
            {
                id: 'extra-doctor',
                name: 'Doctor Extra',
                label: 'Doctor Extra',
                kind: 'unitExtra',
                priority: 500,
                conditions: [{ field: 'doctorName', operator: 'equals', value: 'Dr. Smith' }],
                action: { value: 700, currency: 'HUF' }
            }
        ];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            expect(result.teeth[0].appliedRuleId).toBe('base-high');
            expect(result.teeth[0].basePrice).toBe(7000);
            expect(result.teeth[0].extraPrice).toBe(700);
            expect(result.price).toBe(7700);
        }
    });

    it('should respect tooth-level and job-level rule exclusions', () => {
        const teeth = [
            { ...createMockTooth(18, 'Zircon', 'Crown'), excludedRuleIds: ['base-zircon'] },
            createMockTooth(19, 'Zircon', 'Crown')
        ];
        const job = createMockJob({ teeth, unitCount: 2, excludedRuleIds: ['job-extra-fee'] });

        const rules: TariffRule[] = [
            {
                id: 'base-zircon',
                name: 'Zircon Crown',
                label: 'Zircon Crown',
                kind: 'base',
                priority: 10,
                conditions: [
                    { field: 'material', operator: 'equals', value: 'Zircon' },
                    { field: 'type', operator: 'equals', value: 'Crown' }
                ],
                action: { value: 5000, currency: 'HUF' }
            },
            {
                id: 'base-zircon-backup',
                name: 'Zircon Backup',
                label: 'Zircon Backup',
                kind: 'base',
                priority: 15,
                conditions: [
                    { field: 'material', operator: 'equals', value: 'Zircon' },
                    { field: 'type', operator: 'equals', value: 'Crown' }
                ],
                action: { value: 4000, currency: 'HUF' }
            },
            {
                id: 'job-extra-fee',
                name: 'Job Extra Fee',
                label: 'Job Extra Fee',
                kind: 'jobExtra',
                priority: 20,
                conditions: [{ field: 'doctorName', operator: 'equals', value: 'Dr. Smith' }],
                action: { value: 3000, currency: 'HUF' }
            }
        ];

        const result = calculateJobPrice(job, rules);
        expect(result).not.toBeNull();

        if (result) {
            // Tooth 18 excludes 'base-zircon', so its active rule falls back to 'base-zircon-backup', but the excluded breakdown is present
            expect(result.teeth[0].appliedRuleId).toBe('base-zircon-backup');
            expect(result.teeth[0].appliedRules?.find(r => r.id === 'base-zircon')?.isExcluded).toBe(true);
            expect(result.teeth[0].price).toBe(4000);

            // Tooth 19 does not exclude it, so it should be Calculated with 'base-zircon'
            expect(result.teeth[1].appliedRuleId).toBe('base-zircon');
            expect(result.teeth[1].status).toBe('Calculated');
            expect(result.teeth[1].price).toBe(5000);

            // Job level extra rule 'job-extra-fee' is excluded, so it should be present but marked as isExcluded
            expect(result.appliedJobRules?.length).toBe(1);
            expect(result.appliedJobRules?.[0].isExcluded).toBe(true);
            expect(result.price).toBe(9000); // 4000 from tooth 18 + 5000 from tooth 19
        }
    });

    describe('Non-priority based rules evaluation without base rule', () => {
        it('should evaluate unit extra fee (unitExtra) without matching base price rule', () => {
            const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
            const job = createMockJob({ teeth, unitCount: 1 });

            const rules: TariffRule[] = [
                {
                    id: 'extra-gold',
                    name: 'Gold extra',
                    label: 'Gold extra',
                    kind: 'unitExtra',
                    priority: 5,
                    conditions: [{ field: 'type', operator: 'equals', value: 'Crown' }],
                    action: { value: 1500, currency: 'HUF' }
                }
            ];

            const result = calculateJobPrice(job, rules);
            expect(result).not.toBeNull();
            if (result) {
                expect(result.status).toBe('Pending');
                expect(result.teeth[0].status).toBe('Pending');
                expect(result.teeth[0].extraPrice).toBe(1500);
                expect(result.teeth[0].price).toBe(0); // Price is 0 because status is Pending
                expect(result.teeth[0].appliedRules?.length).toBe(1);
                expect(result.teeth[0].appliedRules?.[0].id).toBe('extra-gold');
            }
        });

        it('should evaluate invalid rule (invalid) without matching base price rule', () => {
            const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
            const job = createMockJob({ teeth, unitCount: 1 });

            const rules: TariffRule[] = [
                {
                    id: 'mark-invalid',
                    name: 'Invalid Material',
                    label: 'Invalid',
                    kind: 'invalid',
                    priority: 2,
                    conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                    action: { value: 0 }
                }
            ];

            const result = calculateJobPrice(job, rules);
            expect(result).not.toBeNull();
            if (result) {
                expect(result.status).toBe('Invalid');
                expect(result.teeth[0].status).toBe('Invalid');
                expect(result.teeth[0].appliedRules?.length).toBe(1);
                expect(result.teeth[0].appliedRules?.[0].id).toBe('mark-invalid');
            }
        });

        it('should evaluate review rule (review) without matching base price rule', () => {
            const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
            const job = createMockJob({ teeth, unitCount: 1 });

            const rules: TariffRule[] = [
                {
                    id: 'mark-review',
                    name: 'Review Material',
                    label: 'Review',
                    kind: 'review',
                    priority: 2,
                    conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                    action: { value: 0 }
                }
            ];

            const result = calculateJobPrice(job, rules);
            expect(result).not.toBeNull();
            if (result) {
                expect(result.status).toBe('Review');
                expect(result.teeth[0].status).toBe('Review');
                expect(result.teeth[0].appliedRules?.length).toBe(1);
                expect(result.teeth[0].appliedRules?.[0].id).toBe('mark-review');
            }
        });

        it('should ignore a unit when an ignoreUnit rule matches and exclude it from the job total', () => {
            // createMockTooth(number, material, type) -> here we use the convention
            // (number, type, material) by relying on positional defaults where the
            // '3D Model' label is in the *type* slot so the ignore rule's
            // `type equals '3D Model'` matches.
            const teeth = [
                createMockTooth(18, 'Zircon', 'Crown'),
                createMockTooth(17, 'bridge_slm_cad', '3D Model')
            ];
            const job = createMockJob({ teeth, unitCount: 2 });

            const rules: TariffRule[] = [
                {
                    id: 'zircon-base',
                    name: 'Zircon Crown',
                    label: 'Zircon Crown',
                    kind: 'base',
                    priority: 2,
                    conditions: [
                        { field: 'material', operator: 'equals', value: 'Zircon' },
                        { field: 'type', operator: 'equals', value: 'Crown' }
                    ],
                    action: { value: 1000, currency: 'HUF' }
                },
                {
                    id: 'ignore-3d',
                    name: 'Hide all 3D models',
                    label: 'Hide all 3D models',
                    kind: 'ignoreUnit',
                    priority: 1,
                    conditions: [
                        { field: 'type', operator: 'equals', value: '3D Model' }
                    ],
                    action: {}
                }
            ];

            const result = calculateJobPrice(job, rules);
            expect(result).not.toBeNull();
            if (result) {
                // The 3D Model unit is ignored: status Calculated, price 0, isIgnored true
                const ignored = result.teeth.find(t => t.type === '3D Model')!;
                expect(ignored.isIgnored).toBe(true);
                expect(ignored.status).toBe('Calculated');
                expect(ignored.price).toBe(0);

                // The Zircon tooth is priced normally
                const zircon = result.teeth.find(t => t.type === 'Crown')!;
                expect(zircon.isIgnored).toBeFalsy();
                expect(zircon.status).toBe('Calculated');
                expect(zircon.price).toBe(1000);

                // The job's unitCount is recomputed to exclude the ignored unit
                expect(result.unitCount).toBe(1);
                // Job total only reflects the priced tooth
                expect(result.price).toBe(1000);
                // Job status is Calculated because the only billable unit is matched
                expect(result.status).toBe('Calculated');
            }
        });

        it('should set unitCount to 0 when every unit is ignored', () => {
            const teeth = [
                createMockTooth(17, 'bridge_slm_cad', '3D Model'),
                createMockTooth(16, 'modelbase', '3D Model')
            ];
            const job = createMockJob({ teeth, unitCount: 2 });

            const rules: TariffRule[] = [
                {
                    id: 'ignore-3d',
                    name: 'Hide all 3D models',
                    label: 'Hide all 3D models',
                    kind: 'ignoreUnit',
                    priority: 1,
                    conditions: [
                        { field: 'type', operator: 'equals', value: '3D Model' }
                    ],
                    action: {}
                }
            ];

            const result = calculateJobPrice(job, rules);
            expect(result).not.toBeNull();
            if (result) {
                expect(result.unitCount).toBe(0);
                expect(result.price).toBe(0);
                // 0 billable units -> Pending (no matched billable teeth, but all ignored)
                expect(result.status).toBe('Pending');
                // All teeth are flagged as ignored
                expect(result.teeth.every(t => t.isIgnored)).toBe(true);
            }
        });

        it('should not evaluate base/unitExtra rules on an ignored unit', () => {
            const teeth = [
                createMockTooth(17, 'Zircon', '3D Model')
            ];
            const job = createMockJob({ teeth, unitCount: 1 });

            const rules: TariffRule[] = [
                {
                    id: 'ignore-3d',
                    name: 'Hide all 3D models',
                    label: 'Hide all 3D models',
                    kind: 'ignoreUnit',
                    priority: 1,
                    conditions: [
                        { field: 'type', operator: 'equals', value: '3D Model' }
                    ],
                    action: {}
                },
                {
                    id: 'zircon-base',
                    name: 'Zircon Crown',
                    label: 'Zircon Crown',
                    kind: 'base',
                    priority: 5,
                    conditions: [{ field: 'material', operator: 'equals', value: 'Zircon' }],
                    action: { value: 9999, currency: 'HUF' }
                }
            ];

            const result = calculateJobPrice(job, rules);
            expect(result).not.toBeNull();
            if (result) {
                // The base rule must NOT have applied
                expect(result.teeth[0].price).toBe(0);
                expect(result.teeth[0].basePrice).toBe(0);
                // The only applied rule is the ignore rule
                const ruleKinds = result.teeth[0].appliedRules?.map(r => r.kind) ?? [];
                expect(ruleKinds).toContain('ignoreUnit');
                expect(ruleKinds).not.toContain('base');
            }
        });

        it('should evaluate job extra rules (jobExtra) regardless of finalStatus', () => {
            const teeth = [createMockTooth(18, 'Zircon', 'Crown')];
            const job = createMockJob({ teeth, unitCount: 1, doctorName: 'Dr. House' });

            const rules: TariffRule[] = [
                {
                    id: 'job-doctor-extra',
                    name: 'Doctor Setup Fee',
                    label: 'Setup Fee',
                    kind: 'jobExtra',
                    priority: 20,
                    conditions: [{ field: 'doctorName', operator: 'equals', value: 'Dr. House' }],
                    action: { value: 3000, currency: 'HUF' }
                }
            ];

            const result = calculateJobPrice(job, rules);
            expect(result).not.toBeNull();
            if (result) {
                expect(result.status).toBe('Pending');
                expect(result.appliedJobRules?.length).toBe(1);
                expect(result.appliedJobRules?.[0].id).toBe('job-doctor-extra');
            }
        });
    });
});
