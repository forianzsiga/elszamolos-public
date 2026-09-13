/**
 * @file fresnelEdgeMaterial.ts
 * @brief Provides a THREE.ShaderMaterial for rendering hidden meshes with a faint fresnel rim edge.
 *
 * Hidden meshes are rendered with very low base opacity (~0.05) and a slightly more
 * visible rim edge (~0.25 opacity) using the Fresnel effect. The rim color is the
 * layer's distinct color, allowing the user to see where hidden geometry exists.
 *
 * @see THREE.ShaderMaterial
 */

import * as THREE from 'three';

/**
 * Creates a `THREE.ShaderMaterial` configured for a Fresnel rim-edge effect.
 *
 * The material uses a custom shader that computes a Fresnel term based on the angle
 * between the view direction and the surface normal. This produces a rim glow effect
 * at the edges of the mesh while keeping the center nearly transparent.
 *
 * To stop overlapping translucent rims from "popping" (transparent sort flips as
 * the camera rotates), set `alphaTest > 0`. The shader then discards fragments
 * whose alpha falls below the threshold so the surviving pixels can write depth.
 * This makes rim-vs-rim and rim-vs-opaque occlusion correct without making the
 * mesh look fully opaque.
 *
 * @param color          - Hex color string (e.g. `"#ff0000"`) for the rim glow and base tint.
 * @param baseAlpha      - Base opacity of the mesh (default `0.05`).
 * @param fresnelAlpha   - Opacity of the fresnel rim highlight (default `0.25`).
 * @param fresnelPower   - Exponent controlling the rim falloff (default `2.0`).
 * @param alphaTest      - Fragments with alpha below this value are discarded (default `0`).
 *                         When `> 0`, the material also writes depth for surviving pixels,
 *                         which fixes the popping between overlapping translucent rims.
 * @returns A configured `THREE.ShaderMaterial` ready to use on a fresnel-rim mesh.
 */
export function createFresnelEdgeMaterial(
    color: string,
    baseAlpha = 0.05,
    fresnelAlpha = 0.25,
    fresnelPower = 2.0,
    alphaTest = 0.0
): THREE.ShaderMaterial {
    const colorObj = new THREE.Color(color);
    const writeDepth = alphaTest > 0;

    return new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: colorObj },
            uBaseAlpha: { value: baseAlpha },
            uFresnelAlpha: { value: fresnelAlpha },
            uFresnelPower: { value: fresnelPower },
            uAlphaTest: { value: alphaTest },
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;

            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 uColor;
            uniform float uBaseAlpha;
            uniform float uFresnelAlpha;
            uniform float uFresnelPower;
            uniform float uAlphaTest;

            varying vec3 vNormal;
            varying vec3 vViewPosition;

            void main() {
                vec3 viewDirection = normalize(vViewPosition);
                float fresnel = 1.0 - abs(dot(vNormal, viewDirection));
                float alpha = uBaseAlpha + uFresnelAlpha * pow(fresnel, uFresnelPower);
                // Discard low-alpha fragments so they neither paint nor write depth.
                // This keeps translucent rims from "popping" by relying on depth-test
                // for occlusion instead of Three.js's back-to-front transparent sort.
                if (alpha < uAlphaTest) discard;
                gl_FragColor = vec4(uColor, alpha);
            }
        `,
        transparent: true,
        depthWrite: writeDepth,
        depthTest: true,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
    });
}
