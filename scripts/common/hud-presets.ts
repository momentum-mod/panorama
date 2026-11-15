/**
 * HUD presets and their base profiles.
 *
 * A preset <mode>_<name> stores only its own ("explicit") fields: what differs from its parent, which is its
 * gamemode's shipped layout (L0 + L1) plus base_<name> (L2) when that file exists. Apply to base moves explicit fields
 * into the base (see applyComponentToBase), after which every preset of that name without its own value for a field
 * shows the base's. Shipped per-gamemode values the player never applied still apply: KZ keeps its shipped
 * speedometer position unless a position was applied.
 *
 * Pure (no Panorama globals).
 */

import { applyToBaseEntry, cloneData, isPlainObject, LayerObject } from 'common/hud-layers';
import {
	componentLayerDelta,
	dynamicStylesOf,
	normalizeKeyedDelta,
	resolveEntry,
	setDeltaStyle,
	SPEEDOMETER_LIST,
	updateBaseKeyedDelta,
	withoutKeyedLists,
	isEmptyKeyedDelta
} from 'common/hud-keyed-lists';

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
 */
export function resolvePreset(
	defaults: LayerObject,
	base: LayerObject | null,
	components: LayerObject
): ResolvedPreset {
	const parent: LayerObject = {};
	const resolved: LayerObject = {};
	for (const [id, shipped] of Object.entries(defaults)) {
		const baseEntry = base?.[id];
		parent[id] = baseEntry !== undefined ? resolveEntry(id, shipped, baseEntry) : cloneData(shipped);
		resolved[id] = resolveEntry(id, parent[id], components[id]);
	}
	return { parent, resolved };
}

/**
 * The explicit fields of every component of `current` (resolved, as shown): what differs from `parent`, keyed lists
 * stored as list deltas.
 */
export function explicitComponents(parent: LayerObject, current: LayerObject): LayerObject {
	const out: LayerObject = {};
	for (const [id, layout] of Object.entries(current)) {
		const delta = componentLayerDelta(id, parent[id], layout);
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
	const explicit = componentLayerDelta(componentID, parent, shown);
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
				styles[styleID] = cloneData(value);
			}
		}
	}

	return out;
}
