/**
 * @file Utility functions for generating consistent colors from string seeds.
 *       Uses HSV-to-Hex conversion and Golden Ratio Hue distribution to produce
 *       visually equidistant colors.
 */

/**
 * Generates a consistent color from a string seed using Golden Ratio Hue generation.
 * Ensures equidistant distribution on the hue scale to avoid clustering.
 * Uses maximum Saturation and Value as requested.
 */

/**
 * Converts HSV (Hue, Saturation, Value) color values to a hexadecimal color string.
 *
 * @param h - Hue value in degrees (0-360).
 * @param s - Saturation percentage (0-100).
 * @param v - Value / Brightness percentage (0-100).
 * @returns A hexadecimal color string in the form "#RRGGBB".
 */
function hsvToHex(h: number, s: number, v: number): string {
    const sNorm = s / 100;
    const vNorm = v / 100;
    const c = vNorm * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = vNorm - c;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; }
    else if (60 <= h && h < 120) { r = x; g = c; }
    else if (120 <= h && h < 180) { g = c; b = x; }
    else if (180 <= h && h < 240) { g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; b = c; }
    else if (300 <= h && h < 360) { r = c; b = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Generates a consistent hexadecimal color from an arbitrary string seed.
 * The color is derived by hashing the string and applying the Golden Angle
 * (approx. 137.508°) to distribute hues evenly across the color wheel.
 * Saturation and Value are kept at maximum (100%) for vivid colors.
 *
 * @param str - The input string used as the seed for color generation.
 * @returns A hexadecimal color string in the form "#RRGGBB".
 */
export const stringToColor = (str: string, s = 100, v = 100) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Golden Angle approximation to distribute hues evenly
    const goldenAngle = 137.508;
    const hue = (Math.abs(hash) * goldenAngle) % 360;
    
    return hsvToHex(hue, s, v);
};
