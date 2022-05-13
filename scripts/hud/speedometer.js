'use strict';

// 1 unit = 19.05mm -> 0.01905m -> 0.00001905Km(/s) -> 0.06858Km(/h)
const UPS_TO_KMH_FACTOR = 0.06858;
// 1 unit = 0.75", 1 mile = 63360. 0.75 / 63360 ~~> 0.00001184"(/s) ~~> 0.04262MPH
const UPS_TO_MPH_FACTOR = 0.04262;

const hueShift = 110;
const invis = 'rgba(0, 0, 0, 0)';
const firstColor = 'rgba(178, 178, 178, 0.8)';

// Global used to test speed bar settings
const bUseSpeedBar = true; // should be accounted for in settings passed to SpeedometerObject

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
	constructor(name, container, label, bar, comparisonlabel, settings, eventbased, prevVal) {
		this.name = name;
		this.container = container;
		this.label = label;
		this.bar = bar;
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
		$('#AbsSpeedBar'),
		$('#AbsSpeedometerComparison'),
		null,
		false,
		0
	),
	new SpeedometerObject(
		'HorizSpeedometer',
		$('#HorizSpeedometerContainer'),
		$('#HorizSpeedometer'),
		$('#HorizSpeedBar'),
		$('#HorizSpeedometerComparison'),
		null,
		false,
		0
	),
	new SpeedometerObject(
		'VertSpeedometer',
		$('#VertSpeedometerContainer'),
		$('#VertSpeedometer'),
		$('#VertSpeedBar'),
		$('#VertSpeedometerComparison'),
		null,
		false,
		0
	),
	new SpeedometerObject(
		'EnergySpeedometer',
		$('#EnergySpeedometerContainer'),
		$('#EnergySpeedometer'),
		$('#EnergySpeedBar'),
		$('#EnergySpeedometerComparison'),
		null,
		false,
		0
	),
	new SpeedometerObject(
		'ExplosiveJumpVelocity',
		$('#ExplosiveJumpVelocityContainer'),
		$('#ExplosiveJumpVelocity'),
		$('#ExplosiveJumpSpeedBar'),
		$('#ExplosiveJumpVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'LastJumpVelocity',
		$('#LastJumpVelocityContainer'),
		$('#LastJumpVelocity'),
		$('#LastJumpSpeedBar'),
		$('#LastJumpVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'RampBoardVelocity',
		$('#RampBoardVelocityContainer'),
		$('#RampBoardVelocity'),
		$('#RampBoardSpeedBar'),
		$('#RampBoardVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'RampLeaveVelocity',
		$('#RampLeaveVelocityContainer'),
		$('#RampLeaveVelocity'),
		$('#RampLeaveSpeedBar'),
		$('#RampLeaveVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'StageEnterExitAbsVelocity',
		$('#StageEnterExitAbsVelocityContainer'),
		$('#StageEnterExitAbsVelocity'),
		$('#StageEnterExitAbsSpeedBar'),
		$('#StageEnterExitAbsVelocityComparison'),
		null,
		true,
		0
	),
	new SpeedometerObject(
		'StageEnterExitHorizVelocity',
		$('#StageEnterExitHorizVelocityContainer'),
		$('#StageEnterExitHorizVelocity'),
		$('#StageEnterExitHorizSpeedBar'),
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

		const filteredSpeedos = Speedometers.filter((speedometer) => speedometer.container.id === panelName);
		if (!filteredSpeedos[0]) return;

		filteredSpeedos[0].prevVal = 0;
	}
	static registerFadeoutEventHandlers() {
		Speedometers.forEach((speedometer) => {
			$.RegisterEventHandler('PropertyTransitionEnd', speedometer.container, this.onFadeoutEvent);
		});
	}

	static onSpeedometerUpdate(deltaTime) {
		const velocity = MomentumPlayerAPI.GetVelocity();

		const xSquared = Math.pow(velocity.x, 2);
		const ySquared = Math.pow(velocity.y, 2);
		const absVelocity = Math.sqrt(xSquared + ySquared + Math.pow(velocity.z, 2));
		const horizVelocity = Math.sqrt(xSquared + ySquared);

		this.correctedColorizeDeadzone = deltaTime * COLORIZE_DEADZONE;
		this.update(SPEEDOMETER_ID.AbsSpeedometer, absVelocity);
		this.update(SPEEDOMETER_ID.HorizSpeedometer, horizVelocity);
		this.update(SPEEDOMETER_ID.VertSpeedometer, Math.abs(velocity.z));
		this.update(SPEEDOMETER_ID.EnergySpeedometer, MomentumPlayerAPI.GetEnergy());
	}
	static onExplosiveHitSpeedUpdate(hitVelocity) {
		this.update(SPEEDOMETER_ID.ExplosiveJumpVelocity, hitVelocity);
	}
	static onJumpSpeedUpdate(jumpVelocity) {
		this.update(SPEEDOMETER_ID.LastJumpVelocity, jumpVelocity);
	}
	static onRampBoardSpeedUpdate(rampBoardVelocity) {
		this.update(SPEEDOMETER_ID.RampBoardVelocity, rampBoardVelocity);
	}
	static onRampLeaveSpeedUpdate(rampLeaveVelocity) {
		this.update(SPEEDOMETER_ID.RampLeaveVelocity, rampLeaveVelocity);
	}

	static onZoneChange(enter, linear, curZone, _curTrack, timerState) {
		const startZone = curZone === 1;
		if (enter && startZone) {
			this.lastZone = 0;
			this.resetEventSpeedometers();
			return;
		}

		if (timerState === 0) return; // timer isnt running

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
			this.update(SPEEDOMETER_ID.StageEnterExitAbsVelocity, actualSpeedAbs, true, diffAbs);
			this.update(SPEEDOMETER_ID.StageEnterExitHorizVelocity, actualSpeedHoriz, true, diffHoriz);
		} else {
			this.update(SPEEDOMETER_ID.StageEnterExitAbsVelocity, actualSpeedAbs, false);
			this.update(SPEEDOMETER_ID.StageEnterExitHorizVelocity, actualSpeedHoriz, false);
		}
	}

	static resetEventSpeedometers() {
		Speedometers.filter((speedometer) => speedometer.eventbased).forEach((speedometer) => {
			this.resetEventSpeedometer(speedometer);
		});
	}
	static resetEventSpeedometer(speedometer) {
		// forcibly fade out immediately
		speedometer.container.RemoveClass(FADEOUT_START_CLASS);
		speedometer.container.TriggerClass(FADEOUT_CLASS);
		speedometer.prevVal = 0;
	}

	static update(speedoID, velocity, hasComparison = true, customdiff) {
		let speedometer = Speedometers[speedoID];
		if (!speedometer.settings || !speedometer.settings.visible) return;

		switch (speedometer.settings.units) {
			case SPEEDOMETER_UNITS_TYPE.KMH:
				velocity *= UPS_TO_KMH_FACTOR;
				break;
			case SPEEDOMETER_UNITS_TYPE.MPH:
				velocity *= UPS_TO_MPH_FACTOR;
				break;
			default:
				break;
		}

		// find speed bar colors
		const walkSpeed = GameInterfaceAPI.GetSettingFloat('sv_maxspeed');
		const denominator = walkSpeed ? walkSpeed : 320;
		const speedRatio = velocity / denominator;
		const wrap = Math.trunc(speedRatio);
		let fillPercent = (speedRatio - wrap) * 100;

		const hue = this.normalize360(hueShift * wrap);
		const saturation = 100;
		const lightness = 50;

		let FGcolor = wrap > 0 ? this.makeColorFromHSLA(hue, saturation, lightness, 0.8) : firstColor;
		let BGcolor = firstColor;

		if (wrap > 1) {
			BGcolor = this.makeColorFromHSLA(this.normalize360(hue - hueShift), saturation, lightness, 0.8);
		} else {
			BGcolor = wrap ? firstColor : invis;
		}

		const separateComparison = speedometer.settings.colorizeMode === SPEEDOMETER_COLOR_MODE.COMPARISON_SEP;
		if (
			hasComparison &&
			(speedometer.settings.colorizeMode === SPEEDOMETER_COLOR_MODE.COMPARISON || separateComparison)
		) {
			// energy speedometer can be negative!
			const speed = speedoID === SPEEDOMETER_ID.EnergySpeedometer ? velocity : Math.abs(velocity);
			const diff = !customdiff ? speed - speedometer.prevVal : customdiff;

			let labelToColor = separateComparison ? speedometer.comparisonlabel : speedometer.label;
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
				diffSymbol = '±';
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
			if (speedometer.settings.colorizeMode === SPEEDOMETER_COLOR_MODE.RANGE && speedometer.settings.ranges) {
				let found = false;
				let BGMaxValue = 0;
				speedometer.settings.ranges.forEach((range, i) => {
					if (range.max < velocity && range.max > BGMaxValue) {
						BGcolor = range.color;
						BGMaxValue = range.max;
					} else if (velocity >= range.min && velocity <= range.max) {
						speedometer.label.style.color = bUseSpeedBar ? 'rgba(255, 255, 255, 1)' : range.color;
						FGcolor = range.color;
						fillPercent = (velocity - range.min) / (range.max - range.min) * 100;
						found = true;
						//return;
					}
				});
				if (!found) {
					// backup to white
					speedometer.label.style.color = 'rgba(255, 255, 255, 1)';
				}
			}
		}

		// fill in speed bar & label
		if (bUseSpeedBar && speedometer.bar) {
			speedometer.bar.value = fillPercent;
			speedometer.bar.GetChild(0).style.backgroundColor = this.makeGradientFromRGBA(FGcolor); //left bar is child 0
			speedometer.bar.style.backgroundColor = this.makeGradientFromRGBA(BGcolor);
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
		Speedometers.forEach((speedometer) => {
			const orderIndex = orderKV[`${speedometer.name}`];
			speedometer.container.SetAttributeInt('speedo_index', orderIndex);

			const speedoSetting = data[speedometer.name];

			const rangeList = [];
			const colorProf = speedoSetting['color_profile'];
			if (colorProf) {
				const rangesKV = colorProfData[colorProf];
				if (rangesKV) {
					Object.keys(rangesKV).forEach(range => {
						const rangeKV = rangesKV[range];
						if (rangeKV) {
							const splitColor = rangeKV['color'].split(' ');
							const color = `rgba(${splitColor[0]}, ${splitColor[1]}, ${splitColor[2]}, ${
								splitColor[3] / 255
							})`;
							rangeList.push(new RangeObject(rangeKV['min'], rangeKV['max'], color));
						}
					});
				}
			}

			const visible = speedoSetting['visible'];
			speedometer.label.SetHasClass(HIDDEN_CLASS, !visible);

			const colorizeMode = speedoSetting['colorize'];
			speedometer.comparisonlabel.SetHasClass(
				HIDDEN_CLASS,
				!visible || colorizeMode !== SPEEDOMETER_COLOR_MODE.COMPARISON_SEP
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
		});

		// sorts using speedo_index attribute numbers
		$.GetContextPanel().SortSpeedometers();
	}

	static makeColorFromHSLA(hue, saturation, lightness, alpha) {
		const hueRatio = hue / 60;
		const hueRatio_Whole = Math.trunc(hueRatio);
		const hueRatio_Fraction = hueRatio - hueRatio_Whole;

		const RGBArray = [
			lightness,
			lightness * (1 - saturation),
			lightness * (1 - (hueRatio_Fraction * saturation)),
			lightness * (1 - ((1 - hueRatio_Fraction) * saturation))
		];
		const RGBSelector = [
			[0, 3, 1],
			[2, 0, 1],
			[1, 0, 3],
			[1, 2, 0],
			[3, 1, 0],
			[0, 1, 2]
		];
		const index = hueRatio_Whole % 6;

		const red = RGBArray[RGBSelector[index][0]];
		const green = RGBArray[RGBSelector[index][1]];
		const blue = RGBArray[RGBSelector[index][2]];

		return `rgba(${red * 255}, ${green * 255}, ${blue * 255}, ${alpha})`;
	}

	static makeGradientFromRGBA(inColor) {
		const colorArray = this.splitColorString(inColor);
		const topColor = this.getColorStringFromArray(colorArray.map((c, i) => i == 3 ? c : 0.5 * (c + 255)));
		const bottomrColor = this.getColorStringFromArray(colorArray.map((c, i) => i == 3 ? c : 0.5 * c));;
		return `gradient(linear, 0% 0%, 0% 100%, from(${bottomrColor}), color-stop(0.25, ${inColor}), color-stop(0.75, ${inColor}), to(${topColor}))`;
	}

	static getColorStringFromArray(color) {
		return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
	}

	static splitColorString(string) {
		return string.slice(5, -1).split(',').map((c, i) => i == 3 ? parseInt(c * 255) : parseInt(c));
	}

	static normalize360(angle) {
		const newAngle = angle - Math.sign(angle) * Math.trunc(angle / 360) * 360;
		return newAngle < 0 ? newAngle + 360 : newAngle;
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
