// This needs to be in sync with the RunStyle enum in C++.
export enum RunStyle {
	NORMAL = 0,
	HALF_SIDEWAYS,
	SIDEWAYS,
	W_ONLY,
	AD_ONLY,
	S_ONLY,
	NO_TELEPORT
}

export const RunStyleNames: ReadonlyMap<RunStyle, string> = new Map([
	[RunStyle.NORMAL, '#RunStyle_Normal'],
	[RunStyle.HALF_SIDEWAYS, '#RunStyle_HalfSideways'],
	[RunStyle.SIDEWAYS, '#RunStyle_Sideways'],
	[RunStyle.W_ONLY, '#RunStyle_WOnly'],
	[RunStyle.AD_ONLY, '#RunStyle_ADOnly'],
	[RunStyle.S_ONLY, '#RunStyle_SOnly'],
	[RunStyle.NO_TELEPORT, '#RunStyle_NoTeleport']
]);
