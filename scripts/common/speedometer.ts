// We need to iterate over this prick so not using const enum.
export enum SpeedometerType {
	OVERALL_VELOCITY = 0,
	EXPLOSION_VELOCITY = 1,
	JUMP_VELOCITY = 2,
	RAMP_VELOCITY = 3,
	ZONE_VELOCITY = 4
}

export enum SpeedometerColorType {
	NONE = 0,
	RANGE = 1,
	COMPARISON = 2,
	COMPARISON_SEP = 3
}

export const SpeedometerDispNames: ReadonlyMap<SpeedometerType, string> = new Map([
	[SpeedometerType.OVERALL_VELOCITY, '#Speedometer_Type_OverallVelocity'],
	[SpeedometerType.EXPLOSION_VELOCITY, '#Speedometer_Type_ExplosiveJump'],
	[SpeedometerType.JUMP_VELOCITY, '#Speedometer_Type_Jump'],
	[SpeedometerType.RAMP_VELOCITY, '#Speedometer_Type_Ramp'],
	[SpeedometerType.ZONE_VELOCITY, '#Speedometer_Type_Zone']
]);
