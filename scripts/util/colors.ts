/** Tuple of R, G, B, A values ranged [0, 255] (including A) */
export type RgbaTuple = [number, number, number, number];

/**
 * Returns a string formatted `rgba(R, G, B, A)` from RGBA number tuple, where
 * `R`, `G`, `B` are values ranged [0, 255], `A` ranged [0, 1].
 */
export function tupleToRgbaString([r, g, b, a = 255]: RgbaTuple): rgbaColor {
	return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

/**
 * Returns a corresponding RGBA tuple for an RGB string.
 * Input string must be formatted as `rgb(R, G, B)`, where `R`, `G`, `B`
 * are values ranged `[0, 255]`. A is set to 255.
 *
 * For performance, this function does not check the input string.
 */
export function rgbStringToTuple(str: string): RgbaTuple {
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
 */
export function rgbaStringToTuple(str: string): RgbaTuple {
	if (str[3] !== 'a') return rgbStringToTuple(str);

	return str
		.slice(5, -1)
		.split(',')
		.map((c, i) => (i === 3 ? Math.round(Number.parseFloat(c) * 255) : Number.parseInt(c))) as RgbaTuple;
}

/**
 * Blends two tuples linearly by alpha value.
 */
export function rgbaTupleLerp(colorA: RgbaTuple, colorB: RgbaTuple, alpha: number): RgbaTuple {
	const interp: number = Math.max(Math.min(alpha, 1), 0);
	return (colorA as number[]).map((Ai, i) => Math.round(Ai + interp * (colorB[i] - Ai))) as RgbaTuple;
}

/**
 * Blends two strings linearly by alpha.
 * RGB inputs are converted to RGBA with A value of 1.
 */
export function rgbaStringLerp(colorA: string, colorB: string, alpha: number, useHsv: boolean = false): string {
	const arrayA: RgbaTuple = rgbaStringToTuple(colorA);
	const arrayB: RgbaTuple = rgbaStringToTuple(colorB);
	if (!useHsv) {
		return tupleToRgbaString(rgbaTupleLerp(arrayA, arrayB, alpha));
	}

	const fromHsv: RgbaTuple = rgbaToHsva(arrayA) as RgbaTuple;
	const toHsv: RgbaTuple = rgbaToHsva(arrayB) as RgbaTuple;

	// Take the shortest path to the new hue
	if (Math.abs(fromHsv[0] - toHsv[0]) > 180) {
		if (toHsv[0] > fromHsv[0]) {
			fromHsv[0] += 360;
		} else {
			toHsv[0] += 360;
		}
	}
	const newHsv = rgbaTupleLerp(fromHsv, toHsv, alpha);

	newHsv[0] = newHsv[0] % 360;
	if (newHsv[0] < 0) {
		newHsv[0] += 360;
	}

	const newRgb: RgbaTuple = hsvaToRgba(newHsv) as RgbaTuple;

	return tupleToRgbaString(newRgb);
}

/** Converts HSVA tuple to RGBA tuple */
export function hsvaToRgba([h, s, v, a]: RgbaTuple): RgbaTuple {
	const hueDir: number = h / 60; // divide color wheel into Red, Yellow, Green, Cyan, Blue, Magenta
	const hueDirFloor: number = Math.floor(hueDir); // see which of the six regions holds the color to be converted
	const hueDirFraction: number = hueDir - hueDirFloor;

	const rgbValues: RgbaTuple = [v, v * (1 - s), v * (1 - hueDirFraction * s), v * (1 - (1 - hueDirFraction) * s)];
	const rgbSwizzle: number[][] = [
		[0, 3, 1],
		[2, 0, 1],
		[1, 0, 3],
		[1, 2, 0],
		[3, 1, 0],
		[0, 1, 2]
	];
	const swizzleIndex: number = hueDirFloor % 6;

	return [
		rgbValues[rgbSwizzle[swizzleIndex][0]] * 255,
		rgbValues[rgbSwizzle[swizzleIndex][1]] * 255,
		rgbValues[rgbSwizzle[swizzleIndex][2]] * 255,
		a
	] as RgbaTuple;
}

/** Converts RGBA tuple to HSVA tuple */
export function rgbaToHsva([r, g, b, a]: RgbaTuple): RgbaTuple {
	const rgbMin: number = Math.min(r, g, b);
	const rgbMax: number = Math.max(r, g, b);
	const rgbRange: number = rgbMax - rgbMin;

	const h: number =
		rgbMax === rgbMin
			? 0
			: rgbMax === r
				? (((g - b) / rgbRange) * 60 + 360) % 360
				: rgbMax === g
					? ((b - r) / rgbRange) * 60 + 120
					: rgbMax === b
						? ((r - g) / rgbRange) * 60 + 240
						: 0;

	const s: number = rgbMax === 0 ? 0 : rgbRange / rgbMax;
	const v: number = rgbMax / 255;

	return [h, s, v, a] as RgbaTuple;
}

/** Removes A value from string formatted `rgba(R, G, B, A)`. */
export function rgbaStringToRgb(str: rgbaColor): rgbColor {
	const [r, g, b] = rgbaStringToTuple(str);
	return `rgb(${r}, ${g}, ${b})`;
}

/** Compresses A value from string formatted `rgba(R, G, B, A)` to the range `[0.75, 1]` */
export function enhanceAlpha(str: rgbaColor): rgbaColor {
	const [r, g, b, a = 255] = rgbaStringToTuple(str);
	return tupleToRgbaString([r, g, b, Math.min(0.25 * a + 192, 255)]);
}