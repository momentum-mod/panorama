/**
 * Utility functions for Javascript.
 * Could be ported to C++ and exposed globally in the future.
 */

/**
 * 2D vector object with x and y member variables
 */
type Vec2D = { x: number; y: number };

/**
 * 3D vector object with x, y, and z member variables
 */
type Vec3D = { x: number; y: number; z: number };
type Vector = Vec2D | Vec3D;

/**
 * 2D length of input vector
 */
function getSize2D(vec: Vector): number {
	return Math.sqrt(getSizeSquared2D(vec));
}

/**
 * 2D length squared of input vector
 */
function getSizeSquared2D(vec: Vector): number {
	return vec.x * vec.x + vec.y * vec.y;
}

/**
 * Returns copy of input vector scaled to length 1.
 * If input vector length is less than threshold,
 * the zero vector is returned.
 */
function getNormal2D(vec: Vector, threshold: number): Vec2D {
	const mag = getSize2D(vec);
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
 */
function getDot2D(vec1: Vector, vec2: Vector): number {
	return vec1.x * vec2.x + vec1.y * vec2.y;
}

/**
 * Cross product of two 2D vectors.
 * Defined as Z-component of resultant vector.
 */
function getCross2D(vec1: Vector, vec2: Vector): number {
	return vec1.x * vec2.y - vec1.y * vec2.x;
}

/**
 * Returns 2D copy of input vector rotated anti-clockwise by specified angle (in radians).
 */
function rotateVector2D(vec: Vector, angle: number): Vec2D {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return {
		x: vec.x * cos - vec.y * sin,
		y: vec.y * cos + vec.x * sin
	};
}

/**
 * Float equals check with threshold.
 */
function floatEquals(A: number, B: number, threshold: number): boolean {
	return Math.abs(A - B) < threshold;
}

/**
 * Clamp angle to range [-Pi/2, Pi/2] by wrapping
 */
function wrapToHalfPi(angle: number): number {
	return Math.abs(angle) > Math.PI * 0.5 ? wrapToHalfPi(angle - Math.sign(angle) * Math.PI) : angle;
}

/**
 * Converts [0, 2Pi) to [-Pi, Pi]
 */
function remapAngle(angle: number): number {
	angle += Math.PI;
	const integer = Math.trunc(angle / (2 * Math.PI));
	angle -= integer * 2 * Math.PI;
	return angle < 0 ? angle + Math.PI : angle - Math.PI;
}

/**
 * Convert an angle to a projected screen length in pixels.
 */
function mapAngleToScreenDist(angle: number, fov: number, length: number, scale: number = 1, projection: number = 0) {
	const screenDist = length / scale;

	if (Math.abs(angle) >= fov) {
		return Math.sign(angle) > 0 ? screenDist + 1 : -1;
	}

	switch (projection) {
		case 0:
			return Math.round((1 + Math.tan(angle) / Math.tan(fov)) * screenDist * 0.5);
		case 1:
			return Math.round((1 + angle / fov) * screenDist * 0.5);
		case 2:
			return Math.round((1 + Math.tan(angle * 0.5) / Math.tan(fov * 0.5)) * screenDist * 0.5);
	}
}

function deg2rad(x: number): number {
	return (x / 180) * Math.PI;
}

function rad2deg(x: number): number {
	return (x * 180) / Math.PI;
}
