import { Gamemode } from './web/enums/gamemode.enum';

// This needs to be in sync with the RunStyle enum in C++.
export enum RunStyle {
	NORMAL = 0,
	HALF_SIDEWAYS,
	SIDEWAYS,
	W_ONLY,
	AD_ONLY,
	S_ONLY,
	BACKWARDS,
	TELEPORT
}

const RunStyleNames: ReadonlyMap<RunStyle, string> = new Map([
	[RunStyle.NORMAL, '#RunStyle_Normal'],
	[RunStyle.HALF_SIDEWAYS, '#RunStyle_HalfSideways'],
	[RunStyle.SIDEWAYS, '#RunStyle_Sideways'],
	[RunStyle.W_ONLY, '#RunStyle_WOnly'],
	[RunStyle.AD_ONLY, '#RunStyle_ADOnly'],
	[RunStyle.S_ONLY, '#RunStyle_SOnly'],
	[RunStyle.BACKWARDS, '#RunStyle_Backwards'],
	[RunStyle.TELEPORT, '#RunStyle_Teleport']
]);

export function getRunStyleName(style: RunStyle, gamemode: Gamemode): string {
	if (
		style === RunStyle.NORMAL &&
		(gamemode === Gamemode.CLIMB_MOM || gamemode === Gamemode.CLIMB_KZT || gamemode === Gamemode.CLIMB_16)
	) {
		return '#RunStyle_NoTeleport';
	}

	return RunStyleNames.get(style) || '#RunStyle_Unknown';
}
