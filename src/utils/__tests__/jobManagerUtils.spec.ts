import { describe, it, expect } from 'vitest';
import type { Job } from '../../types';
import { generateJobHash } from '../hash';
import {
    getDuplicateHashes,
    getFilterOptions,
    filterJobs,
    sortJobs
} from '../jobManagerUtils';

describe('jobManagerUtils', () => {
    describe('getDuplicateHashes', () => {
        it('should return empty set if no jobs have originalHash', () => {
            const jobs: Job[] = [
                {
                    id: '1',
                    patientName: 'A',
                    doctorName: 'B',
                    fileName: 'f1',
                    createdAt: '2026-06-01',
                    teeth: [],
                    unitCount: 0,
                    status: 'Calculated',
                    price: 0,
                    notes: ''
                }
            ];
            expect(getDuplicateHashes(jobs)).toEqual(new Set());
        });

        it('should detect duplicate original hashes', () => {
            const jobs: Job[] = [
                {
                    id: '1',
                    patientName: 'A',
                    doctorName: 'B',
                    fileName: 'f1',
                    createdAt: '2026-06-01',
                    teeth: [],
                    unitCount: 0,
                    status: 'Calculated',
                    price: 0,
                    notes: '',
                    originalHash: 'hash-abc'
                },
                {
                    id: '2',
                    patientName: 'C',
                    doctorName: 'D',
                    fileName: 'f2',
                    createdAt: '2026-06-02',
                    teeth: [],
                    unitCount: 0,
                    status: 'Calculated',
                    price: 0,
                    notes: '',
                    originalHash: 'hash-abc' // Duplicate
                },
                {
                    id: '3',
                    patientName: 'E',
                    doctorName: 'F',
                    fileName: 'f3',
                    createdAt: '2026-06-03',
                    teeth: [],
                    unitCount: 0,
                    status: 'Calculated',
                    price: 0,
                    notes: '',
                    originalHash: 'hash-xyz' // Unique
                }
            ];
            const dups = getDuplicateHashes(jobs);
            expect(dups.has('hash-abc')).toBe(true);
            expect(dups.has('hash-xyz')).toBe(false);
            expect(dups.size).toBe(1);
        });
    });

    describe('getFilterOptions', () => {
        it('should return empty/default options when no jobs are provided', () => {
            const result = getFilterOptions([]);
            expect(result).toEqual({
                status: [],
                state: ['Original', 'Modified', 'Duplicate'],
                doctorName: [],
                patientName: [],
                material: [],
                type: [],
                isScrewRetained: ['Yes', 'No']
            });
        });

        it('should extract and sort unique values from jobs', () => {
            const jobs: Job[] = [
                {
                    id: '1',
                    patientName: 'John',
                    doctorName: 'Dr. Smith',
                    fileName: 'f1',
                    createdAt: '2026-06-01',
                    teeth: [
                        { number: 11, material: 'Zircon', type: 'Crown' },
                        { number: 12, material: 'Titanium', type: 'Abutment' }
                    ],
                    unitCount: 2,
                    status: 'Calculated',
                    price: 0,
                    notes: ''
                },
                {
                    id: '2',
                    patientName: 'Alice',
                    doctorName: 'Dr. Adams',
                    fileName: 'f2',
                    createdAt: '2026-06-02',
                    teeth: [
                        { number: 21, material: 'Zircon', type: 'Inlay' },
                        { number: 22, material: 'Unknown', type: 'Unknown' }
                    ],
                    unitCount: 2,
                    status: 'Pending',
                    price: 0,
                    notes: ''
                }
            ];

            const result = getFilterOptions(jobs);
            expect(result.status).toEqual(['Calculated', 'Pending']);
            expect(result.doctorName).toEqual(['Dr. Adams', 'Dr. Smith']);
            expect(result.patientName).toEqual(['Alice', 'John']);
            expect(result.material).toEqual(['Titanium', 'Zircon']);
            expect(result.type).toEqual(['Abutment', 'Crown', 'Inlay']);
            expect(result.state).toEqual(['Original', 'Modified', 'Duplicate']);
            expect(result.isScrewRetained).toEqual(['Yes', 'No']);
        });
    });

    describe('filterJobs', () => {
        const sampleJobs: Job[] = [
            {
                id: '1',
                patientName: 'Alice Johnson',
                doctorName: 'Dr. Smith',
                fileName: 'alice_file.json',
                createdAt: '2026-06-01T10:00:00Z',
                teeth: [
                    { number: 11, material: 'Zircon', type: 'Crown', isScrewRetained: true }
                ],
                unitCount: 1,
                status: 'Calculated',
                price: 100,
                notes: ''
            },
            {
                id: '2',
                patientName: 'Bob Smith',
                doctorName: 'Dr. Adams',
                fileName: 'bob_file.json',
                createdAt: '2026-06-02T10:00:00Z',
                teeth: [
                    { number: 21, material: 'Titanium', type: 'Abutment', isScrewRetained: false }
                ],
                unitCount: 1,
                status: 'Pending',
                price: 50,
                notes: ''
            }
        ];

        it('should filter by search text (case-insensitive matching on patient, doctor, filename)', () => {
            expect(filterJobs(sampleJobs, 'alice', {}, {}, new Set())).toHaveLength(1);
            expect(filterJobs(sampleJobs, 'Dr. Smith', {}, {}, new Set())).toHaveLength(1);
            expect(filterJobs(sampleJobs, 'bob_file', {}, {}, new Set())).toHaveLength(1);
            expect(filterJobs(sampleJobs, 'nonexistent', {}, {}, new Set())).toHaveLength(0);
        });

        it('should filter by date range', () => {
            expect(filterJobs(sampleJobs, '', { start: '2026-06-01', end: '2026-06-01' }, {}, new Set())).toHaveLength(1);
            expect(filterJobs(sampleJobs, '', { start: '2026-06-01', end: '2026-06-02' }, {}, new Set())).toHaveLength(2);
            expect(filterJobs(sampleJobs, '', { start: '2026-06-03' }, {}, new Set())).toHaveLength(0);
        });

        it('should filter by columns like doctorName', () => {
            expect(filterJobs(sampleJobs, '', {}, { doctorName: ['Dr. Smith'] }, new Set())).toEqual([sampleJobs[0]]);
            expect(filterJobs(sampleJobs, '', {}, { doctorName: ['Dr. Smith', 'Dr. Adams'] }, new Set())).toHaveLength(2);
            expect(filterJobs(sampleJobs, '', {}, { doctorName: ['Dr. Nonexistent'] }, new Set())).toHaveLength(0);
        });

        it('should filter by state (Original, Modified, Duplicate)', () => {
            const hashA = generateJobHash(sampleJobs[0]);
            const hashB = generateJobHash(sampleJobs[1]);

            const jobsWithHashes: Job[] = [
                { ...sampleJobs[0], originalHash: hashA }, // Original
                { ...sampleJobs[1], originalHash: 'different-hash' }, // Modified
                { ...sampleJobs[0], id: '3', originalHash: hashA } // Duplicate of 1 (since hashA matches hashA, and both exist)
            ];

            const duplicateHashes = new Set([hashA]);

            // Original: originalHash exists, generateJobHash matches originalHash, and is not in duplicateHashes.
            // Wait, since hashA is in duplicateHashes, jobsWithHashes[0] is marked as duplicate.
            // Let's test filter by "Duplicate":
            const dupFiltered = filterJobs(jobsWithHashes, '', {}, { state: ['Duplicate'] }, duplicateHashes);
            expect(dupFiltered).toHaveLength(2); // job 1 and job 3 have originalHash = hashA, which is in duplicateHashes

            // Let's test filter by "Modified":
            const modFiltered = filterJobs(jobsWithHashes, '', {}, { state: ['Modified'] }, duplicateHashes);
            expect(modFiltered).toEqual([jobsWithHashes[1]]);

            // Let's test filter by "Original" on a list where there is a truly unique unmodified job:
            const uniqueUnmodified: Job = { ...sampleJobs[1], originalHash: hashB };
            const jobsWithOriginal = [...jobsWithHashes, uniqueUnmodified];
            const originalFiltered = filterJobs(jobsWithOriginal, '', {}, { state: ['Original'] }, duplicateHashes);
            expect(originalFiltered).toEqual([uniqueUnmodified]);
        });

        it('should filter by tooth material or type', () => {
            expect(filterJobs(sampleJobs, '', {}, { material: ['Zircon'] }, new Set())).toEqual([sampleJobs[0]]);
            expect(filterJobs(sampleJobs, '', {}, { type: ['Abutment'] }, new Set())).toEqual([sampleJobs[1]]);
            expect(filterJobs(sampleJobs, '', {}, { material: ['Titanium'] }, new Set())).toEqual([sampleJobs[1]]);
            expect(filterJobs(sampleJobs, '', {}, { material: ['Gold'] }, new Set())).toHaveLength(0);
        });

        it('should filter by isScrewRetained (Yes / No)', () => {
            expect(filterJobs(sampleJobs, '', {}, { isScrewRetained: ['Yes'] }, new Set())).toEqual([sampleJobs[0]]);
            expect(filterJobs(sampleJobs, '', {}, { isScrewRetained: ['No'] }, new Set())).toEqual([sampleJobs[1]]);
        });
    });

    describe('sortJobs', () => {
        const sampleJobs: Job[] = [
            {
                id: '1',
                patientName: 'Charlie',
                doctorName: 'Dr. Smith',
                fileName: 'c.json',
                createdAt: '2026-06-01',
                teeth: [{ number: 11, material: 'Zircon', type: 'Crown' }],
                unitCount: 1,
                teethMatched: 1,
                status: 'Calculated',
                price: 100,
                notes: ''
            },
            {
                id: '2',
                patientName: 'Alice',
                doctorName: 'Dr. Adams',
                fileName: 'a.json',
                createdAt: '2026-06-02',
                teeth: [{ number: 21, material: 'Titanium', type: 'Abutment' }],
                unitCount: 2,
                teethMatched: 1, // Pending with missing = 1
                status: 'Pending',
                price: 50,
                notes: ''
            },
            {
                id: '3',
                patientName: 'Bob',
                doctorName: 'Dr. Bob',
                fileName: 'b.json',
                createdAt: '2026-06-03',
                teeth: [{ number: 31, material: 'Gold', type: 'Inlay' }],
                unitCount: 1,
                status: 'Review',
                price: 200,
                notes: ''
            }
        ];

        it('should return jobs as is if sortConfig is null', () => {
            expect(sortJobs(sampleJobs, null, new Set())).toEqual(sampleJobs);
        });

        it('should sort by string and number fields', () => {
            const sortedByNameAsc = sortJobs(sampleJobs, { key: 'patientName', direction: 'asc' }, new Set());
            expect(sortedByNameAsc.map(j => j.patientName)).toEqual(['Alice', 'Bob', 'Charlie']);

            const sortedByNameDesc = sortJobs(sampleJobs, { key: 'patientName', direction: 'desc' }, new Set());
            expect(sortedByNameDesc.map(j => j.patientName)).toEqual(['Charlie', 'Bob', 'Alice']);

            const sortedByPriceAsc = sortJobs(sampleJobs, { key: 'price', direction: 'asc' }, new Set());
            expect(sortedByPriceAsc.map(j => j.price)).toEqual([50, 100, 200]);
        });

        it('should sort by status rank', () => {
            // Ranks: Calculated=0, Pending=missing, Review=1000, Invalid=2000, Discarded=3000, others=4000
            // sampleJobs:
            // 1: Calculated (Rank 0)
            // 2: Pending (Rank 1, since unitCount=2, teethMatched=1 => missing = 1)
            // 3: Review (Rank 1000)
            const sortedByStatusAsc = sortJobs(sampleJobs, { key: 'status', direction: 'asc' }, new Set());
            expect(sortedByStatusAsc.map(j => j.id)).toEqual(['1', '2', '3']);

            const sortedByStatusDesc = sortJobs(sampleJobs, { key: 'status', direction: 'desc' }, new Set());
            expect(sortedByStatusDesc.map(j => j.id)).toEqual(['3', '2', '1']);
        });

         it('should sort by state rank', () => {
            const hashA = generateJobHash(sampleJobs[0]);
            const hashC = generateJobHash(sampleJobs[2]);

            const jobsWithHashes: Job[] = [
                { ...sampleJobs[0], originalHash: hashA }, // Rank 1 (Original)
                { ...sampleJobs[1], originalHash: 'diff-hash' }, // Rank 2 (Modified)
                { ...sampleJobs[2], originalHash: hashC } // Rank 3 (Duplicate, because hashC is in duplicateHashes)
            ];

            const duplicateHashes = new Set([hashC]);

            const sortedByStateAsc = sortJobs(jobsWithHashes, { key: 'state', direction: 'asc' }, duplicateHashes);
            expect(sortedByStateAsc.map(j => j.id)).toEqual(['1', '2', '3']);

            const sortedByStateDesc = sortJobs(jobsWithHashes, { key: 'state', direction: 'desc' }, duplicateHashes);
            expect(sortedByStateDesc.map(j => j.id)).toEqual(['3', '2', '1']);
        });

        it('should sort by summary material and type', () => {
            const sortedByMaterialAsc = sortJobs(sampleJobs, { key: 'material', direction: 'asc' }, new Set());
            // Gold, Titanium, Zircon
            expect(sortedByMaterialAsc.map(j => j.id)).toEqual(['3', '2', '1']);

            const sortedByTypeAsc = sortJobs(sampleJobs, { key: 'type', direction: 'asc' }, new Set());
            // Abutment, Crown, Inlay
            expect(sortedByTypeAsc.map(j => j.id)).toEqual(['2', '1', '3']);
        });
    });
});
