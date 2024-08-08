"use strict";
/**
 * Functions for manipulating RGB/RGBA strings and tuples.
 */
/**
 * Returns a string formatted `rgba(R, G, B, A)` from RGBA number tuple, where
 * `R`, `G`, `B` are values ranged [0, 255], `A` ranged [0, 1].
 */
function tupleToRgbaString([r, g, b, a = 255]) {
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}
/**
 * Returns a corresponding RGBA tuple for an RGB string.
 * Input string must be formatted as `rgb(R, G, B)`, where `R`, `G`, `B`
 * are values ranged `[0, 255]`. A is set to 255.
 *
 * For performance, this function does not check the input string.
 */
function rgbStringToTuple(str) {
    return [
        ...str
            .slice(4, -1)
            .split(',')
            .map((c) => Number.parseInt(c)),
        255
    ];
}
/**
 * Returns a corresponding RGBA tuple for an RGBA string.
 * Input string must be formatted as `rgb(R, G, B, A)`, where `R`, `G`, `B`
 * are values ranged `[0, 255]`, `A` ranged `[0, 1]`.
 */
function rgbaStringToTuple(str) {
    if (str[3] !== 'a')
        return rgbStringToTuple(str);
    return str
        .slice(5, -1)
        .split(',')
        .map((c, i) => (i === 3 ? Math.round(Number.parseFloat(c) * 255) : Number.parseInt(c)));
}
/**
 * Blends two tuples linearly by alpha value.
 */
function rgbaTupleLerp(colorA, colorB, alpha) {
    const interp = Math.max(Math.min(alpha, 1), 0);
    return colorA.map((Ai, i) => Math.round(Ai + interp * (colorB[i] - Ai)));
}
/**
 * Blends two strings linearly by alpha.
 * RGB inputs are converted to RGBA with A value of 1.
 */
function rgbaStringLerp(colorA, colorB, alpha, useHsv = false) {
    const arrayA = rgbaStringToTuple(colorA);
    const arrayB = rgbaStringToTuple(colorB);
    if (!useHsv)
        return tupleToRgbaString(rgbaTupleLerp(arrayA, arrayB, alpha));
    const fromHsv = rgbaToHsva(arrayA);
    const toHsv = rgbaToHsva(arrayB);
    // Take the shortest path to the new hue
    if (Math.abs(fromHsv[0] - toHsv[0]) > 180) {
        if (toHsv[0] > fromHsv[0]) {
            fromHsv[0] += 360;
        }
        else {
            toHsv[0] += 360;
        }
    }
    const newHsv = rgbaTupleLerp(fromHsv, toHsv, alpha);
    newHsv[0] = newHsv[0] % 360;
    if (newHsv[0] < 0) {
        newHsv[0] += 360;
    }
    const newRgb = hsvaToRgba(newHsv);
    return tupleToRgbaString(newRgb);
}
/**
 * Converts HSVA tuple to RGBA tuple
 */
function hsvaToRgba([h, s, v, a]) {
    const hueDir = h / 60; // divide color wheel into Red, Yellow, Green, Cyan, Blue, Magenta
    const hueDirFloor = Math.floor(hueDir); // see which of the six regions holds the color to be converted
    const hueDirFraction = hueDir - hueDirFloor;
    const rgbValues = [v, v * (1 - s), v * (1 - hueDirFraction * s), v * (1 - (1 - hueDirFraction) * s)];
    const rgbSwizzle = [
        [0, 3, 1],
        [2, 0, 1],
        [1, 0, 3],
        [1, 2, 0],
        [3, 1, 0],
        [0, 1, 2]
    ];
    const swizzleIndex = hueDirFloor % 6;
    return [
        rgbValues[rgbSwizzle[swizzleIndex][0]] * 255,
        rgbValues[rgbSwizzle[swizzleIndex][1]] * 255,
        rgbValues[rgbSwizzle[swizzleIndex][2]] * 255,
        a
    ];
}
/**
 * Converts RGBA tuple to HSVA tuple
 */
function rgbaToHsva([r, g, b, a]) {
    const rgbMin = Math.min(r, g, b);
    const rgbMax = Math.max(r, g, b);
    const rgbRange = rgbMax - rgbMin;
    const h = rgbMax === rgbMin
        ? 0
        : rgbMax === r
            ? (((g - b) / rgbRange) * 60 + 360) % 360
            : rgbMax === g
                ? ((b - r) / rgbRange) * 60 + 120
                : rgbMax === b
                    ? ((r - g) / rgbRange) * 60 + 240
                    : 0;
    const s = rgbMax === 0 ? 0 : rgbRange / rgbMax;
    const v = rgbMax / 255;
    return [h, s, v, a];
}
/**
 * Removes A value from string formatted `rgba(R, G, B, A)`.
 */
function rgbaStringToRgb(str) {
    const [r, g, b] = rgbaStringToTuple(str);
    return `rgb(${r}, ${g}, ${b})`;
}
/**
 * Compresses A value from string formatted `rgba(R, G, B, A)` to the range `[0.75, 1]`
 */
function enhanceAlpha(str) {
    const [r, g, b, a = 255] = rgbaStringToTuple(str);
    return tupleToRgbaString([r, g, b, Math.min(0.25 * a + 192, 255)]);
}
