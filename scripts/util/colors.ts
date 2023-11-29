/**
 * Functions for manipulating RGB/RGBA strings and tuples.
 */

/**
 * Tuple of R, G, B, A values ranged [0, 255]
 */
type RgbaTuple = [number, number, number, number];

/**
 * Returns a string formatted `rgba(R, G, B, A)` from RGBA number tuple, where
 * `R`, `G`, `B` are values ranged [0, 255], `A` ranged [0, 1].
 */
function tupleToRgbaString([r, g, b, a = 255]: RgbaTuple): string {
	return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

/**
 * Returns a corresponding RGBA tuple for an RGB string.
 * Input string must be formatted as `rgb(R, G, B)`, where `R`, `G`, `B`
 * are values ranged `[0, 255]`. A is set to 255.
 *
 * For performance, this function does not check the input string.
 */

function rgbStringToTuple(str: string): RgbaTuple {
	return [
		...str
			.slice(4, -1)
			.split(',')
			.map((c) => Number.parseInt(c)),
		255
	] as RgbaTuple;
}

/**
 * Returns a corresponding RGBA tuple for an RGBA string.
 * Input string must be formatted as `rgb(R, G, B, A)`, where `R`, `G`, `B`
 * are values ranged `[0, 255]`, `A` ranged `[0, 1]`.
 *
 * For performance, this function does not check the input string.
 */

function rgbaStringToTuple(str: string): RgbaTuple {
	if (str[3] !== 'a') return rgbStringToTuple(str);

	return str
		.slice(5, -1)
		.split(',')
		.map((c, i) => (i === 3 ? Math.round(Number.parseFloat(c) * 255) : Number.parseInt(c))) as RgbaTuple;
}
/**
 * Blends two colors linearly (not HSV lerp).
 */
function rgbaTupleLerp(colorA: RgbaTuple, colorB: RgbaTuple, alpha: number): RgbaTuple {
	const interp = Math.max(Math.min(alpha, 1), 0);
	return (colorA as number[]).map((Ai, i) => Math.round(Ai + interp * (colorB[i] - Ai))) as RgbaTuple;
}

/**
 * Blends two colors linearly (not HSV lerp).
 * RGB inputs are converted to RGBA with A value of 1.
 */
function rgbaStringLerp(colorA: string, colorB: string, alpha: number): string {
	const arrayA = rgbaStringToTuple(colorA);
	const arrayB = rgbaStringToTuple(colorB);
	return tupleToRgbaString(rgbaTupleLerp(arrayA, arrayB, alpha));
}

/**
 * Removes A value from string formatted `rgba(R, G, B, A)`.
 */
function rgbaStringToRgb(str: string): string {
	const [r, g, b] = rgbaStringToTuple(str);
	return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Compresses A value from string formatted `rgba(R, G, B, A)` to the range `[0.75, 1]`
 */
function enhanceAlpha(str: string): string {
	const [r, g, b, a = 255] = rgbaStringToTuple(str);
	return tupleToRgbaString([r, g, b, Math.min(0.25 * a + 192, 255)]);
}
