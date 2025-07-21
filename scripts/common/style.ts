import { Style } from 'common/web/enums/style.enum';
import { Gamemode } from './web/enums/gamemode.enum';

const RunStyleNames: ReadonlyMap<Style, string> = new Map([
	[Style.NORMAL, '#RunStyle_Normal'],
	[Style.HALF_SIDEWAYS, '#RunStyle_HalfSideways'],
	[Style.REAL_HALF_SIDEWAYS, '#RunStyle_RealHalfSideways'],
	[Style.SIDEWAYS, '#RunStyle_Sideways'],
	[Style.W_ONLY, '#RunStyle_WOnly'],
	[Style.AD_ONLY, '#RunStyle_ADOnly'],
	[Style.S_ONLY, '#RunStyle_SOnly'],
	[Style.BACKWARDS, '#RunStyle_Backwards'],
	[Style.TELEPORT, '#RunStyle_Teleport']
]);

export function getRunStyleName(style: Style, gamemode: Gamemode): string {
	if (
		style === Style.NORMAL &&
		(gamemode === Gamemode.CLIMB_MOM || gamemode === Gamemode.CLIMB_KZT || gamemode === Gamemode.CLIMB_16)
	) {
		return '#RunStyle_NoTeleport';
	}

	return RunStyleNames.get(style) || '#RunStyle_Unknown';
}
