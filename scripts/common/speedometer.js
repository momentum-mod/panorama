'use strict';

const SPEEDOMETER_UNITS_TYPE = {
	UPS: 0,
	KMH: 1,
	MPH: 2
};

const SPEEDOMETER_COLOR_MODE = {
	NONE: 0,
	RANGE: 1,
	COMPARISON: 2,
	COMPARISON_SEP: 3
};

// these key names match the names of speedometers in the .vdf files
const SPEEDOMETER_ID = {
	AbsSpeedometer: 0,
	HorizSpeedometer: 1,
	VertSpeedometer: 2,
	EnergySpeedometer: 3,
	ExplosiveJumpVelocity: 4,
	LastJumpVelocity: 5,
	RampBoardVelocity: 6,
	RampLeaveVelocity: 7,
	StageEnterExitAbsVelocity: 8,
	StageEnterExitHorizVelocity: 9
};

// TODO: localize
const SPEEDOMETER_DISP_NAMES = [
	'Absolute',
	'Horizontal',
	'Vertical',
	'Energy',
	'Explosive Jump',
	'Jump',
	'Ramp Board',
	'Ramp Leave',
	'Stage Absolute',
	'Stage Horizontal'
];
