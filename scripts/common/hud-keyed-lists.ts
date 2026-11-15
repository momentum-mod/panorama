/**
 * Keyed lists and global styles for HUD customizer layers.
 *
 * Field-level layer deltas (see hud-layers.ts) store arrays whole. For lists whose items have a stable key, such as
 * the speedometer list (keyed by label), a layer stores a list delta instead, so a gamemode can add one speedometer
 * without copying the base's whole list:
 *
 *   speedometersDelta = { remove = [ "label" ]  override = [ { custom_label = "label"  color_type = 1 } ]
 *                         append = [ { ...full item... } ]  order = [ "label", ... ] }
 *
 * A layer that stores the plain list (`speedometers = [...]`) replaces the list below, as before.
 *
 * Global styles (the range color profiles) are stored only in the base profile and apply to every preset that follows
 * the base, pinned components included.
 *
 * Pure (no Panorama globals) so it can be tested outside the game (tools/test-hud-layers.ts).
 */

import {
	cloneData,
	equalData,
	fieldDelta,
	isPlainObject,
	LayerObject,
	mergeLayers,
	updateBaseEntry
} from 'common/hud-layers';

export interface KeyedListSpec {
	/** Component ID */
	component: string;
	/** Dynamic style that holds the resolved list */
	style: string;
	/** Dynamic style that holds a list delta in a layer */
	deltaStyle: string;
	/** Item field that identifies an item, compared case-insensitively */
	key: string;
	/** Item fields that can't change after the item is created; a change replaces the item */
	fixed: readonly string[];
}

export interface GlobalStyleSpec {
	component: string;
	style: string;
}

export const KEYED_LISTS: readonly KeyedListSpec[] = [
	{
		component: 'Speedometer',
		style: 'speedometers',
		deltaStyle: 'speedometersDelta',
		key: 'custom_label',
		fixed: ['type']
	}
];

export const GLOBAL_STYLES: readonly GlobalStyleSpec[] = [{ component: 'Speedometer', style: 'rangeColorProfiles' }];

export interface KeyedListDelta {
	remove: string[];
	override: LayerObject[];
	append: LayerObject[];
	order: string[];
}

type Item = LayerObject;

/** The key of a list item, lowercased (keys are compared case-insensitively). Undefined without a string key. */
export function keyOf(item: unknown, key: string): string | undefined {
	if (!isPlainObject(item)) return undefined;
	const value = item[key];
	return typeof value === 'string' ? value.toLowerCase() : undefined;
}

function itemsOf(list: unknown): Item[] {
	return Array.isArray(list) ? list.filter((item): item is Item => isPlainObject(item)) : [];
}

/** Items with a usable key, the first of each key only. */
function keyedItemsOf(list: unknown, key: string): Item[] {
	const seen = new Set<string>();
	return itemsOf(list).filter((item) => {
		const label = keyOf(item, key);
		if (!label || seen.has(label)) return false;
		seen.add(label);
		return true;
	});
}

function stringsOf(list: unknown): string[] {
	return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
}

export function emptyKeyedDelta(): KeyedListDelta {
	return { remove: [], override: [], append: [], order: [] };
}

/** Reads a list delta from a layer. Anything malformed becomes empty. */
export function normalizeKeyedDelta(raw: unknown): KeyedListDelta {
	const delta = isPlainObject(raw) ? raw : {};
	return {
		remove: stringsOf(delta.remove),
		override: itemsOf(delta.override).map((item) => cloneData(item)),
		append: itemsOf(delta.append).map((item) => cloneData(item)),
		order: stringsOf(delta.order)
	};
}

export function isEmptyKeyedDelta(delta: KeyedListDelta): boolean {
	return (
		delta.remove.length === 0 &&
		delta.override.length === 0 &&
		delta.append.length === 0 &&
		delta.order.length === 0
	);
}

/**
 * Applies a list delta. Returns new items, the inputs are not modified. Items of `list` without a non-empty key, or
 * with a key used earlier in the list, are dropped (see {@link computeKeyedDelta}).
 */
export function applyKeyedDelta(list: unknown, rawDelta: unknown, spec: Pick<KeyedListSpec, 'key' | 'fixed'>): Item[] {
	const delta = normalizeKeyedDelta(rawDelta);
	const { key, fixed } = spec;

	const removed = new Set(delta.remove.map((label) => label.toLowerCase()));
	let items = keyedItemsOf(list, key)
		.filter((item) => !removed.has(keyOf(item, key)))
		.map((item) => cloneData(item));

	const find = (label: string | undefined) => (label ? items.findIndex((item) => keyOf(item, key) === label) : -1);

	for (const override of delta.override) {
		const index = find(keyOf(override, key));
		if (index < 0) continue;
		for (const [field, value] of Object.entries(override)) {
			if (field === key || fixed.includes(field)) continue;
			items[index][field] = cloneData(value);
		}
	}

	for (const item of delta.append) {
		const index = find(keyOf(item, key));
		if (index >= 0) items[index] = cloneData(item);
		else if (keyOf(item, key)) items.push(cloneData(item));
	}

	if (delta.order.length > 0) {
		const ordered: Item[] = [];
		for (const label of delta.order) {
			const index = find(label.toLowerCase());
			if (index >= 0 && !ordered.includes(items[index])) ordered.push(items[index]);
		}
		items = [...ordered, ...items.filter((item) => !ordered.includes(item))];
	}

	return items;
}

/**
 * The list delta that turns `parent` into `edited` with {@link applyKeyedDelta}. Items without a non-empty key, and
 * items whose key (case-insensitively) is already used earlier in the same list, are dropped, so
 * `applyKeyedDelta(parent, computeKeyedDelta(parent, edited))` deep-equals `edited` whenever `edited` has unique,
 * non-empty keys (normalizeSpeedometers makes sure the speedometer list does).
 */
export function computeKeyedDelta(parent: unknown, edited: unknown, spec: KeyedListSpec): KeyedListDelta {
	const { key, fixed } = spec;
	const parentItems = keyedItemsOf(parent, key);
	const editedItems = keyedItemsOf(edited, key);
	const editedKeys = new Set(editedItems.map((item) => keyOf(item, key)));
	const parentByKey = new Map(parentItems.map((item) => [keyOf(item, key), item]));

	const delta = emptyKeyedDelta();

	for (const item of parentItems) {
		const label = keyOf(item, key);
		if (label !== undefined && !editedKeys.has(label)) delta.remove.push(item[key] as string);
	}

	for (const item of editedItems) {
		const parentItem = parentByKey.get(keyOf(item, key));
		// A changed fixed field, or a label that only differs in case, replaces the whole item
		const replaced =
			parentItem && (parentItem[key] !== item[key] || fixed.some((f) => !equalData(parentItem[f], item[f])));
		if (!parentItem || replaced) {
			delta.append.push(cloneData(item));
			continue;
		}

		const override: Item = {};
		for (const [field, value] of Object.entries(item)) {
			if (field !== key && !equalData(parentItem[field], value)) override[field] = cloneData(value);
		}
		if (Object.keys(override).length > 0) delta.override.push({ [key]: item[key], ...override });
	}

	const unordered = applyKeyedDelta(parentItems, delta, spec).map((item) => keyOf(item, key));
	const wanted = editedItems.map((item) => keyOf(item, key));
	if (!equalData(unordered, wanted)) delta.order = editedItems.map((item) => item[key] as string);

	return delta;
}

/**
 * Updates the base profile's list delta after an edit in one gamemode. `next` is the delta from this gamemode's
 * shipped list to the edited list. Entries of `previous` that only concern items this gamemode doesn't have (removes
 * and overrides of items only other gamemodes ship) are kept; everything else comes from `next`.
 */
export function mergeBaseKeyedDelta(
	previous: unknown,
	next: KeyedListDelta,
	shippedList: unknown,
	editedList: unknown,
	spec: KeyedListSpec
): KeyedListDelta {
	const prev = normalizeKeyedDelta(previous);
	const known = new Set(
		[...itemsOf(shippedList), ...itemsOf(editedList)].map((item) => keyOf(item, spec.key)).filter(Boolean)
	);
	const elsewhere = (label: string | undefined) => label !== undefined && !known.has(label);

	const merged: KeyedListDelta = {
		remove: [...next.remove],
		override: [...next.override],
		append: [...next.append],
		order: [...next.order]
	};
	for (const label of prev.remove) {
		if (elsewhere(label.toLowerCase()) && !merged.remove.some((l) => l.toLowerCase() === label.toLowerCase()))
			merged.remove.push(label);
	}
	for (const override of prev.override) {
		const label = keyOf(override, spec.key);
		if (elsewhere(label) && !merged.override.some((o) => keyOf(o, spec.key) === label))
			merged.override.push(override);
	}
	return merged;
}

function dynamicStylesOf(entry: unknown): LayerObject | undefined {
	return isPlainObject(entry) && isPlainObject(entry.dynamicStyles) ? entry.dynamicStyles : undefined;
}

function specsFor(componentID: string): KeyedListSpec[] {
	return KEYED_LISTS.filter((spec) => spec.component === componentID);
}

/**
 * Turns the list deltas in a component entry of a layer into plain lists, resolved against `below` (the component as
 * merged from the layers under this one). A plain list in the entry wins over a delta next to it.
 */
export function materializeEntry(componentID: string, entry: unknown, below: unknown): unknown {
	const styles = dynamicStylesOf(entry);
	const specs = specsFor(componentID).filter((spec) => styles && spec.deltaStyle in styles);
	if (specs.length === 0) return entry;

	const out = cloneData(entry as LayerObject);
	const outStyles = out.dynamicStyles as LayerObject;
	for (const spec of specs) {
		if (!Array.isArray(outStyles[spec.style])) {
			outStyles[spec.style] = applyKeyedDelta(
				dynamicStylesOf(below)?.[spec.style],
				outStyles[spec.deltaStyle],
				spec
			);
		}
		delete outStyles[spec.deltaStyle];
	}
	return out;
}

/** {@link materializeEntry} for every component of a layer. */
export function materializeLayer(layer: unknown, below: unknown): LayerObject {
	if (!isPlainObject(layer)) return {};
	const belowObject = isPlainObject(below) ? below : {};
	const out: LayerObject = {};
	for (const [id, entry] of Object.entries(layer)) out[id] = materializeEntry(id, entry, belowObject[id]);
	return out;
}

/** Merges layers (lowest first) like mergeLayers, resolving list deltas against the layers below. */
export function resolveLayers(layers: ReadonlyArray<LayerObject | null | undefined>): LayerObject {
	let result: LayerObject = {};
	for (const layer of layers) {
		if (isPlainObject(layer)) result = mergeLayers([result, materializeLayer(layer, result)]);
	}
	return result;
}

/** One component: `entry` (a layer's entry, may hold list deltas) merged onto `below` (already resolved). */
export function resolveEntry(componentID: string, below: unknown, entry: unknown): LayerObject {
	return mergeLayers([
		isPlainObject(below) ? below : null,
		materializeEntry(componentID, entry, below) as LayerObject | undefined
	]);
}

/** Splits a component layout into the part without keyed lists and the keyed lists themselves. */
function withoutKeyedLists(componentID: string, entry: unknown): unknown {
	const styles = dynamicStylesOf(entry);
	const specs = specsFor(componentID);
	if (!styles || specs.length === 0) return entry;

	const out = { ...(entry as LayerObject), dynamicStyles: { ...styles } };
	for (const spec of specs) {
		delete out.dynamicStyles[spec.style];
		delete out.dynamicStyles[spec.deltaStyle];
	}
	return out;
}

function setDeltaStyle(entry: LayerObject | undefined, deltaStyle: string, delta: KeyedListDelta): LayerObject {
	const out: LayerObject = entry ? { ...entry } : {};
	out.dynamicStyles = { ...(isPlainObject(out.dynamicStyles) ? out.dynamicStyles : {}), [deltaStyle]: delta };
	return out;
}

/**
 * Field delta of one component (see fieldDelta), with keyed lists stored as list deltas. `parent` must be resolved
 * (plain lists). Returns undefined when there is no difference.
 */
export function componentLayerDelta(componentID: string, parent: unknown, edited: unknown): LayerObject | undefined {
	let delta = fieldDelta(withoutKeyedLists(componentID, parent), withoutKeyedLists(componentID, edited)) as
		| LayerObject
		| undefined;

	for (const spec of specsFor(componentID)) {
		const editedList = dynamicStylesOf(edited)?.[spec.style];
		if (!Array.isArray(editedList)) continue;
		const listDelta = computeKeyedDelta(dynamicStylesOf(parent)?.[spec.style], editedList, spec);
		if (!isEmptyKeyedDelta(listDelta)) delta = setDeltaStyle(delta, spec.deltaStyle, listDelta);
	}
	return delta;
}

/**
 * {@link updateBaseEntry} for one component, with keyed lists stored as list deltas on this gamemode's shipped list.
 * `previous` is the stored base entry, `shown` the component as the base looked here before the edit (resolved),
 * `shippedDefault` this gamemode's shipped component (resolved).
 */
export function updateBaseComponentEntry(
	componentID: string,
	previous: unknown,
	shown: unknown,
	edited: unknown,
	shippedDefault: unknown
): LayerObject | undefined {
	let entry = updateBaseEntry(
		withoutKeyedLists(componentID, previous),
		withoutKeyedLists(componentID, shown),
		withoutKeyedLists(componentID, edited),
		withoutKeyedLists(componentID, shippedDefault)
	);

	for (const spec of specsFor(componentID)) {
		const previousStyles = dynamicStylesOf(previous);
		const editedList = dynamicStylesOf(edited)?.[spec.style];
		const shownList = dynamicStylesOf(shown)?.[spec.style];
		const shippedList = dynamicStylesOf(shippedDefault)?.[spec.style];

		let listDelta: KeyedListDelta;
		if (!Array.isArray(editedList) || equalData(shownList, editedList)) {
			// Untouched here: keep what was stored
			if (!previousStyles || !(spec.deltaStyle in previousStyles)) continue;
			listDelta = normalizeKeyedDelta(previousStyles[spec.deltaStyle]);
		} else {
			const next = computeKeyedDelta(shippedList, editedList, spec);
			listDelta = mergeBaseKeyedDelta(previousStyles?.[spec.deltaStyle], next, shippedList, editedList, spec);
		}

		if (!isEmptyKeyedDelta(listDelta)) entry = setDeltaStyle(entry, spec.deltaStyle, listDelta);
	}

	return entry && Object.keys(entry).length > 0 ? entry : undefined;
}

/** The global style values of a layout (resolved), keyed by component ID, then style. */
export function globalStylesOf(layout: unknown): Record<string, LayerObject> {
	const out: Record<string, LayerObject> = {};
	if (!isPlainObject(layout)) return out;
	for (const spec of GLOBAL_STYLES) {
		const value = dynamicStylesOf(layout[spec.component])?.[spec.style];
		if (value !== undefined) (out[spec.component] ??= {})[spec.style] = cloneData(value);
	}
	return out;
}

/** A component entry with the global styles of `source` (a resolved component) written over it. */
export function withGlobalStyles(componentID: string, entry: unknown, source: unknown): unknown {
	const specs = GLOBAL_STYLES.filter((spec) => spec.component === componentID);
	const sourceStyles = dynamicStylesOf(source);
	if (specs.length === 0 || !sourceStyles || !isPlainObject(entry)) return entry;

	const out = cloneData(entry);
	const styles = (out.dynamicStyles = isPlainObject(out.dynamicStyles) ? out.dynamicStyles : {});
	for (const spec of specs) {
		if (sourceStyles[spec.style] !== undefined) styles[spec.style] = cloneData(sourceStyles[spec.style]);
	}
	return out;
}

/** A component entry without its global styles. */
export function withoutGlobalStyles(componentID: string, entry: unknown): unknown {
	const specs = GLOBAL_STYLES.filter((spec) => spec.component === componentID);
	const styles = dynamicStylesOf(entry);
	if (specs.length === 0 || !styles) return entry;

	const out = { ...(entry as LayerObject), dynamicStyles: { ...styles } };
	for (const spec of specs) delete out.dynamicStyles[spec.style];
	if (Object.keys(out.dynamicStyles).length === 0) delete (out as LayerObject).dynamicStyles;
	return Object.keys(out).length > 0 ? out : undefined;
}
