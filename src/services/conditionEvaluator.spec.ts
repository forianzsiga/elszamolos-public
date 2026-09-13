import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluateRuleMatch, type EvaluationContext } from './conditionEvaluator';
import type { TariffCondition, TariffRule } from '../types';

const createMockContext = (overrides?: Partial<EvaluationContext>): EvaluationContext => ({
    id: 'job-1',
    patientName: 'John Doe',
    doctorName: 'Dr. Smith',
    fileName: 'test.dentalProject',
    createdAt: '2026-06-01T12:00:00Z',
    material: 'Zircon',
    type: 'Crown',
    unitCount: 1,
    price: 0,
    notes: '',
    ...overrides
});

describe('Condition Evaluator', () => {
    describe('evaluateCondition', () => {
        it('should match exact string values with equals', () => {
            const context = createMockContext({ material: 'Zircon' });
            const condition: TariffCondition = { field: 'material', operator: 'equals', value: 'Zircon' };
            expect(evaluateCondition(context, condition)).toBe(true);

            const wrongCondition: TariffCondition = { field: 'material', operator: 'equals', value: 'PMMA' };
            expect(evaluateCondition(context, wrongCondition)).toBe(false);
        });

        it('should handle case insensitivity with equals', () => {
            const context = createMockContext({ material: 'ZIRCON' });
            const condition: TariffCondition = { field: 'material', operator: 'equals', value: 'zircon' };
            expect(evaluateCondition(context, condition)).toBe(true);
        });

        it('should match notEquals operator correctly', () => {
            const context = createMockContext({ material: 'Zircon' });
            const condition: TariffCondition = { field: 'material', operator: 'notEquals', value: 'PMMA' };
            expect(evaluateCondition(context, condition)).toBe(true);

            const wrongCondition: TariffCondition = { field: 'material', operator: 'notEquals', value: 'Zircon' };
            expect(evaluateCondition(context, wrongCondition)).toBe(false);
        });

        it('should match contains and notContains operators', () => {
            const context = createMockContext({ doctorName: 'Dr. Kovács Béla' });
            
            const condContains: TariffCondition = { field: 'doctorName', operator: 'contains', value: 'Kovács' };
            expect(evaluateCondition(context, condContains)).toBe(true);

            const condNotContains: TariffCondition = { field: 'doctorName', operator: 'notContains', value: 'Smith' };
            expect(evaluateCondition(context, condNotContains)).toBe(true);
        });

        it('should match greaterThan and lessThan numeric operators', () => {
            const context = createMockContext({ unitCount: 5 });
            
            const condGt: TariffCondition = { field: 'unitCount', operator: 'greaterThan', value: 3 };
            expect(evaluateCondition(context, condGt)).toBe(true);

            const condLt: TariffCondition = { field: 'unitCount', operator: 'lessThan', value: 10 };
            expect(evaluateCondition(context, condLt)).toBe(true);

            const condLtFalse: TariffCondition = { field: 'unitCount', operator: 'lessThan', value: 2 };
            expect(evaluateCondition(context, condLtFalse)).toBe(false);
        });

        it('should handle boolean condition checks', () => {
            const context = createMockContext({ isScrewRetained: true });
            
            const condTrue: TariffCondition = { field: 'isScrewRetained', operator: 'equals', value: true };
            expect(evaluateCondition(context, condTrue)).toBe(true);

            const condFalse: TariffCondition = { field: 'isScrewRetained', operator: 'equals', value: false };
            expect(evaluateCondition(context, condFalse)).toBe(false);

            const condNotEquals: TariffCondition = { field: 'isScrewRetained', operator: 'notEquals', value: false };
            expect(evaluateCondition(context, condNotEquals)).toBe(true);
        });

        it('should handle isOneOf and notOneOf list operators', () => {
            const context = createMockContext({ material: 'Zircon' });
            
            const condOneOf: TariffCondition = { field: 'material', operator: 'isOneOf', value: ['PMMA', 'Zircon', 'Titanium'] };
            expect(evaluateCondition(context, condOneOf)).toBe(true);

            const condNotOneOf: TariffCondition = { field: 'material', operator: 'notOneOf', value: ['PMMA', 'Titanium'] };
            expect(evaluateCondition(context, condNotOneOf)).toBe(true);
        });

        it('should return false for missing context fields', () => {
            const context = createMockContext();
            const condition: TariffCondition = { field: 'projectId', operator: 'equals', value: 'some-id' };
            expect(evaluateCondition(context, condition)).toBe(false);
        });
    });

    describe('evaluateRuleMatch', () => {
        it('should return true if all conditions match', () => {
            const context = createMockContext({ material: 'Zircon', type: 'Crown' });
            const rule: TariffRule = {
                id: 'rule-1',
                name: 'Rule',
                label: 'Rule',
                priority: 1,
                conditions: [
                    { field: 'material', operator: 'equals', value: 'Zircon' },
                    { field: 'type', operator: 'equals', value: 'Crown' }
                ],
                action: { value: 100 }
            };
            expect(evaluateRuleMatch(context, rule)).toBe(true);
        });

        it('should return false if any condition fails to match', () => {
            const context = createMockContext({ material: 'Zircon', type: 'Bridge' });
            const rule: TariffRule = {
                id: 'rule-1',
                name: 'Rule',
                label: 'Rule',
                priority: 1,
                conditions: [
                    { field: 'material', operator: 'equals', value: 'Zircon' },
                    { field: 'type', operator: 'equals', value: 'Crown' }
                ],
                action: { value: 100 }
            };
            expect(evaluateRuleMatch(context, rule)).toBe(false);
        });
    });
});
