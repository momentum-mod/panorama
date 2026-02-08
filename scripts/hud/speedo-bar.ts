import { SpeedometerColorType, SpeedometerType } from 'common/speedometer';
import { tupleToRgbaString } from 'util/colors';
import { PanelHandler } from 'util/module-helpers';

interface Range {
	min: number;
	max: number;
	color: rgbaColor;
}
type RuntimeSettings = SpeedometerSettingsAPI.Settings & { range_colors?: Range[] };

const overlays = {
	horizontal: [855, 895],
	vertical: [450, 1100]
};

const maxSpeed = {
	horizontal: 1750,
	vertical: 2200
};

@PanelHandler()
class SpeedoBarHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudSpeedoBar>(),
		horizontalMeter: $<ProgressBar>('#HorizontalSpeedoBarMeter'),
		verticalMeter: $<ProgressBar>('#VerticalSpeedoBarMeter')
	};

	constructor() {
		$.RegisterForUnhandledEvent('OnSpeedometerUpdate', () => {
			this.onSpeedoBarUpdate();
		});
		$.RegisterForUnhandledEvent('MapLoaded', () => {
			this.onMapLoaded();
		});
	}

	onSpeedoBarUpdate() {
		const velocity = MomentumPlayerAPI.GetVelocity();
		this.updateMeter(this.panels.horizontalMeter, velocity, [true, true, false], maxSpeed.horizontal);
		this.updateMeter(this.panels.verticalMeter, velocity, [false, false, true], maxSpeed.vertical);

		// const colorProfiles = SpeedometerSettingsAPI.GetColorProfiles();
		// this.appendRangeColorProfileInfo(settings, colorProfiles);

		// if (settings.color_type === SpeedometerColorType.RANGE && settings.range_colors) {
		// 	let found = false;
		// 	for (const range of settings.range_colors) {
		// 		// GameInterfaceAPI.ConsoleCommand('echo ----------------------------SPEEDOBARRANGE-----');
		// 		// GameInterfaceAPI.ConsoleCommand(`echo SPEED ${speed}`);
		// 		if (speed >= range.min && speed <= range.max) {
		// 			GameInterfaceAPI.ConsoleCommand(`echo SPEED IN RANGE`);
		// 			this.panels.horizontalMeter.style.backgroundColor = range.color;
		// 			found = true;
		// 		}
		// 	}
		// 	// backup to white
		// 	if (!found) this.panels.horizontalMeter.style.backgroundColor = 'rgba(255, 255, 255, 1)';
		// }
	}

	updateMeter(panel: ProgressBar, velocity: vec3, axes: [boolean, boolean, boolean], maxSpeed: number) {
		const settings: RuntimeSettings = {
			enabled_axes: axes,
			custom_label: 'speedoBar',
			type: SpeedometerType.OVERALL_VELOCITY,
			color_type: SpeedometerColorType.RANGE,
			range_colors: []
		};
		const speed = this.getSpeedFromVelocity(velocity, settings);
		const speedPercentage = speed / maxSpeed;
		panel.value = speedPercentage;
	}
	onMapLoaded() {
		this.updateOverlays();
	}

	updateOverlays() {
		for (const speed of overlays.horizontal) {
			let speedPercentage = (speed / maxSpeed.horizontal) * 100;
			const newPanel = $.CreatePanel('Panel', this.panels.cp, '', { class: `speedobar__overlay__horizontal` });
			newPanel.style.position = `${speedPercentage}% 0 0`;
		}
		for (const speed of overlays.vertical) {
			let speedPercentage = (speed / maxSpeed.vertical) * 100;
			const newPanel = $.CreatePanel('Panel', this.panels.cp, '', { class: `speedobar__overlay__vertical` });
			newPanel.style.position = `0 ${-speedPercentage}% 0`;
		}
	}

	getSpeedFromVelocity({ x, y, z }: vec3, settings: SpeedometerSettingsAPI.Settings): float {
		const [xEnabled, yEnabled, zEnabled] = settings.enabled_axes;
		// @ts-expect-error - fastest way to do this, using type coercion (false = 0, true = 1)
		const numAxes = xEnabled + yEnabled + zEnabled;

		if (numAxes > 1) {
			let squaredParts = 0;
			if (xEnabled) squaredParts += x ** 2;
			if (yEnabled) squaredParts += y ** 2;
			if (zEnabled) squaredParts += z ** 2;
			return Math.sqrt(squaredParts);
		} else if (numAxes === 1) {
			if (xEnabled) return Math.abs(x);
			if (yEnabled) return Math.abs(y);
			if (zEnabled) return Math.abs(z);
		} else {
			$.Warning('Speedometer with no enabled axes found');
			return 0;
		}
	}
	appendRangeColorProfileInfo(
		speedoData: RuntimeSettings,
		colorProfData: SpeedometerSettingsAPI.ColorProfile[]
	): Range {
		if (speedoData.color_type !== SpeedometerColorType.RANGE) return;

		// const colorProf = speedoData.range_color_profile;
		// if (!colorProf) return;

		// const foundProfile = colorProfData.find((profile) => colorProf === profile.profile_name);
		// if (!foundProfile) return;

		// const ranges = foundProfile.profile_ranges;
		// if (!ranges) return;

		// speedoData.range_colors = ranges.map((range) => ({
		// 	min: range.min,
		// 	max: range.max,
		// 	color: tupleToRgbaString(range.color)
		// }));

		speedoData.range_colors = [{ min: 850, max: 900, color: tupleToRgbaString([255, 0, 255, 255]) }];
	}
}
