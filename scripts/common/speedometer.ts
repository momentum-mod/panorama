export enum SpeedometerTypes {
	OVERALL_VELOCITY = 0,
	EXPLOSION_VELOCITY = 1,
	JUMP_VELOCITY = 2,
	RAMP_VELOCITY = 3,
	ZONE_VELOCITY = 4
}

export enum SpeedometerDataKeys {
	CUSTOM_LABEL = 'custom_label',
	TYPE = 'type',
	ENABLED_AXES = 'enabled_axes',
	COLOR_TYPE = 'color_type',
	RANGE_COL_PROF = 'range_color_profile'
}

export enum RangeColorProfileKeys {
	PROFILE_NAME = 'profile_name',
	PROFILE_RANGE_DATA = 'profile_ranges'
}

export enum SpeedometerColorTypes {
	NONE = 0,
	RANGE = 1,
	COMPARISON = 2,
	COMPARISON_SEP = 3
}

export const SpeedometerDispNames: ReadonlyMap<SpeedometerTypes, string> = new Map([
	[SpeedometerTypes.OVERALL_VELOCITY, '#Speedometer_Type_OverallVelocity'],
	[SpeedometerTypes.EXPLOSION_VELOCITY, '#Speedometer_Type_ExplosiveJump'],
	[SpeedometerTypes.JUMP_VELOCITY, '#Speedometer_Type_Jump'],
	[SpeedometerTypes.RAMP_VELOCITY, '#Speedometer_Type_Ramp'],
	[SpeedometerTypes.ZONE_VELOCITY, '#Speedometer_Type_Zone']
]);
