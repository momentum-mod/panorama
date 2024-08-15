const SpeedometerTypes = {
	OVERALL_VELOCITY: 0,
	EXPLOSION_VELOCITY: 1,
	JUMP_VELOCITY: 2,
	RAMP_VELOCITY: 3,
	ZONE_VELOCITY: 4
};

const SpeedometerDataKeys = {
	CUSTOM_LABEL: 'custom_label',
	TYPE: 'type',
	ENABLED_AXES: 'enabled_axes',
	COLOR_TYPE: 'color_type',
	RANGE_COL_PROF: 'range_color_profile'
};

const RangeColorProfileKeys = {
	PROFILE_NAME: 'profile_name',
	PROFILE_RANGE_DATA: 'profile_ranges'
};

const SpeedometerColorTypes = {
	NONE: 0,
	RANGE: 1,
	COMPARISON: 2,
	COMPARISON_SEP: 3
};

// To be index via SpeedometerTypes
const SpeedometerDispNames = [
	'#Speedometer_Type_OverallVelocity',
	'#Speedometer_Type_ExplosiveJump',
	'#Speedometer_Type_Jump',
	'#Speedometer_Type_Ramp',
	'#Speedometer_Type_Zone'
];
