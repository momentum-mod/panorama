import { SpeedometerColorType, SpeedometerType } from 'common/speedometer';
import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class SpeedoBarHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudSpeedoBar>(),
		container: $<Panel>('#SpeedoBarContainer'),
		horizontalMeter: $<ProgressBar>('#HorizontalSpeedoBarMeter')
	};

	constructor() {
		$.RegisterEventHandler('OnSpeedometerUpdate', this.panels.container, () => {
			this.onSpeedoBarUpdate();
		});
	}

	onSpeedoBarUpdate() {
		const settings: SpeedometerSettingsAPI.Settings = {
			enabled_axes: [true, true, false],
			custom_label: 'speedoBar',
			type: SpeedometerType.OVERALL_VELOCITY,
			color_type: SpeedometerColorType.NONE
		};

		const maxMeterSpeed = 1800;
		const velocity = MomentumPlayerAPI.GetVelocity();

		const speed = this.getSpeedFromVelocity(velocity as vec3, settings);

		const speedPercentage = (speed / maxMeterSpeed) * 100;

		this.panels.horizontalMeter.value = speedPercentage;
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
}
