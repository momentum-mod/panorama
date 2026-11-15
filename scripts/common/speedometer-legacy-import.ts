import type { HudLayout } from 'hud/customizer';
import { GamemodeInfo } from 'common/gamemode';
import { normalizeColorProfiles, normalizeSpeedometers, SpeedometerColorType } from 'common/speedometer';
import { isObject } from 'util/functions';
import { resolveLayers } from 'common/hud-keyed-lists';
import { equalData, LayerObject } from 'common/hud-layers';

const IMPORTED_FLAG = 'hud-customizer.speedometerLegacyImported';
const IMPORTED_PRESET = 'imported';

/**
 * One-time import of the legacy cfg/speedometer/speedometer.kv3 and speedometer_colorprof.kv3 into HUD presets.
 *
 * For every gamemode whose legacy speedometers differ from the HUD default, the speedometers are written into the
 * preset the player currently has selected for that gamemode, or into a new "imported" preset if they're on the
 * default preset (which is read-only). The legacy files are left on disk untouched.
 *
 * @returns Whether any preset file was written.
 */
export function importLegacySpeedometers(customizer: HudCustomizer): boolean {
	if ($.persistentStorage.getItem(IMPORTED_FLAG)) return false;

	// Binaries that predate the legacy reader don't have these, nothing we can import from.
	if (
		typeof SpeedometerSettingsAPI?.GetLegacySettings !== 'function' ||
		typeof SpeedometerSettingsAPI?.GetLegacyColorProfiles !== 'function'
	) {
		return false;
	}

	const general = customizer.loadLayout('base_default');
	if (!general) return false; // Don't set the flag, try again next time

	const rawLegacyProfiles = SpeedometerSettingsAPI.GetLegacyColorProfiles();
	const legacyProfiles = rawLegacyProfiles ? normalizeColorProfiles(rawLegacyProfiles) : null;
	const defaultProfiles = normalizeColorProfiles(
		(general.Speedometer?.dynamicStyles as Record<string, unknown> | undefined)?.rangeColorProfiles
	);
	const profilesDiffer = legacyProfiles !== null && !equalData(legacyProfiles, defaultProfiles);

	const savedPresets = new Set(customizer.listLayouts());
	let wroteAny = false;
	let failed = false;

	for (const [gamemode, info] of GamemodeInfo) {
		const rawLegacy = SpeedometerSettingsAPI.GetLegacySettings(gamemode);
		if (!rawLegacy) continue;

		const legacy = normalizeSpeedometers(rawLegacy);

		// Gamemode defaults may store list deltas on the shipped base's lists
		const modeDefault = resolveLayers([
			general as unknown as LayerObject,
			(customizer.loadLayout(`${info.id}_default`) ?? {}) as unknown as LayerObject
		]) as unknown as HudLayout;
		const defaultSpeedometers = normalizeSpeedometers(
			(modeDefault.Speedometer?.dynamicStyles as Record<string, unknown> | undefined)?.speedometers
		);

		const speedometersDiffer = !equalData(legacy, defaultSpeedometers);
		const usesRangeProfiles = legacy.some(({ color_type }) => color_type === SpeedometerColorType.RANGE);
		if (!speedometersDiffer && !(profilesDiffer && usesRangeProfiles)) continue;

		const presetKey = `hud-customizer.preset.${info.id}`;
		const currentPreset = $.persistentStorage.getItem<string>(presetKey);
		const presetName =
			currentPreset && currentPreset !== 'default' && savedPresets.has(`${info.id}_${currentPreset}`)
				? currentPreset
				: IMPORTED_PRESET;
		const fullPresetName = `${info.id}_${presetName}`;

		// Only touch the speedometer keys of the target, leave anything else in the preset alone.
		const layout = (customizer.loadLayout(fullPresetName) ?? {}) as Record<string, any>;
		const speedometerLayout = isObject(layout.Speedometer) ? { ...layout.Speedometer } : {};
		const dynamicStyles = isObject(speedometerLayout.dynamicStyles) ? { ...speedometerLayout.dynamicStyles } : {};
		delete dynamicStyles.speedometersDelta;
		dynamicStyles.speedometers = legacy;
		if (legacyProfiles) dynamicStyles.rangeColorProfiles = legacyProfiles;
		speedometerLayout.dynamicStyles = dynamicStyles;
		layout.Speedometer = speedometerLayout;

		if (customizer.saveLayout(fullPresetName, layout as HudLayout)) {
			$.persistentStorage.setItem(presetKey, presetName);
			wroteAny = true;
		} else {
			$.Warning(`Failed to import legacy speedometers into ${fullPresetName}`);
			failed = true;
		}
	}

	// Try again next time if a preset couldn't be written
	if (!failed) $.persistentStorage.setItem(IMPORTED_FLAG, true);

	return wroteAny;
}
