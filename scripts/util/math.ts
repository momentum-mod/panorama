export function magnitude(vec: vec2 | vec3): number {
	return Math.sqrt(sumOfSquares(vec));
}

export function magnitude2D(vec: vec2 | vec3): number {
	return Math.sqrt(sumOfSquares2D(vec));
}

export function normalizeVector(vec: vec3): vec3 {
	const mag = magnitude(vec);
	if (mag === 0) {
		return { x: 0, y: 0, z: 0 };
	}

	return { x: vec.x / mag, y: vec.y / mag, z: vec.z / mag };
}

export function normalizeVector2D(vec: vec2): vec2 {
	const mag = magnitude2D(vec);
	if (mag === 0) {
		return { x: 0, y: 0 };
	}

	return { x: vec.x / mag, y: vec.y / mag };
}

// Note: Math.hypot performs additional bounds checking on V8 which which makes it considerably
// slower than below implementations.
export function sumOfSquares2D(vec: vec2 | vec3): number {
	return vec.x ** 2 + vec.y ** 2;
}

export function sumOfSquares(vec: vec2 | vec3): number {
	return 'z' in vec ? vec.x ** 2 + vec.y ** 2 + vec.z ** 2 : sumOfSquares2D(vec);
}

/**
 * Returns copy of input vector scaled to length 1.
 * If input vector length is less than threshold,
 * the zero vector is returned.
 */
export function normal2D(vec: vec2, threshold: number): vec2 {
	const mag = magnitude2D(vec);
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

/** Dot product of two vectors. */
export function dot2D(vec1: vec2, vec2: vec2): number {
	return vec1.x * vec2.x + vec1.y * vec2.y;
}

/**
 * Cross product of two 2D vectors.
 * Defined as Z-component of resultant vector.
 */
export function cross2D(vec1: vec2, vec2: vec2): number {
	return vec1.x * vec2.y - vec1.y * vec2.x;
}

/**
 * Returns 2D copy of input vector rotated anti-clockwise by specified angle (in radians).
 */
export function rotateVector2D(vec: vec2, angle: number): vec2 {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return {
		x: vec.x * cos - vec.y * sin,
		y: vec.y * cos + vec.x * sin
	};
}

/** Float equals check with threshold. */
export function approxEquals(A: number, B: number, threshold: number): boolean {
	return Math.abs(A - B) < threshold;
}

/** Clamp angle to range [-Pi/2, Pi/2] by wrapping */
export function wrapToHalfPi(angle: number): number {
	return Math.abs(angle) > Math.PI * 0.5 ? wrapToHalfPi(angle - Math.sign(angle) * Math.PI) : angle;
}

/** Converts [0, 2Pi) to [-Pi, Pi] */
export function remapAngle(angle: number): number {
	angle += Math.PI;
	const integer = Math.trunc(angle / (2 * Math.PI));
	angle -= integer * 2 * Math.PI;
	return angle < 0 ? angle + Math.PI : angle - Math.PI;
}

/** Convert an angle to a projected screen length in pixels. */
export function mapAngleToScreenDist(
	angle: number,
	fov: number,
	length: number,
	scale: number = 1,
	projection: number = 0
) {
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

export function deg2rad(x: number): number {
	return (x / 180) * Math.PI;
}

export function rad2deg(x: number): number {
	return (x * 180) / Math.PI;
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}
