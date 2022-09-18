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

const SPEEDOMETER_DISP_NAMES = [
	'#Speedometer_Type_Absolute',
	'#Speedometer_Type_Horizonal',
	'#Speedometer_Type_Vertical',
	'#Speedometer_Type_Energy',
	'#Speedometer_Type_ExplosiveJump',
	'#Speedometer_Type_Jump',
	'#Speedometer_Type_RampBoard',
	'#Speedometer_Type_RampLeave',
	'#Speedometer_Type_StageAbsolute',
	'#Speedometer_Type_StageHorizontal'
];
