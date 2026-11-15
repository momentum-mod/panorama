import type { RgbaTuple } from 'util/colors';

// We need to iterate over this prick so not using const enum.
export enum SpeedometerType {
	OVERALL_VELOCITY = 0,
	EXPLOSION_VELOCITY = 1,
	JUMP_VELOCITY = 2,
	RAMP_VELOCITY = 3,
	ZONE_VELOCITY = 4,
	ENERGY = 5
}

export enum SpeedometerColorType {
	NONE = 0,
	RANGE = 1,
	COMPARISON = 2,
	COMPARISON_SEP = 3
}

export const SpeedometerDispNames: ReadonlyMap<SpeedometerType, string> = new Map([
	[SpeedometerType.OVERALL_VELOCITY, '#Speedometer_Type_OverallVelocity'],
	[SpeedometerType.EXPLOSION_VELOCITY, '#Speedometer_Type_ExplosiveJump'],
	[SpeedometerType.JUMP_VELOCITY, '#Speedometer_Type_Jump'],
	[SpeedometerType.RAMP_VELOCITY, '#Speedometer_Type_Ramp'],
	[SpeedometerType.ZONE_VELOCITY, '#Speedometer_Type_Zone'],
	[SpeedometerType.ENERGY, '#Speedometer_Type_Energy']
]);

/** A single speedometer, as stored in the HUD preset (and the legacy speedometer.kv3). */
export interface SpeedometerSettings {
	/** Display name, may be a localization token */
	custom_label: string;
	type: SpeedometerType;
	/** X, Y, Z */
	enabled_axes: [boolean, boolean, boolean];
	color_type: SpeedometerColorType;
	/** Name of a {@link RangeColorProfile}, empty string when none */
	range_color_profile: string;
}

export interface ColorRange {
	min: number;
	max: number;
	/** 0-255 */
	color: RgbaTuple;
}

export interface RangeColorProfile {
	profile_name: string;
	profile_ranges: ColorRange[];
}

const DEFAULT_RANGE_COLOR: RgbaTuple = [255, 255, 255, 255];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeAxes(raw: unknown): [boolean, boolean, boolean] {
	const axes = Array.isArray(raw) ? raw : [];
	return [0, 1, 2].map((i) => (typeof axes[i] === 'boolean' ? axes[i] : true)) as [boolean, boolean, boolean];
}

function normalizeColor(raw: unknown): RgbaTuple {
	const color = Array.isArray(raw) ? raw : [];
	return [0, 1, 2, 3].map((i) => toNumber(color[i], DEFAULT_RANGE_COLOR[i])) as RgbaTuple;
}

/**
 * Turns anything read from disk (hand edited or legacy files included) into a valid list of speedometers.
 * Always returns fresh objects, never the input.
 *
 * Labels identify speedometers in base profile list deltas, so they are made unique (case-insensitively): a missing
 * label becomes the type's name, and a label that is already taken gets a number, "<label> 2" and so on.
 */
export function normalizeSpeedometers(raw: unknown): SpeedometerSettings[] {
	if (!Array.isArray(raw)) return [];

	const result: SpeedometerSettings[] = [];
	const labels = new Set<string>();
	for (const entry of raw) {
		if (!isRecord(entry)) continue;

		const type = entry.type as SpeedometerType;
		if (typeof type !== 'number' || !SpeedometerDispNames.has(type)) continue;

		const wantedLabel =
			typeof entry.custom_label === 'string' && entry.custom_label !== ''
				? entry.custom_label
				: SpeedometerDispNames.get(type)!;
		let label = wantedLabel;
		for (let i = 2; labels.has(label.toLowerCase()); i++) label = `${wantedLabel} ${i}`;
		labels.add(label.toLowerCase());

		const colorType = entry.color_type as SpeedometerColorType;
		result.push({
			custom_label: label,
			type,
			enabled_axes: normalizeAxes(entry.enabled_axes),
			color_type:
				typeof colorType === 'number' && Object.values(SpeedometerColorType).includes(colorType)
					? colorType
					: SpeedometerColorType.NONE,
			range_color_profile: typeof entry.range_color_profile === 'string' ? entry.range_color_profile : ''
		});
	}

	return result;
}

/** Same as {@link normalizeSpeedometers} for range color profiles. Ranges are kept sorted by min. */
export function normalizeColorProfiles(raw: unknown): RangeColorProfile[] {
	if (!Array.isArray(raw)) return [];

	const result: RangeColorProfile[] = [];
	for (const entry of raw) {
		if (!isRecord(entry) || typeof entry.profile_name !== 'string') continue;

		const ranges: ColorRange[] = [];
		if (Array.isArray(entry.profile_ranges)) {
			for (const range of entry.profile_ranges) {
				if (!isRecord(range)) continue;
				ranges.push({
					min: toNumber(range.min, 0),
					max: toNumber(range.max, 0),
					color: normalizeColor(range.color)
				});
			}
		}

		ranges.sort((a, b) => a.min - b.min);
		result.push({ profile_name: entry.profile_name, profile_ranges: ranges });
	}

	return result;
}
