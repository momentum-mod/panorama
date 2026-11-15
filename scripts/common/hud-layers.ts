/**
 * Layer helpers for the HUD customizer.
 *
 * A HUD layout is resolved from a stack of layers, each winning over the ones above it, field by field:
 *   L0 cfg/hud/base_default.kv3       shipped, every gamemode
 *   L1 cfg/hud/<mode>_default.kv3     shipped, per gamemode
 *   L2 cfg/hud/base_<name>.kv3        player base profile, shared by every preset called <name>
 *   L3 cfg/hud/<mode>_<name>.kv3      player preset
 *
 * A preset follows base_<name> whenever that file exists; the name is the link, nothing in the preset file points at
 * the base. L2 and L3 only store the fields they set (L3: the preset's own, "explicit" fields), see hud-presets.ts.
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

// Preset and base files

/** File name prefix of base profiles, `cfg/hud/base_<name>.kv3` */
export const BASE_FILE_PREFIX = 'base_';

/** Name of the read-only preset every gamemode has, and of the shipped base (`base_default.kv3`) */
export const DEFAULT_PRESET = 'default';

/** Valid preset (and so profile) names. Also what the name popup accepts. */
export const PRESET_NAME_PATTERN = /^[\w-]+$/;

/**
 * Apply to base for plain fields: the fields of `presetEntry` (a preset's explicit fields of one component) written
 * over `baseEntry`. Fields the base already has are overwritten, its other fields are kept. Objects merge
 * recursively, arrays are replaced whole. Returns `undefined` when the result is empty.
 */
export function applyToBaseEntry(baseEntry: unknown, presetEntry: unknown): LayerObject | undefined {
	const merged = mergeLayers([
		isPlainObject(baseEntry) ? baseEntry : null,
		isPlainObject(presetEntry) ? presetEntry : null
	]);
	return Object.keys(merged).length > 0 ? merged : undefined;
}

export interface PresetFile {
	meta?: LayerObject;
	/** Component entries, keyed by component ID */
	components: LayerObject;
}

/** Splits a raw preset file into its meta block and its component entries. Anything else is dropped. */
export function splitPresetFile(raw: unknown): PresetFile {
	const file: PresetFile = { components: {} };
	if (!isPlainObject(raw)) return file;

	for (const [key, value] of Object.entries(raw)) {
		if (key === 'meta') {
			if (isPlainObject(value)) file.meta = value;
		} else if (isPlainObject(value)) {
			file.components[key] = value;
		}
	}
	return file;
}

/**
 * Reads a raw base profile file, `{ layout = { <component> = { ...fields } } }`, into its component entries.
 * Anything that is not a valid base gives an empty layout.
 */
export function parseBaseFile(raw: unknown): LayerObject {
	const layout = isPlainObject(raw) && isPlainObject(raw.layout) ? raw.layout : {};
	const components: LayerObject = {};
	for (const [key, value] of Object.entries(layout)) {
		if (isPlainObject(value)) components[key] = cloneData(value);
	}
	return components;
}

/**
 * Color profile renames recorded in a base file (`renamedProfiles = { "<old name>" = "<new name>" }`). Presets that
 * follow the base point their speedometers' references at the new names, see hud-presets' repointProfileRefs.
 */
export function parseBaseRenames(raw: unknown): Record<string, string> {
	const renames = isPlainObject(raw) && isPlainObject(raw.renamedProfiles) ? raw.renamedProfiles : {};
	const out: Record<string, string> = {};
	for (const [from, to] of Object.entries(renames)) {
		if (typeof to === 'string' && to !== '' && to !== from) out[from] = to;
	}
	return out;
}

export function serializeBaseFile(layout: LayerObject, renames: Record<string, string> = {}): LayerObject {
	return {
		layout: cloneData(layout),
		...(Object.keys(renames).length > 0 && { renamedProfiles: { ...renames } })
	};
}

/** Whether a cfg/hud file name belongs to a base profile or an export rather than a preset. */
export function isReservedLayoutName(fileName: string): boolean {
	return fileName.startsWith(BASE_FILE_PREFIX);
}

/**
 * The gamemode ID of a preset file name (`<mode>_<name>`), matching the longest gamemode ID first so a `bhop_hl_`
 * preset is never taken for a `bhop` one. Undefined for bases, exports and unknown files.
 */
export function gamemodeForPreset(fileName: string, gamemodeIDs: readonly string[]): string | undefined {
	if (isReservedLayoutName(fileName)) return undefined;
	return [...gamemodeIDs]
		.sort((a, b) => b.length - a.length)
		.find((id) => fileName.startsWith(id + '_') && fileName.length > id.length + 1);
}

/**
 * The profile name of a preset file name, `tek` for `df_cpm_tek`. The preset follows `base_<name>` when that file
 * exists. Undefined for bases, exports and unknown files. The shipped presets give `default`.
 */
export function baseNameForPreset(fileName: string, gamemodeIDs: readonly string[]): string | undefined {
	const gamemodeID = gamemodeForPreset(fileName, gamemodeIDs);
	return gamemodeID === undefined ? undefined : fileName.slice(gamemodeID.length + 1);
}

export interface ProfileFiles {
	/** File name of the base, `base_<name>`, if it exists */
	base?: string;
	/** File names of every preset called <name>, in every gamemode */
	presets: string[];
}

/** The base and presets of one profile name, among the cfg/hud file names `fileNames`. */
export function profileFiles(fileNames: Iterable<string>, name: string, gamemodeIDs: readonly string[]): ProfileFiles {
	const files: ProfileFiles = { presets: [] };
	for (const file of fileNames) {
		if (file === BASE_FILE_PREFIX + name) files.base = file;
		else if (baseNameForPreset(file, gamemodeIDs) === name) files.presets.push(file);
	}
	files.presets.sort((a, b) => a.localeCompare(b));
	return files;
}

/** Names of the player's bases (`base_<name>` files, not the shipped base_default). Sorted. */
export function baseNames(fileNames: Iterable<string>): string[] {
	const names = new Set<string>();
	for (const file of fileNames) {
		const name = file.startsWith(BASE_FILE_PREFIX) ? file.slice(BASE_FILE_PREFIX.length) : '';
		if (name && name !== DEFAULT_PRESET) names.add(name);
	}
	return [...names].sort((a, b) => a.localeCompare(b));
}

/** Every profile name used by a preset of any gamemode or by a base, except the default one. Sorted. */
export function profileNames(fileNames: Iterable<string>, gamemodeIDs: readonly string[]): string[] {
	const files = [...fileNames];
	const names = new Set(baseNames(files));
	for (const file of files) {
		const name = baseNameForPreset(file, gamemodeIDs);
		if (name && name !== DEFAULT_PRESET) names.add(name);
	}
	return [...names].sort((a, b) => a.localeCompare(b));
}

export type ProfileRenamePlan =
	| { ok: true; renames: Array<[from: string, to: string]> }
	| { ok: false; reason: 'reserved' | 'invalid' | 'exists' };

/**
 * Renaming a profile renames its base and every preset of that name in every gamemode. Refused when the new name is
 * already used by any preset or base.
 */
export function planProfileRename(
	fileNames: Iterable<string>,
	oldName: string,
	newName: string,
	gamemodeIDs: readonly string[]
): ProfileRenamePlan {
	if (oldName === DEFAULT_PRESET || newName === DEFAULT_PRESET) return { ok: false, reason: 'reserved' };
	if (!PRESET_NAME_PATTERN.test(newName) || newName === oldName) return { ok: false, reason: 'invalid' };

	const files = [...fileNames];
	const target = profileFiles(files, newName, gamemodeIDs);
	if (target.base || target.presets.length > 0) return { ok: false, reason: 'exists' };

	const source = profileFiles(files, oldName, gamemodeIDs);
	const renames: Array<[string, string]> = [];
	if (source.base) renames.push([source.base, BASE_FILE_PREFIX + newName]);
	for (const preset of source.presets) {
		// profileFiles only lists files gamemodeForPreset recognises
		const gamemodeID = gamemodeForPreset(preset, gamemodeIDs);
		if (gamemodeID !== undefined) renames.push([preset, `${gamemodeID}_${newName}`]);
	}
	return { ok: true, renames };
}

/**
 * The base to offer deleting along with preset `fullPresetName`: its base, when it exists and no other preset of that
 * name is left in any gamemode. Undefined otherwise.
 */
export function baseOrphanedByDelete(
	fileNames: Iterable<string>,
	fullPresetName: string,
	gamemodeIDs: readonly string[]
): string | undefined {
	const name = baseNameForPreset(fullPresetName, gamemodeIDs);
	if (!name || name === DEFAULT_PRESET) return undefined;
	const files = profileFiles(fileNames, name, gamemodeIDs);
	return files.base && files.presets.every((preset) => preset === fullPresetName) ? files.base : undefined;
}
