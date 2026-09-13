/**
 * @file Procedural geometry utility functions for generating mock 3D dental models.
 * This module provides factory functions that create placeholder geometries
 * (jaw base, crown, fallback) for testing and visualization purposes.
 */

import * as THREE from 'three';

/**
 * Creates a mock lower/upper jaw base arch shape extrude geometry.
 *
 * Builds a curved arch shape using quadratic bezier curves, then extrudes it
 * with bevel settings to produce a simplified jaw base segment.
 *
 * @returns A centered `THREE.ExtrudeGeometry` representing a jaw base arch, rotated 90° about the X-axis.
 */
export function createJawBaseGeometry(): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(-10, -5);
    shape.quadraticCurveTo(-12, 10, 0, 12);
    shape.quadraticCurveTo(12, 10, 10, -5);
    shape.quadraticCurveTo(8, -8, 0, -4);
    shape.quadraticCurveTo(-8, -8, -10, -5);

    const extrudeSettings = {
        steps: 2,
        depth: 4,
        bevelEnabled: true,
        bevelThickness: 1,
        bevelSize: 0.5,
        bevelSegments: 3
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    geometry.rotateX(Math.PI / 2);
    return geometry;
}

/**
 * Creates a mock single crown tooth geometry using warp cylinder.
 *
 * Generates a cylinder and deforms its top vertices to simulate four molar cusps,
 * producing a tooth-like appearance suitable for preview or placeholder use.
 *
 * @returns A centered `THREE.CylinderGeometry` with vertex normals recomputed to reflect the cusp deformation.
 */
export function createCrownGeometry(): THREE.CylinderGeometry {
    const crownShape = new THREE.CylinderGeometry(4, 5, 8, 32, 4);
    
    // Warp the cylinder slightly to make it look tooth-like (molars have cusps)
    const pos = crownShape.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        // Create 4 cusps on top
        if (y > 3.9) {
            const angle = Math.atan2(z, x);
            const cuspMultiplier = 1.0 + 0.15 * Math.sin(angle * 4);
            pos.setXYZ(i, x * cuspMultiplier, y + 0.8 * Math.sin(angle * 4), z * cuspMultiplier);
        }
    }
    crownShape.computeVertexNormals();
    crownShape.center();
    return crownShape;
}

/**
 * Creates a beautiful torus knot for design.
 *
 * Provides a visually appealing fallback geometry (a torus knot) used when
 * a specific dental model is not available or as a decorative placeholder.
 *
 * @returns A `THREE.TorusKnotGeometry` with a radius of 6, tube radius of 1.8, 100 radial segments, and 16 tubular segments.
 */
export function createFallbackGeometry(): THREE.TorusKnotGeometry {
    return new THREE.TorusKnotGeometry(6, 1.8, 100, 16);
}
