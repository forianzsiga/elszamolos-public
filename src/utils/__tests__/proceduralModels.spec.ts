import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    createJawBaseGeometry,
    createCrownGeometry,
    createFallbackGeometry
} from '../proceduralModels';

describe('proceduralModels', () => {
    describe('createJawBaseGeometry', () => {
        it('should return a valid, initialized ExtrudeGeometry instance', () => {
            const geometry = createJawBaseGeometry();
            expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
            expect(geometry.attributes.position).toBeDefined();
            expect(geometry.attributes.position.count).toBeGreaterThan(0);
            geometry.dispose();
        });
    });

    describe('createCrownGeometry', () => {
        it('should return a valid, initialized CylinderGeometry instance with warped positions', () => {
            const geometry = createCrownGeometry();
            expect(geometry).toBeInstanceOf(THREE.CylinderGeometry);
            expect(geometry.attributes.position).toBeDefined();
            expect(geometry.attributes.position.count).toBeGreaterThan(0);
            geometry.dispose();
        });
    });

    describe('createFallbackGeometry', () => {
        it('should return a valid, initialized TorusKnotGeometry instance', () => {
            const geometry = createFallbackGeometry();
            expect(geometry).toBeInstanceOf(THREE.TorusKnotGeometry);
            expect(geometry.attributes.position).toBeDefined();
            expect(geometry.attributes.position.count).toBeGreaterThan(0);
            geometry.dispose();
        });
    });
});
