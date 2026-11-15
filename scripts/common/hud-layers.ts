/**
 * Layer helpers for HUD customizer base profiles.
 *
 * A HUD layout is resolved from a stack of layers:
 *   L0 cfg/hud/hud_default.kv3        shipped, every gamemode
 *   L1 cfg/hud/<mode>_default.kv3     shipped, per gamemode
 *   L2 cfg/hud/base_<name>.kv3        player base profile, shared by every gamemode
 *   L3 cfg/hud/<mode>_<preset>.kv3    player preset
 *
 * L2 and attached L3 files store field-level deltas: only the values that differ from the layers below.
 *
 * Each layer wins over the ones above it in this list, field by field. So the player's base (L2) wins over a
 * gamemode's shipped differences (L1) for every field the base sets: moving a panel in the base also moves it in KZ,
 * which ships its own position, and changing a speedometer's colors in the base also changes them in RJ. The base
 * only stores the fields the player changed (see updateBaseEntry), so shipped per-gamemode values the player never
 * touched still apply. A preset (L3) wins over everything; a pinned component in a preset skips L2.
 *
 * This module is pure (no Panorama globals) so it can be tested outside the game (tools/test-hud-layers.ts).
 */

export type LayerObject = Record<string, unknown>;

/**
 * Merges an array from a layer onto the array below it. `path` is the key path from the layout root, e.g.
 * `['Speedometer', 'dynamicStyles', 'speedometers']`. Without a hook, arrays replace wholesale.
 */
export type ArrayMerge = (path: readonly string[], below: unknown, layer: unknown[]) => unknown[];

export interface MergeOptions {
	arrayMerge?: ArrayMerge;
}

/** Key in a component entry of an attached preset that makes the component ignore the base */
export const PINNED_KEY = 'pinned';

/** File name prefix of base profiles, `cfg/hud/base_<name>.kv3` */
export const BASE_FILE_PREFIX = 'base_';

/** File name prefix of exported presets, `cfg/hud/export_<mode>_<preset>.kv3` */
export const EXPORT_FILE_PREFIX = 'export_';

/**
 * Written to every base file (`meta.version`), so a later change of the base format can tell old files apart. Nothing
 * reads it yet: version 1 is the only format.
 */
export const BASE_FILE_VERSION = 1;

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

function mergeInto(below: LayerObject, layer: LayerObject, path: string[], options: MergeOptions): LayerObject {
	const out: LayerObject = { ...below };
	for (const [key, value] of Object.entries(layer)) {
		if (value === undefined) continue;

		const childPath = [...path, key];
		if (isPlainObject(value) && isPlainObject(below[key])) {
			out[key] = mergeInto(below[key], value, childPath, options);
		} else if (Array.isArray(value) && options.arrayMerge) {
			out[key] = cloneData(options.arrayMerge(childPath, below[key], value));
		} else {
			out[key] = cloneData(value);
		}
	}
	return out;
}

/**
 * Field-level merge of layers, lowest first. Objects merge recursively, everything else (including `null` and arrays,
 * unless `arrayMerge` says otherwise) replaces the value below. Missing layers are skipped.
 *
 * The result shares no objects with the inputs, so it is safe to modify.
 */
export function mergeLayers(layers: ReadonlyArray<LayerObject | null | undefined>, options: MergeOptions = {}) {
	let result: LayerObject = {};
	for (const layer of layers) {
		if (isPlainObject(layer)) result = mergeInto(result, layer, [], options);
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

/**
 * Updates a base profile entry (a field delta on the current gamemode's shipped default) after an edit.
 *
 * Only the fields that changed between `shown` (what the base looked like in this gamemode before the edit) and
 * `edited` are written on top of `previous`. Fields the player did not touch keep their stored value, even when it
 * happens to equal this gamemode's shipped default: another gamemode may ship a different value, so dropping it would
 * silently change the base there. A changed field that now equals this gamemode's shipped default (Reset) is removed
 * from the base. Returns `undefined` when the entry ends up empty.
 */
export function updateBaseEntry(
	previous: unknown,
	shown: unknown,
	edited: unknown,
	shippedDefault: unknown
): LayerObject | undefined {
	const changes = fieldDelta(shown, edited);
	const entry = isPlainObject(previous) ? cloneData(previous) : {};
	if (isPlainObject(changes)) applyBaseChanges(entry, changes, edited, shippedDefault);
	return Object.keys(entry).length > 0 ? entry : undefined;
}

function applyBaseChanges(entry: LayerObject, changes: LayerObject, edited: unknown, shippedDefault: unknown) {
	const editedObject = isPlainObject(edited) ? edited : {};
	const defaultObject = isPlainObject(shippedDefault) ? shippedDefault : {};

	for (const [key, change] of Object.entries(changes)) {
		if (isPlainObject(change) && isPlainObject(editedObject[key])) {
			const child = isPlainObject(entry[key]) ? (entry[key] as LayerObject) : {};
			applyBaseChanges(child, change, editedObject[key], defaultObject[key]);
			if (Object.keys(child).length > 0) entry[key] = child;
			else delete entry[key];
		} else if (equalData(editedObject[key], defaultObject[key])) {
			delete entry[key];
		} else {
			entry[key] = cloneData(editedObject[key]);
		}
	}
}

export interface PresetFile {
	/** Name of the base profile an attached preset follows. Absent for detached presets */
	base?: string;
	meta?: LayerObject;
	/** Component entries, keyed by component ID */
	components: LayerObject;
}

/** Splits a raw preset file into its reserved keys and its component entries. */
export function splitPresetFile(raw: unknown): PresetFile {
	const file: PresetFile = { components: {} };
	if (!isPlainObject(raw)) return file;

	for (const [key, value] of Object.entries(raw)) {
		if (key === 'base') {
			if (typeof value === 'string' && value !== '') file.base = value;
		} else if (key === 'meta') {
			if (isPlainObject(value)) file.meta = value;
		} else if (isPlainObject(value)) {
			file.components[key] = value;
		}
	}
	return file;
}

/** Whether a component entry of an attached preset is pinned (ignores the base). */
export function isPinned(entry: unknown): boolean {
	return isPlainObject(entry) && entry[PINNED_KEY] === true;
}

/** A component entry without the pinned flag. */
export function withoutPinned(entry: LayerObject): LayerObject {
	const { [PINNED_KEY]: _pinned, ...rest } = entry;
	return rest;
}

export interface BaseFile {
	name: string;
	/** Component entries, field deltas on L0 + L1 */
	layout: LayerObject;
}

/** Reads a raw base profile file. Anything that is not a valid base gives an empty layout. */
export function parseBaseFile(raw: unknown, name: string): BaseFile {
	const layout = isPlainObject(raw) && isPlainObject(raw.layout) ? raw.layout : {};
	const components: LayerObject = {};
	for (const [key, value] of Object.entries(layout)) {
		if (isPlainObject(value)) components[key] = cloneData(value);
	}
	return { name, layout: components };
}

export function serializeBaseFile(base: BaseFile): LayerObject {
	return { meta: { version: BASE_FILE_VERSION, name: base.name }, layout: cloneData(base.layout) };
}

/** Whether a cfg/hud file name belongs to a base profile or an export rather than a preset. */
export function isReservedLayoutName(fileName: string): boolean {
	return fileName.startsWith(BASE_FILE_PREFIX) || fileName.startsWith(EXPORT_FILE_PREFIX);
}

/**
 * The gamemode ID a `<mode>_<preset>` file name belongs to. Uses the longest matching ID, since some IDs are prefixes
 * of others (`bhop` and `bhop_hl`).
 */
export function gamemodeIDForFile(fileName: string, gamemodeIDs: readonly string[]): string | undefined {
	let best: string | undefined;
	for (const id of gamemodeIDs) {
		if (fileName.startsWith(id + '_') && (!best || id.length > best.length)) best = id;
	}
	return best;
}
