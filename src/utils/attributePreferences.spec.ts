/**
 * @file attributePreferences.spec.ts
 * @brief Unit tests for the localStorage-backed hidden-attribute preferences.
 */

import {
    getHiddenAttributes,
    setHiddenAttributes,
    addHiddenAttribute,
    removeHiddenAttribute,
    toggleHiddenAttribute
} from './attributePreferences';

describe('attributePreferences', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('getHiddenAttributes', () => {
        it('returns an empty array when nothing is stored', () => {
            expect(getHiddenAttributes('material')).toEqual([]);
        });

        it('returns parsed array when valid JSON is stored', () => {
            localStorage.setItem('elszamolos:hidden-attrs:material', JSON.stringify(['Acrylic/PMMA', 'Zirconia']));
            expect(getHiddenAttributes('material')).toEqual(['Acrylic/PMMA', 'Zirconia']);
        });

        it('returns an empty array when stored data is not an array', () => {
            localStorage.setItem('elszamolos:hidden-attrs:material', JSON.stringify({ foo: 'bar' }));
            expect(getHiddenAttributes('material')).toEqual([]);
        });

        it('filters out non-string entries', () => {
            localStorage.setItem('elszamolos:hidden-attrs:material', JSON.stringify(['Zirconia', 42, null, 'WAX']));
            expect(getHiddenAttributes('material')).toEqual(['Zirconia', 'WAX']);
        });

        it('returns an empty array for malformed JSON', () => {
            localStorage.setItem('elszamolos:hidden-attrs:material', 'not-json{');
            expect(getHiddenAttributes('material')).toEqual([]);
        });

        it('uses per-category storage keys', () => {
            setHiddenAttributes('material', ['Zirconia']);
            setHiddenAttributes('type', ['3D Model']);
            expect(getHiddenAttributes('material')).toEqual(['Zirconia']);
            expect(getHiddenAttributes('type')).toEqual(['3D Model']);
            expect(getHiddenAttributes('doctorName')).toEqual([]);
        });
    });

    describe('addHiddenAttribute', () => {
        it('appends a new value to an empty list', () => {
            addHiddenAttribute('material', 'Zirconia');
            expect(getHiddenAttributes('material')).toEqual(['Zirconia']);
        });

        it('appends a new value preserving existing order', () => {
            setHiddenAttributes('material', ['A', 'B']);
            addHiddenAttribute('material', 'C');
            expect(getHiddenAttributes('material')).toEqual(['A', 'B', 'C']);
        });

        it('is idempotent for duplicates', () => {
            addHiddenAttribute('material', 'Zirconia');
            addHiddenAttribute('material', 'Zirconia');
            expect(getHiddenAttributes('material')).toEqual(['Zirconia']);
        });
    });

    describe('removeHiddenAttribute', () => {
        it('removes a value preserving the order of the rest', () => {
            setHiddenAttributes('material', ['A', 'B', 'C']);
            removeHiddenAttribute('material', 'B');
            expect(getHiddenAttributes('material')).toEqual(['A', 'C']);
        });

        it('is a no-op for values not in the list', () => {
            setHiddenAttributes('material', ['A', 'B']);
            removeHiddenAttribute('material', 'C');
            expect(getHiddenAttributes('material')).toEqual(['A', 'B']);
        });

        it('is a no-op for an empty list', () => {
            expect(() => removeHiddenAttribute('material', 'X')).not.toThrow();
            expect(getHiddenAttributes('material')).toEqual([]);
        });
    });

    describe('toggleHiddenAttribute', () => {
        it('hides a value that is currently visible', () => {
            expect(toggleHiddenAttribute('material', 'Zirconia')).toBe(true);
            expect(getHiddenAttributes('material')).toEqual(['Zirconia']);
        });

        it('restores a value that is currently hidden', () => {
            setHiddenAttributes('material', ['Zirconia']);
            expect(toggleHiddenAttribute('material', 'Zirconia')).toBe(false);
            expect(getHiddenAttributes('material')).toEqual([]);
        });
    });
});
