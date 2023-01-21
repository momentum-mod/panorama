'use strict';

// 1 unit = 19.05mm -> 0.01905m -> 0.00001905Km(/s) -> 0.06858Km(/h)
const UPS_TO_KMH_FACTOR = 0.06858;
// 1 unit = 0.75", 1 mile = 63360. 0.75 / 63360 ~~> 0.00001184"(/s) ~~> 0.04262MPH
const UPS_TO_MPH_FACTOR = 0.04262;

// arbitrary value to determine how much speed needs to change to be considered an increase/decrease
// adjusted by speedometer update delta time
const COLORIZE_DEADZONE = 2;

const HIDDEN_CLASS = 'speedometer--hidden';
const INCREASE_CLASS = 'speedometer--increase';
const DECREASE_CLASS = 'speedometer--decrease';
const FADEOUT_CLASS = 'speedometer--fadeout';
const FADEOUT_START_CLASS = 'speedometer--fade-start';

class RangeObject {
	constructor(min, max, color) {
		this.min = min;
		this.max = max;
		this.color = color;
	}
}
class SpeedoSettingsObject {
	constructor(visible, colorizeMode, units, ranges) {
		this.visible = visible;
		this.colorizeMode = colorizeMode;
		this.units = units;
		this.ranges = ranges;
	}
}
class SpeedometerObject {
	constructor(name, container, label, comparisonlabel, settings, eventbased, prevVal) {
		this.name = name;
		this.container = container;
		this.label = label;
		this.comparisonlabel = comparisonlabel;
		this.settings = settings;
		this.eventbased = eventbased;
		this.prevVal = prevVal;
	}
}
const Speedometers = [
	new SpeedometerObject(
		'AbsSpeedometer',
		$('#AbsSpeedometerContainer'),
		$('#AbsSpeedometer'),
		$('#AbsSpeedometerComparison'),
		null,
		false,
		0
	),
	new SpeedometerObject(
		'HorizSpeedometer',
		$('#HorizSpeedometerContainer'),
		$('#HorizSpeedometer'),
		$('#HorizSpeedometerComparison'),
		null,
		false,
		0
	),
	new SpeedometerObject(
		'VertSpeedometer',
		$('#VertSpeedometerContainer'),
		$('#VertSpeedometer'),
		$('#VertSpeedometerComparison'),
		null,
		false,
		0
	),
	new SpeedometerObject(
		'EnergySpeedometer',
		$('#EnergySpeedometerContainer'),
		$('#EnergySpeedometer'),
		$('#EnergySpeedometerComparison'),
		null,
		false,
		0
	),
	new SpeedometerObject(
		'ExplosiveJumpVelocity',
		$('#ExplosiveJumpVelocityContainer'),
		$('#ExplosiveJumpVelocity'),
		$('#ExplosiveJumpVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'LastJumpVelocity',
		$('#LastJumpVelocityContainer'),
		$('#LastJumpVelocity'),
		$('#LastJumpVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'RampBoardVelocity',
		$('#RampBoardVelocityContainer'),
		$('#RampBoardVelocity'),
		$('#RampBoardVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'RampLeaveVelocity',
		$('#RampLeaveVelocityContainer'),
		$('#RampLeaveVelocity'),
		$('#RampLeaveVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'StageEnterExitAbsVelocity',
		$('#StageEnterExitAbsVelocityContainer'),
		$('#StageEnterExitAbsVelocity'),
		$('#StageEnterExitAbsVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'StageEnterExitHorizVelocity',
		$('#StageEnterExitHorizVelocityContainer'),
		$('#StageEnterExitHorizVelocity'),
		$('#StageEnterExitHorizVelocityComparison'),
		null,
		true,
		0
	)
];

class Speedometer {
	static container = $('#SpeedometerContainer');
	static lastZone = 0;
	static correctedColorizeDeadzone = 0;

	static onLoad() {
		Speedometer.registerFadeoutEventHandlers();
	}
	static onFadeoutEvent(panelName, styleName) {
		// reset previous value on fadeout
		if (styleName !== 'opacity') return;

		const filteredSpeedo = Speedometers.find((speedometer) => speedometer.container.id === panelName);
		if (!filteredSpeedo) return;

		filteredSpeedo.prevVal = 0;
	}
	static registerFadeoutEventHandlers() {
		for (const speedometer of Speedometers) {
			$.RegisterEventHandler('PropertyTransitionEnd', speedometer.container, this.onFadeoutEvent);
		}
	}

	static onSpeedometerUpdate(deltaTime) {
		const velocity = MomentumPlayerAPI.GetVelocity();

		const xSquared = Math.pow(velocity.x, 2);
		const ySquared = Math.pow(velocity.y, 2);
		const absVelocity = Math.sqrt(xSquared + ySquared + Math.pow(velocity.z, 2));
		const horizVelocity = Math.sqrt(xSquared + ySquared);

		this.correctedColorizeDeadzone = deltaTime * COLORIZE_DEADZONE;
		this.update(SpeedometerIDs.AbsSpeedometer, absVelocity);
		this.update(SpeedometerIDs.HorizSpeedometer, horizVelocity);
		this.update(SpeedometerIDs.VertSpeedometer, Math.abs(velocity.z));
		this.update(SpeedometerIDs.EnergySpeedometer, MomentumPlayerAPI.GetEnergy());
	}
	static onExplosiveHitSpeedUpdate(hitVelocity) {
		this.update(SpeedometerIDs.ExplosiveJumpVelocity, hitVelocity);
	}
	static onJumpSpeedUpdate(jumpVelocity) {
		this.update(SpeedometerIDs.LastJumpVelocity, jumpVelocity);
	}
	static onRampBoardSpeedUpdate(rampBoardVelocity) {
		this.update(SpeedometerIDs.RampBoardVelocity, rampBoardVelocity);
	}
	static onRampLeaveSpeedUpdate(rampLeaveVelocity) {
		this.update(SpeedometerIDs.RampLeaveVelocity, rampLeaveVelocity);
	}

	static onZoneChange(enter, linear, curZone, _curTrack, timerState) {
		const startZone = curZone === 1;
		if (enter && startZone) {
			this.lastZone = 0;
			this.resetEventSpeedometers();
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
			this.update(SpeedometerIDs.StageEnterExitAbsVelocity, actualSpeedAbs, true, diffAbs);
			this.update(SpeedometerIDs.StageEnterExitHorizVelocity, actualSpeedHoriz, true, diffHoriz);
		} else {
			this.update(SpeedometerIDs.StageEnterExitAbsVelocity, actualSpeedAbs, false);
			this.update(SpeedometerIDs.StageEnterExitHorizVelocity, actualSpeedHoriz, false);
		}
	}

	static resetEventSpeedometers() {
		for (const speedometer of Speedometers.filter((speedometer) => speedometer.eventbased)) {
			this.resetEventSpeedometer(speedometer);
		}
	}
	static resetEventSpeedometer(speedometer) {
		// forcibly fade out immediately
		speedometer.container.RemoveClass(FADEOUT_START_CLASS);
		speedometer.container.TriggerClass(FADEOUT_CLASS);
		speedometer.prevVal = 0;
	}

	static update(speedoID, velocity, hasComparison = true, customdiff) {
		const speedometer = Speedometers[speedoID];
		if (!speedometer.settings || !speedometer.settings.visible) return;

		switch (speedometer.settings.units) {
			case SpeedometerUnitsType.KMH:
				velocity *= UPS_TO_KMH_FACTOR;
				break;
			case SpeedometerUnitsType.MPH:
				velocity *= UPS_TO_MPH_FACTOR;
				break;
			default:
				break;
		}

		const separateComparison = speedometer.settings.colorizeMode === SpeedometerColorMode.COMPARISON_SEP;
		if (
			hasComparison &&
			(speedometer.settings.colorizeMode === SpeedometerColorMode.COMPARISON || separateComparison)
		) {
			// energy speedometer can be negative!
			const speed = speedoID === SpeedometerIDs.EnergySpeedometer ? velocity : Math.abs(velocity);
			const diff = customdiff ?? speed - speedometer.prevVal;

			const labelToColor = separateComparison ? speedometer.comparisonlabel : speedometer.label;
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
				speedometer.comparisonlabel.text = ` ${diffSymbol}${Math.round(Math.abs(diff))}`;
				speedometer.label.RemoveClass(INCREASE_CLASS);
				speedometer.label.RemoveClass(DECREASE_CLASS);
			}

			speedometer.prevVal = speed;
		} else {
			speedometer.label.RemoveClass(INCREASE_CLASS);
			speedometer.label.RemoveClass(DECREASE_CLASS);
			if (speedometer.settings.colorizeMode === SpeedometerColorMode.RANGE && speedometer.settings.ranges) {
				let found = false;
				for (const range of speedometer.settings.ranges) {
					if (velocity >= range.min && velocity <= range.max) {
						speedometer.label.style.color = range.color;
						found = true;
						continue;
					}
				}
				if (!found) {
					// backup to white
					speedometer.label.style.color = 'rgba(255, 255, 255, 1)';
				}
			}
		}

		speedometer.label.text = Math.round(velocity);

		if (speedometer.eventbased) {
			speedometer.container.AddClass(FADEOUT_START_CLASS);
			speedometer.container.TriggerClass(FADEOUT_CLASS);
		}
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

		const orderKV = data['order'];
		for (const speedometer of Speedometers) {
			const orderIndex = orderKV[`${speedometer.name}`];
			speedometer.container.SetAttributeInt('speedo_index', orderIndex);

			const speedoSetting = data[speedometer.name];

			const rangeList = [];
			const colorProf = speedoSetting['color_profile'];
			if (colorProf) {
				const rangesKV = colorProfData[colorProf];
				if (rangesKV) {
					for (const range of Object.keys(rangesKV)) {
						const rangeKV = rangesKV[range];
						if (rangeKV) {
							const splitColor = rangeKV['color'].split(' ');
							const color = `rgba(${splitColor[0]}, ${splitColor[1]}, ${splitColor[2]}, ${
								splitColor[3] / 255
							})`;
							rangeList.push(new RangeObject(rangeKV['min'], rangeKV['max'], color));
						}
					}
				}
			}

			const visible = speedoSetting['visible'];
			speedometer.label.SetHasClass(HIDDEN_CLASS, !visible);

			const colorizeMode = speedoSetting['colorize'];
			speedometer.comparisonlabel.SetHasClass(
				HIDDEN_CLASS,
				!visible || colorizeMode !== SpeedometerColorMode.COMPARISON_SEP
			);

			speedometer.settings = new SpeedoSettingsObject(visible, colorizeMode, speedoSetting['units'], rangeList);
			speedometer.prevVal = 0;

			// remove status classes
			speedometer.container.RemoveClass(FADEOUT_START_CLASS);
			speedometer.container.RemoveClass(FADEOUT_CLASS);
			speedometer.label.RemoveClass(DECREASE_CLASS);
			speedometer.label.RemoveClass(INCREASE_CLASS);
			speedometer.comparisonlabel.RemoveClass(DECREASE_CLASS);
			speedometer.comparisonlabel.RemoveClass(INCREASE_CLASS);
		}

		// sorts using speedo_index attribute numbers
		$.GetContextPanel().SortSpeedometers();
	}

	static {
		$.RegisterEventHandler('OnExplosiveHitSpeedUpdate', this.container, this.onExplosiveHitSpeedUpdate.bind(this));
		$.RegisterEventHandler('OnJumpSpeedUpdate', this.container, this.onJumpSpeedUpdate.bind(this));
		$.RegisterEventHandler('OnRampBoardSpeedUpdate', this.container, this.onRampBoardSpeedUpdate.bind(this));
		$.RegisterEventHandler('OnRampLeaveSpeedUpdate', this.container, this.onRampLeaveSpeedUpdate.bind(this));
		$.RegisterEventHandler('OnSpeedometerUpdate', this.container, this.onSpeedometerUpdate.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', this.onZoneChange.bind(this));

		// color profiles load before speedo settings, so this should be enough
		$.RegisterForUnhandledEvent('OnSpeedometerSettingsLoaded', this.onSettingsUpdate.bind(this));
		// do want to register when color profiles are saved though as that can happen independently
		$.RegisterForUnhandledEvent('OnSpeedometerSettingsSaved', this.onSettingsUpdate.bind(this));
		$.RegisterForUnhandledEvent('OnRangeColorProfilesSaved', this.onSettingsUpdate.bind(this));
	}
}
