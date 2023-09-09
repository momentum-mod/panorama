/**
 * Utility functions for Javascript.
 * Could be ported to C++ and exposed globally in the future.
 */

/**
 * Returns a string formatted:
 * rgba(R, G, B, A)
 * from color array, where input array elements are range [0, 255].
 * R, G, B values ranged [0, 255], A ranged [0, 1].
 * @param {array} color
 * @returns {string}
 */
function getColorStringFromArray(color) {
	return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
}

/**
 * Returns a array of RGBA values ranged [0, 255].
 * Input string must be formatted:
 * rgba(R, G, B, A)
 * where R, G, B values ranged [0, 255], A ranged [0, 1].
 * @param {array} color
 * @returns {string}
 */
function splitColorString(string) {
	return string
		.slice(5, -1)
		.split(',')
		.map((c, i) => (i === 3 ? Number.parseInt(c * 255) : Number.parseInt(c)));
}

/**
 * Blends two colors linearly (not HSV lerp).
 * RGB inputs are converted to RGBA with alpha value of 1.
 * @param {string} colorA
 * @param {string} colorB
 * @param {number} alpha
 * @returns {string}
 */
function colorLerp(colorA, colorB, alpha) {
	const arrayA = splitColorString(colorA);
	const arrayB = splitColorString(colorB);
	const interp = Math.max(Math.min(alpha, 1), 0);
	if (arrayA.length === 3) arrayA.push(255);
	if (arrayB.length === 3) arrayB.push(255);
	return getColorStringFromArray(arrayA.map((Ai, i) => Ai + interp * (arrayB[i] - Ai)));
}

/**
 * Removes A value from string formatted:
 * rgba(R, G, B, A)
 * @param {string} colorString
 * @returns {string}
 */
function getRgbFromRgba(colorString) {
	const [r, g, b] = splitColorString(colorString);
	return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Compresses A value from string formatted:
 * rgba(R, G, B, A)
 * to the range [0.75, 1]
 * @param {string} colorString
 * @returns {string}
 */
function enhanceAlpha(colorString) {
	const [r, g, b, a] = splitColorString(colorString);
	return getColorStringFromArray([r, g, b, Math.min(0.25 * a + 192, 255)]);
}
