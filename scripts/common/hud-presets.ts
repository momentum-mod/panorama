/**
 * HUD presets and their base profiles.
 *
 * A preset <mode>_<name> stores only its own ("explicit") fields: what differs from its parent, which is its
 * gamemode's shipped layout (L0 + L1) plus base_<name> (L2) when that file exists. Apply to base moves explicit fields
 * into the base (see applyComponentToBase), after which every preset of that name without its own value for a field
 * shows the base's. Shipped per-gamemode values the player never applied still apply: KZ keeps its shipped
 * speedometer position unless a position was applied.
 *
 * Base styles (the range color profiles) of a preset that follows a base come from the base only: the preset never
 * stores its own, and editing them edits the base's. A preset without a base keeps its own in its file.
 *
 * Pure (no Panorama globals).
 */

import { applyToBaseEntry, cloneData, isPlainObject, LayerObject } from 'common/hud-layers';
import {
	componentLayerDelta,
	dynamicStylesOf,
	keyedListFor,
	keyOf,
	normalizeKeyedDelta,
	resolveEntry,
	setDeltaStyle,
	SPEEDOMETER_LIST,
	updateBaseKeyedDelta,
	withoutKeyedLists,
	isEmptyKeyedDelta
} from 'common/hud-keyed-lists';

/** A list of named items in a component that the base owns for every preset following it, and what refers to them */
export interface BaseStyleSpec {
	component: string;
	/** Dynamic style that holds the named items */
	style: string;
	/** Item field with the item's name */
	nameField: string;
	/** Where another style of the component refers to the items by name */
	refs: { style: string; field: string };
}

/** The range color profiles, the only base style so far, used by the speedometers by name */
export const SPEEDOMETER_PROFILES: BaseStyleSpec = {
	component: 'Speedometer',
	style: 'rangeColorProfiles',
	nameField: 'profile_name',
	refs: { style: 'speedometers', field: 'range_color_profile' }
};

/** Whether a component's style is a base style */
export function isBaseStyle(componentID: string, styleID: string): boolean {
	return componentID === SPEEDOMETER_PROFILES.component && styleID === SPEEDOMETER_PROFILES.style;
}

/** A component entry with the base styles of `source` (a resolved component) written over it. */
export function withBaseStyles(componentID: string, entry: unknown, source: unknown): unknown {
	const { component, style } = SPEEDOMETER_PROFILES;
	const sourceValue = dynamicStylesOf(source)?.[style];
	if (componentID !== component || sourceValue === undefined || !isPlainObject(entry)) return entry;

	const out = cloneData(entry);
	out.dynamicStyles = {
		...(isPlainObject(out.dynamicStyles) ? out.dynamicStyles : {}),
		[style]: cloneData(sourceValue)
	};
	return out;
}

/** A component entry without its base styles, undefined when nothing else is left. */
export function withoutBaseStyles(componentID: string, entry: unknown): LayerObject | undefined {
	if (!isPlainObject(entry)) return undefined;
	const styles = dynamicStylesOf(entry);
	if (componentID !== SPEEDOMETER_PROFILES.component || !styles) return entry;

	const out: LayerObject = { ...entry, dynamicStyles: { ...styles } };
	delete (out.dynamicStyles as LayerObject)[SPEEDOMETER_PROFILES.style];
	if (Object.keys(out.dynamicStyles as LayerObject).length === 0) delete out.dynamicStyles;
	return Object.keys(out).length > 0 ? out : undefined;
}

/** Only the base styles of a component entry, undefined when it has none. */
export function onlyBaseStyles(componentID: string, entry: unknown): LayerObject | undefined {
	const value = dynamicStylesOf(entry)?.[SPEEDOMETER_PROFILES.style];
	if (componentID !== SPEEDOMETER_PROFILES.component || value === undefined) return undefined;
	return { dynamicStyles: { [SPEEDOMETER_PROFILES.style]: cloneData(value) } };
}

/** The names of the base style items (profiles) of a resolved component. */
function baseStyleNames(entry: unknown): Set<string> {
	const items = dynamicStylesOf(entry)?.[SPEEDOMETER_PROFILES.style];
	return new Set(
		(Array.isArray(items) ? items : [])
			.map((item) => (isPlainObject(item) ? item[SPEEDOMETER_PROFILES.nameField] : undefined))
			.filter((name): name is string => typeof name === 'string')
	);
}

/** Where a renamed name leads through `renames`, or undefined when it leads to no name in `names`. */
function renameTarget(name: string, renames: Record<string, string>, names: Set<string>): string | undefined {
	// Renames can form chains and even cycles (A to B, then B back to A)
	const seen = new Set<string>();
	let current = name;
	while (!names.has(current)) {
		if (seen.has(current) || renames[current] === undefined) return undefined;
		seen.add(current);
		current = renames[current];
	}
	return current;
}

/**
 * Points references to renamed base style items (speedometers using a renamed color profile) at the new names.
 * `renames` maps old names to new ones and is followed through several renames. A reference is only changed when its
 * name no longer exists and the rename leads to one that does. Returns the entry unchanged (same object) when nothing
 * was repointed, otherwise a copy.
 */
export function repointProfileRefs(componentID: string, entry: unknown, renames: Record<string, string>): unknown {
	const styles = dynamicStylesOf(entry);
	if (componentID !== SPEEDOMETER_PROFILES.component || !styles || Object.keys(renames).length === 0) return entry;

	const { refs } = SPEEDOMETER_PROFILES;
	const names = baseStyleNames(entry);
	const items = styles[refs.style];
	if (!Array.isArray(items)) return entry;

	let out: LayerObject | undefined;
	items.forEach((item, i) => {
		const name = isPlainObject(item) ? item[refs.field] : undefined;
		if (typeof name !== 'string' || name === '' || names.has(name)) return;
		const newName = renameTarget(name, renames, names);
		if (newName === undefined) return;
		out ??= cloneData(entry as LayerObject);
		((out.dynamicStyles as LayerObject)[refs.style] as LayerObject[])[i][refs.field] = newName;
	});
	return out ?? entry;
}

/**
 * The renames worth keeping in a base: those that still lead to an existing profile of the base (`base` is its
 * resolved Speedometer component). The others can't repoint anything anymore.
 */
export function pruneRenames(renames: Record<string, string>, base: unknown): Record<string, string> {
	const names = baseStyleNames(base);
	const out: Record<string, string> = {};
	for (const [from, to] of Object.entries(renames)) {
		if (!names.has(from) && renameTarget(from, renames, names) !== undefined) out[from] = to;
	}
	return out;
}

export interface ResolvedPreset {
	/** What the preset is stored relative to, and what Reset goes back to: L0 + L1 (+ L2 when there is a base) */
	parent: LayerObject;
	/** What the preset shows: parent + L3 */
	resolved: LayerObject;
}

/**
 * Resolves a preset. `defaults` is its gamemode's shipped layout (L0 + L1, resolved), `base` the components of
 * base_<name> (L2) or null when there is none, `components` the preset file's entries (L3). Only components in
 * `defaults` are resolved; a base or preset may hold entries of other gamemodes' components, which are ignored here.
 *
 * With a base, base styles (color profiles) come from the base: the preset's own are ignored, and `renames` (the
 * base's renamed profiles) are applied to the speedometers' references.
 */
export function resolvePreset(
	defaults: LayerObject,
	base: LayerObject | null,
	components: LayerObject,
	renames: Record<string, string> = {}
): ResolvedPreset {
	const parent: LayerObject = {};
	const resolved: LayerObject = {};
	for (const [id, shipped] of Object.entries(defaults)) {
		const baseEntry = base?.[id];
		parent[id] = baseEntry !== undefined ? resolveEntry(id, shipped, baseEntry) : cloneData(shipped);
		const entry = base ? withoutBaseStyles(id, components[id]) : components[id];
		resolved[id] = resolveEntry(id, parent[id], entry);
		if (base) {
			parent[id] = repointProfileRefs(id, parent[id], renames);
			resolved[id] = repointProfileRefs(id, resolved[id], renames);
		}
	}
	return { parent, resolved };
}

/**
 * The explicit fields of every component of `current` (resolved, as shown): what differs from `parent`, keyed lists
 * stored as list deltas.
 * With a base, base styles are never explicit, they belong to the base.
 */
export function explicitComponents(parent: LayerObject, current: LayerObject, hasBase: boolean): LayerObject {
	const out: LayerObject = {};
	for (const [id, layout] of Object.entries(current)) {
		const edited = hasBase ? withBaseStyles(id, layout, parent[id]) : layout;
		const delta = componentLayerDelta(id, parent[id], edited);
		if (delta) out[id] = delta;
	}
	return out;
}

/**
 * Which parts of a component Apply to base moves, or Reset resets: its position, and/or its styles (size and dynamic
 * styles). Visibility (`enabled`) is in neither: it is never applied to the base and never reset.
 */
export interface LayerParts {
	position: boolean;
	styles: boolean;
}

const POSITION_FIELDS = ['offsetX', 'offsetY'];
const STYLE_FIELDS = ['width', 'height', 'dynamicStyles'];

/** The fields of a component entry that belong to the ticked parts (see LayerParts). */
export function pickParts(entry: unknown, parts: LayerParts): LayerObject | undefined {
	if (!isPlainObject(entry)) return undefined;
	const fields = [...(parts.position ? POSITION_FIELDS : []), ...(parts.styles ? STYLE_FIELDS : [])];
	const out: LayerObject = {};
	for (const field of fields) {
		if (entry[field] !== undefined) out[field] = cloneData(entry[field]);
	}
	return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Apply to base for one component: the preset's explicit fields of the ticked parts (what `shown` stores over
 * `parent`) written into `baseEntry`. Plain fields overwrite the base's (see applyToBaseEntry); keyed lists merge item
 * by item (see updateBaseKeyedDelta), so items, removals and an order set from other gamemodes stay. A removed item
 * this gamemode ships becomes a removal in the base.
 * Base styles are never moved here.
 *
 * `parent` is the preset's parent (with the base, resolved), `shown` the preset as shown (resolved), `shipped` its
 * gamemode's shipped component (resolved). Returns the new base entry, undefined when empty.
 */
export function applyComponentToBase(
	componentID: string,
	baseEntry: unknown,
	parent: unknown,
	shown: unknown,
	shipped: unknown,
	parts: LayerParts
): LayerObject | undefined {
	const explicit = componentLayerDelta(componentID, parent, withBaseStyles(componentID, shown, parent));
	const moved = pickParts(withoutKeyedLists(componentID, explicit), parts);
	let entry = applyToBaseEntry(withoutKeyedLists(componentID, baseEntry), moved);

	if (componentID === SPEEDOMETER_LIST.component) {
		const { style, deltaStyle } = SPEEDOMETER_LIST;
		const previous = dynamicStylesOf(baseEntry)?.[deltaStyle];
		let listDelta = normalizeKeyedDelta(previous);
		if (parts.styles && dynamicStylesOf(explicit)?.[deltaStyle] !== undefined) {
			listDelta = updateBaseKeyedDelta(
				previous,
				dynamicStylesOf(parent)?.[style],
				dynamicStylesOf(shown)?.[style],
				dynamicStylesOf(shipped)?.[style],
				SPEEDOMETER_LIST
			);
		}
		if (!isEmptyKeyedDelta(listDelta)) entry = setDeltaStyle(entry, deltaStyle, listDelta);
	}

	return entry && Object.keys(entry).length > 0 ? entry : undefined;
}

/**
 * Reset for one component: the ticked parts of `current` (resolved, as shown) go back to `parent`.
 * Base styles (the color profiles) are never reset; profiles and their ranges only go away when the player deletes
 * them. A speedometer's reference to a profile goes back with the list, so a speedometer that used a profile of its
 * own gets the parent's (usually none).
 */
export function resetComponentLayout(
	componentID: string,
	current: unknown,
	parent: unknown,
	parts: LayerParts
): LayerObject {
	const out = cloneData(isPlainObject(current) ? current : {});
	const source = isPlainObject(parent) ? parent : {};

	if (parts.position) {
		for (const field of POSITION_FIELDS) {
			if (source[field] !== undefined) out[field] = cloneData(source[field]);
		}
	}

	if (parts.styles) {
		for (const field of ['width', 'height']) {
			if (source[field] !== undefined) out[field] = cloneData(source[field]);
			else delete out[field];
		}
		const styles = dynamicStylesOf(out);
		const parentStyles = dynamicStylesOf(source);
		if (styles && parentStyles) {
			for (const [styleID, value] of Object.entries(parentStyles)) {
				if (isBaseStyle(componentID, styleID)) continue;
				styles[styleID] = cloneData(value);
			}
		}
	}

	return out;
}

/** Whether a component entry has an explicit value for a dynamic style (its list delta, for keyed lists). */
export function hasExplicitStyle(componentID: string, entry: unknown, styleID: string): boolean {
	const styles = dynamicStylesOf(entry);
	if (!styles) return false;
	if (styles[styleID] !== undefined) return true;
	const spec = keyedListFor(componentID, styleID);
	return spec !== undefined && styles[spec.deltaStyle] !== undefined;
}

/** Whether a keyed list item (by key) is added, changed or replaced by a component entry's list delta. */
export function isKeyedItemExplicit(componentID: string, entry: unknown, styleID: string, key: string): boolean {
	const spec = keyedListFor(componentID, styleID);
	const styles = dynamicStylesOf(entry);
	if (!spec || !styles) return false;
	if (Array.isArray(styles[spec.style])) return true;
	const lower = key.toLowerCase();
	const delta = normalizeKeyedDelta(styles[spec.deltaStyle]);
	return [...delta.override, ...delta.append].some((item) => keyOf(item, spec.key) === lower);
}
