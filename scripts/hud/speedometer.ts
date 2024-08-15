// arbitrary value to determine how much speed needs to change to be considered an increase/decrease
// adjusted by speedometer update delta time
const COLORIZE_DEADZONE = 2;

const RANGE_LIST_KEY = 'range_colors';

const HIDDEN_CLASS = 'speedometer--hidden';
const INCREASE_CLASS = 'speedometer--increase';
const DECREASE_CLASS = 'speedometer--decrease';
const FADEOUT_CLASS = 'speedometer--fadeout';
const FADEOUT_START_CLASS = 'speedometer--fade-start';

const AXIS_LABEL_CLASS = 'speedometer__axis';
const AXIS_COMPLABEL_CLASS = 'speedometer__axis__comparison';
const EVENT_LABEL_CLASS = 'speedometer__event';
const EVENT_COMPLABEL_CLASS = 'speedometer__event__comparison';

class RangeObject {
	constructor(min, max, color) {
		this.min = min;
		this.max = max;
		this.color = color;
	}
}
class SpeedometerObject {
	constructor(type, speedometerPanel, settings) {
		/** @type {number} */
		this.type = type;
		/** @type {Panel} */
		this.speedometerPanel = speedometerPanel;
		/** @type {Label} */
		this.speedometerLabel = speedometerPanel.FindChildInLayoutFile('SpeedometerLabel');
		/** @type {Label} */
		this.comparisonLabel = speedometerPanel.FindChildInLayoutFile('SpeedometerComparisonLabel');
		this.settings = settings;
		/** @type {number} */
		this.prevVal = 0;

		this.speedometerLabel.AddClass(
			this.type === SpeedometerTypes.OVERALL_VELOCITY ? AXIS_LABEL_CLASS : EVENT_LABEL_CLASS
		);
		this.comparisonLabel.AddClass(
			this.type === SpeedometerTypes.OVERALL_VELOCITY ? AXIS_COMPLABEL_CLASS : EVENT_COMPLABEL_CLASS
		);

		this.comparisonLabel.SetHasClass(
			HIDDEN_CLASS,
			this.settings[SpeedometerDataKeys.COLOR_TYPE] !== SpeedometerColorTypes.COMPARISON_SEP
		);

		// remove status classes
		this.speedometerPanel.RemoveClass(FADEOUT_START_CLASS);
		this.speedometerPanel.RemoveClass(FADEOUT_CLASS);
		this.speedometerLabel.RemoveClass(DECREASE_CLASS);
		this.speedometerLabel.RemoveClass(INCREASE_CLASS);
		this.comparisonLabel.RemoveClass(DECREASE_CLASS);
		this.comparisonLabel.RemoveClass(INCREASE_CLASS);
	}
}

/** @type {Map<number,Array<SpeedometerObject>>} */
let SpeedometerMap = new Map();

class Speedometer {
	/** @static @type {Panel} */
	static container = $('#SpeedometersContainer');
	static lastZone = 0;
	static correctedColorizeDeadzone = 0;

	static registerFadeoutEventHandlers() {
		for (const [type, speedometers] of SpeedometerMap) {
			if (!this.canSpeedometerTypeFadeOut(type)) continue;

			for (const speedometer of speedometers) {
				speedometer.fadeoutEventHandle = $.RegisterEventHandler(
					'PropertyTransitionEnd',
					speedometer.speedometerPanel,
					(_, propertyName) => {
						if (propertyName !== 'opacity') return;

						// reset previous value on fadeout
						speedometer.prevVal = 0;
					}
				);
			}
		}
	}
	static unregisterFadeoutEventHandlers() {
		for (const [type, speedometers] of SpeedometerMap) {
			if (!this.canSpeedometerTypeFadeOut(type)) continue;

			for (const speedometer of speedometers) {
				if (!speedometer.fadeoutEventHandle) continue;

				$.UnregisterEventHandler(
					'PropertyTransitionEnd',
					speedometer.speedometerPanel,
					speedometer.fadeoutEventHandle
				);
			}
		}
	}

	static onSpeedometerUpdate(deltaTime) {
		const velocity = MomentumPlayerAPI.GetVelocity();

		this.correctedColorizeDeadzone = deltaTime * COLORIZE_DEADZONE;
		this.updateSpeedometersOfType(SpeedometerTypes.OVERALL_VELOCITY, velocity);
	}
	static onExplosiveHitSpeedUpdate(hitVelocity) {
		this.updateSpeedometersOfType(SpeedometerTypes.EXPLOSION_VELOCITY, hitVelocity);
	}
	static onJumpSpeedUpdate(jumpVelocity) {
		this.updateSpeedometersOfType(SpeedometerTypes.JUMP_VELOCITY, jumpVelocity);
	}
	static onRampBoardSpeedUpdate(rampBoardVelocity) {
		this.updateSpeedometersOfType(SpeedometerTypes.RAMP_VELOCITY, rampBoardVelocity);
	}
	static onRampLeaveSpeedUpdate(rampLeaveVelocity) {
		this.updateSpeedometersOfType(SpeedometerTypes.RAMP_VELOCITY, rampLeaveVelocity);
	}

	static onZoneChange(enter, linear, curZone, _curTrack, timerState) {
		const startZone = curZone === 1;
		if (enter && startZone) {
			this.lastZone = 0;
			this.resetSpeedometerFadeouts();
			return;
		}

		if (timerState === 0) return; // timer isn't running

		// return on current or previous zone, on a linear map
		if (curZone <= this.lastZone && linear) return;

		// show only on zone enter for linear maps, zone exits on staged maps,
		// and start zone exits on linear maps
		const exitStartOnLinear = linear && !enter && startZone;
		if (linear === !enter && !exitStartOnLinear) return;

		this.lastZone = curZone;
		const actualSpeedAbs = ZonesAPI.GetZoneSpeed(curZone, false);
		const actualSpeedHoriz = ZonesAPI.GetZoneSpeed(curZone, true);
		const comparisonLoaded = RunComparisonsAPI.IsComparisonLoaded();

		if (comparisonLoaded) {
			const comparisonSpeedAbs = RunComparisonsAPI.GetLoadedComparisonSpeed(curZone, false);
			const comparisonSpeedHoriz = RunComparisonsAPI.GetLoadedComparisonSpeed(curZone, true);
			const diffAbs = actualSpeedAbs - comparisonSpeedAbs;
			const diffHoriz = actualSpeedHoriz - comparisonSpeedHoriz;

			this.updateZoneSpeedometers(actualSpeedAbs, actualSpeedHoriz, true, diffAbs, diffHoriz);
		} else {
			this.updateZoneSpeedometers(actualSpeedAbs, actualSpeedHoriz, false);
		}
	}

	static resetSpeedometerFadeouts() {
		for (const [type, speedometers] of SpeedometerMap) {
			if (!this.canSpeedometerTypeFadeOut(type)) continue;

			for (const speedometer of speedometers) this.resetSpeedometerFadeout(speedometer);
		}
	}
	static resetSpeedometerFadeout(speedometer) {
		// forcibly fade out immediately
		speedometer.speedometerPanel.RemoveClass(FADEOUT_START_CLASS);
		speedometer.speedometerPanel.TriggerClass(FADEOUT_CLASS);
		speedometer.prevVal = 0;
	}

	static getSpeedFromVelocity(velocity, settings) {
		let numAxes = 0;
		const enabledAxes = settings[SpeedometerDataKeys.ENABLED_AXES];
		for (const enabledAxis of enabledAxes) {
			if (enabledAxis) numAxes++;
		}

		if (numAxes > 1) {
			let squaredParts = 0;
			if (enabledAxes[0]) squaredParts += Math.pow(velocity.x, 2);
			if (enabledAxes[1]) squaredParts += Math.pow(velocity.y, 2);
			if (enabledAxes[2]) squaredParts += Math.pow(velocity.z, 2);
			return Math.sqrt(squaredParts);
		} else if (numAxes === 1) {
			if (enabledAxes[0]) return Math.abs(velocity.x);
			else if (enabledAxes[1]) return Math.abs(velocity.y);
			else if (enabledAxes[2]) return Math.abs(velocity.z);
		} else {
			$.Warning('Speedometer with no enabled axes found');
			return 0;
		}
	}

	static updateZoneSpeedometers(absSpeed, horizSpeed, hasComparison = true, absCustomdiff, horizCustomdiff) {
		/** @type {Array<SpeedometerObject>} */
		const speedometers = SpeedometerMap.get(SpeedometerTypes.ZONE_VELOCITY);
		if (!speedometers) return;

		for (const speedometer of speedometers) {
			// HACK: current runstats system only has abs and horiz speed, not the velocity vector
			const enabledAxes = speedometer.settings[SpeedometerDataKeys.ENABLED_AXES];
			const isHoriz = enabledAxes[0] && enabledAxes[1] && !enabledAxes[2];

			this.updateSpeedometer(
				SpeedometerTypes.ZONE_VELOCITY,
				speedometer,
				isHoriz ? horizSpeed : absSpeed,
				hasComparison,
				isHoriz ? absCustomdiff : horizCustomdiff
			);
		}
	}

	static updateSpeedometersOfType(type, velocity) {
		/** @type {Array<SpeedometerObject>} */
		const speedometers = SpeedometerMap.get(type);
		if (!speedometers) return;

		for (const speedometer of speedometers) {
			// HACK: last jump speedometer type don't have full velocity vector, and so the velocity they pass in is actually speed
			// Refactor runstats to fix
			const speed =
				type === SpeedometerTypes.JUMP_VELOCITY
					? velocity
					: this.getSpeedFromVelocity(velocity, speedometer.settings);

			this.updateSpeedometer(type, speedometer, speed);
		}
	}

	static updateSpeedometer(type, speedometer, speed, hasComparison = true, customdiff) {
		const colorType = speedometer.settings[SpeedometerDataKeys.COLOR_TYPE];

		const separateComparison = colorType === SpeedometerColorTypes.COMPARISON_SEP;
		const speedometerHasComparison = colorType === SpeedometerColorTypes.COMPARISON || separateComparison;

		if (hasComparison && speedometerHasComparison) {
			const diff = customdiff ?? speed - speedometer.prevVal;

			const labelToColor = separateComparison ? speedometer.comparisonLabel : speedometer.speedometerLabel;
			let diffSymbol;
			if (diff - this.correctedColorizeDeadzone > 0) {
				labelToColor.AddClass(INCREASE_CLASS);
				labelToColor.RemoveClass(DECREASE_CLASS);
				diffSymbol = '+';
			} else if (diff + this.correctedColorizeDeadzone < 0) {
				labelToColor.AddClass(DECREASE_CLASS);
				labelToColor.RemoveClass(INCREASE_CLASS);
				diffSymbol = '-';
			} else {
				labelToColor.RemoveClass(INCREASE_CLASS);
				labelToColor.RemoveClass(DECREASE_CLASS);
				diffSymbol = '';
			}

			if (separateComparison) {
				speedometer.comparisonLabel.text = `${diffSymbol}${Math.round(Math.abs(diff))}`;
				speedometer.speedometerLabel.RemoveClass(INCREASE_CLASS);
				speedometer.speedometerLabel.RemoveClass(DECREASE_CLASS);
			}

			speedometer.prevVal = speed;
		} else {
			speedometer.speedometerLabel.RemoveClass(INCREASE_CLASS);
			speedometer.speedometerLabel.RemoveClass(DECREASE_CLASS);

			/** @type {Array<RangeObject>} */
			const rangeList = speedometer.settings[RANGE_LIST_KEY];
			if (colorType === SpeedometerColorTypes.RANGE && rangeList) {
				let found = false;
				for (const range of rangeList) {
					if (speed >= range.min && speed <= range.max) {
						speedometer.speedometerLabel.style.color = range.color;
						found = true;
						continue;
					}
				}
				// backup to white
				if (!found) speedometer.speedometerLabel.style.color = 'rgba(255, 255, 255, 1)';
			}
		}

		speedometer.speedometerLabel.text = Math.round(speed);

		if (this.canSpeedometerTypeFadeOut(type)) {
			speedometer.speedometerPanel.AddClass(FADEOUT_START_CLASS);
			speedometer.speedometerPanel.TriggerClass(FADEOUT_CLASS);
		}
	}

	// Overall velocity speedometers shouldn't fade out as they constantly update
	static canSpeedometerTypeFadeOut(type) {
		return type !== SpeedometerTypes.OVERALL_VELOCITY;
	}

	static appendRangeColorProfileInfo(speedoData, colorProfData) {
		if (speedoData[SpeedometerDataKeys.COLOR_TYPE] !== SpeedometerColorTypes.RANGE) return;

		const colorProf = speedoData[SpeedometerDataKeys.RANGE_COL_PROF];
		if (!colorProf) return;

		const foundProfile = colorProfData.find((profile) => colorProf === profile[RangeColorProfileKeys.PROFILE_NAME]);
		if (!foundProfile) return;

		const rangesKV = foundProfile[RangeColorProfileKeys.PROFILE_RANGE_DATA];
		if (!rangesKV) return;

		speedoData[RANGE_LIST_KEY] = rangesKV.filter(Boolean).map((rangeKV) => {
			const [r, g, b, a] = rangeKV['color'];
			return new RangeObject(rangeKV['min'], rangeKV['max'], `rgba(${r}, ${g}, ${b}, ${a / 255})`);
		});
	}

	static onSettingsUpdate(success) {
		if (!success) {
			$.Warning('Failed to load speedometer settings from speedometer!');
			return;
		}

		const data = SpeedometerSettingsAPI.GetCurrentGamemodeSettings();
		if (!data) return;

		const colorProfData = SpeedometerSettingsAPI.GetColorProfiles();
		if (!colorProfData) return;

		this.unregisterFadeoutEventHandlers();
		this.container.RemoveAndDeleteChildren();

		SpeedometerMap = new Map();
		for (const speedoData of data) {
			const speedoType = speedoData[SpeedometerDataKeys.TYPE];
			if (speedoType === undefined || speedoType === null) continue;

			this.appendRangeColorProfileInfo(speedoData, colorProfData);

			/** @type {Label} */
			const newSpeedometerPanel = $.CreatePanel('Panel', this.container, '');
			newSpeedometerPanel.LoadLayoutSnippet('speedometer-entry');

			const speedometerContainer = newSpeedometerPanel.FindChildInLayoutFile('SpeedometerContainer');

			const speedoObject = new SpeedometerObject(speedoType, speedometerContainer, speedoData);

			const speedometersArray = SpeedometerMap.get(speedoType) ?? [];
			speedometersArray.push(speedoObject);
			SpeedometerMap.set(speedoType, speedometersArray);
		}

		this.registerFadeoutEventHandlers();
	}

	static {
		$.RegisterEventHandler('OnExplosiveHitSpeedUpdate', this.container, this.onExplosiveHitSpeedUpdate.bind(this));
		$.RegisterEventHandler('OnJumpSpeedUpdate', this.container, this.onJumpSpeedUpdate.bind(this));
		$.RegisterEventHandler('OnRampBoardSpeedUpdate', this.container, this.onRampBoardSpeedUpdate.bind(this));
		$.RegisterEventHandler('OnRampLeaveSpeedUpdate', this.container, this.onRampLeaveSpeedUpdate.bind(this));
		$.RegisterEventHandler('OnSpeedometerUpdate', this.container, this.onSpeedometerUpdate.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', this.onZoneChange.bind(this));

		// color profiles load before speedo settings, so listening to just the speedo settings load event should be enough
		$.RegisterForUnhandledEvent('OnSpeedometerSettingsLoaded', this.onSettingsUpdate.bind(this));
		// do want to register when color profiles are saved though as that can happen independently
		$.RegisterForUnhandledEvent('OnSpeedometerSettingsSaved', this.onSettingsUpdate.bind(this));
		$.RegisterForUnhandledEvent('OnRangeColorProfilesSaved', this.onSettingsUpdate.bind(this));
	}
}
