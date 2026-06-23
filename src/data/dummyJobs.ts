import type { Job } from '../types';

export const DUMMY_JOBS: Job[] = [
    {
        id: 'dummy-1',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        patientName: 'Kiss János (Demo)',
        doctorName: 'Dr. Kovács Béla',
        unitCount: 2,
        status: 'Calculated',
        price: 15000,
        currency: 'HUF',
        teeth: [{ number: 11, material: 'Zirconia', type: 'Crown', status: 'Calculated' }, { number: 12, material: 'Zirconia', type: 'Crown', status: 'Calculated' }],
        fileName: 'demo1.dentalProject'
    } as unknown as Job,
    {
        id: 'dummy-2',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        patientName: 'Nagy Éva (Demo)',
        doctorName: 'Dr. Szabó Anna',
        unitCount: 1,
        status: 'Invoiced',
        price: 45,
        currency: 'EUR',
        teeth: [{ number: 21, material: 'Titanium', type: 'Abutment', status: 'Invoiced' }],
        fileName: 'demo2.dentalProject'
    } as unknown as Job,
    {
        id: 'dummy-3',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        patientName: 'Varga Péter (Demo)',
        doctorName: 'Dr. Kovács Béla',
        unitCount: 3,
        status: 'Pending',
        price: 0,
        currency: 'HUF',
        teeth: [{ number: 31, material: 'PMMA', type: 'Bridge', status: 'Pending' }],
        fileName: 'demo3.dentalProject'
    } as unknown as Job,
];
