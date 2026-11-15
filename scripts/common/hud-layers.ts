/**
 * Layer helpers for the HUD customizer.
 *
 * A HUD layout is resolved from a stack of layers, each winning over the ones above it, field by field:
 *   L0 cfg/hud/base_default.kv3       shipped, every gamemode
 *   L1 cfg/hud/<mode>_default.kv3     shipped, per gamemode
 *
 * This module is pure (no Panorama globals).
 */

export type LayerObject = Record<string, unknown>;

/** Numbers closer than this are equal when diffing layers */
const NUMBER_EPSILON = 1e-4;

export function isPlainObject(value: unknown): value is LayerObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNullish(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

/** Deep copy of plain data (objects, arrays, primitives). `undefined` object values are dropped. */
export function cloneData<T>(value: T): T {
	if (Array.isArray(value)) return value.map((item) => cloneData(item)) as T;
	if (isPlainObject(value)) {
		const out: LayerObject = {};
		for (const [key, item] of Object.entries(value)) {
			if (item !== undefined) out[key] = cloneData(item);
		}
		return out as T;
	}
	return value;
}

/** Deep equality where `null` and `undefined` (and a missing object key) are the same thing. */
export function equalData(a: unknown, b: unknown): boolean {
	if (isNullish(a) || isNullish(b)) return isNullish(a) && isNullish(b);
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((item, i) => equalData(item, b[i]));
	}
	if (isPlainObject(a) || isPlainObject(b)) {
		if (!isPlainObject(a) || !isPlainObject(b)) return false;
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		for (const key of keys) {
			if (!equalData(a[key], b[key])) return false;
		}
		return true;
	}
	// Positions go through aspect ratio scaling and back, so allow float noise
	if (typeof a === 'number' && typeof b === 'number') return a === b || Math.abs(a - b) < NUMBER_EPSILON;
	return a === b;
}

function mergeInto(below: LayerObject, layer: LayerObject): LayerObject {
	const out: LayerObject = { ...below };
	for (const [key, value] of Object.entries(layer)) {
		if (value === undefined) continue;
		out[key] = isPlainObject(value) && isPlainObject(below[key]) ? mergeInto(below[key], value) : cloneData(value);
	}
	return out;
}

/**
 * Field-level merge of layers, lowest first. Objects merge recursively, everything else (including `null` and arrays)
 * replaces the value below. Missing layers are skipped. List deltas are resolved by hud-keyed-lists' resolveLayers.
 *
 * The result shares no objects with the inputs, so it is safe to modify.
 */
export function mergeLayers(layers: ReadonlyArray<LayerObject | null | undefined>) {
	let result: LayerObject = {};
	for (const layer of layers) {
		if (isPlainObject(layer)) result = mergeInto(result, layer);
	}
	return result;
}

/**
 * The smallest layer that turns `parent` into `edited` when merged on top of it with {@link mergeLayers}.
 * Arrays are compared deeply and stored whole. Returns `undefined` when there is no difference.
 *
 * Nullish values in `edited` never produce a delta: KV3 files can't store `null` (it is dropped on save), so a layer
 * can't unset a value from a layer below. Missing keys are common anyway, since shipped layouts carry style keys that
 * components no longer define.
 */
export function fieldDelta(parent: unknown, edited: unknown): unknown {
	if (isNullish(edited)) return undefined;

	if (isPlainObject(edited)) {
		// Diff against an empty object when the parent has none, so an object without values is no difference
		const parentObject = isPlainObject(parent) ? parent : {};
		const out: LayerObject = {};
		for (const [key, value] of Object.entries(edited)) {
			const delta = fieldDelta(parentObject[key], value);
			if (delta !== undefined) out[key] = delta;
		}
		return Object.keys(out).length > 0 ? out : undefined;
	}

	return equalData(parent, edited) ? undefined : cloneData(edited);
}
