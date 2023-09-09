/**
 * Utility functions for Javascript.
 * Could be ported to C++ and exposed globally in the future.
 */

/**
 * 2D length of input vector
 * @param {object} vec
 * @returns {number}
 */
function getSize(vec) {
	return Math.sqrt(getSizeSquared(vec));
}

/**
 * 2D length squared of input vector
 * @param {object} vec
 * @returns {number}
 */
function getSizeSquared(vec) {
	return vec.x * vec.x + vec.y * vec.y;
}

/**
 * Returns copy of input vector scaled to length 1.
 * If input vector length is less than threshold,
 * the zero vector is returned.
 * @param {object} vec
 * @returns {object}
 */
function getNormal(vec, threshold) {
	const mag = getSize(vec);
	const vecNormal = {
		x: vec.x,
		y: vec.y
	};
	if (mag < threshold * threshold) {
		vecNormal.x = 0;
		vecNormal.y = 0;
	} else {
		const inv = 1 / mag;
		vecNormal.x *= inv;
		vecNormal.y *= inv;
	}
	return vecNormal;
}

/**
 * Dot product of two vectors.
 * @param {object} vec1
 * @param {object} vec2
 * @returns {number}
 */
function getDot(vec1, vec2) {
	return vec1.x * vec2.x + vec1.y * vec2.y;
}

/**
 * Cross product of two 2D vectors.
 * Defined as Z-component of resultant vector.
 * @param {object} vec1
 * @param {object} vec2
 * @returns {number}
 */
function getCross(vec1, vec2) {
	return vec1.x * vec2.y - vec1.y * vec2.x;
}

/**
 * Rotate 2D vector anti-clockwise by specified angle (in radians).
 * @param {object} vector
 * @param {number} angle
 * @returns {object}
 */
function rotateVector(vector, angle) {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return {
		x: vector.x * cos - vector.y * sin,
		y: vector.y * cos + vector.x * sin
	};
}

/**
 * Float equals check with threshold.
 * @param {number} A
 * @param {number} B
 * @param {number} threshold
 * @returns {boolean}
 */
function floatEquals(A, B, threshold) {
	return Math.abs(A - B) < threshold;
}

/**
 * Clamp angle to range [-Pi/2, Pi/2] by wrapping
 * @param {number} angle
 * @returns {number}
 */
function wrapToHalfPi(angle) {
	return Math.abs(angle) > Math.PI * 0.5 ? wrapToHalfPi(angle - Math.sign(angle) * Math.PI) : angle;
}

/**
 * Converts [0, 2Pi) to [-Pi, Pi]
 * @param {number} angle
 * @returns {number}
 */
function remapAngle(angle) {
	angle += Math.PI;
	const integer = Math.trunc(angle / (2 * Math.PI));
	angle -= integer * 2 * Math.PI;
	return angle < 0 ? angle + Math.PI : angle - Math.PI;
}
