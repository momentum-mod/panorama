import { Style } from 'common/web/enums/style.enum';

const RunStyleNames: ReadonlyMap<Style, string> = new Map([
	[Style.NORMAL, '#RunStyle_Normal'],
	[Style.BHOP_HALF_SIDEWAYS, '#RunStyle_BhopHalfSideways'],
	[Style.SURF_HALF_SIDEWAYS, '#RunStyle_SurfHalfSideways'],
	[Style.SIDEWAYS, '#RunStyle_Sideways'],
	[Style.W_ONLY, '#RunStyle_WOnly'],
	[Style.AD_ONLY, '#RunStyle_ADOnly'],
	[Style.S_ONLY, '#RunStyle_SOnly'],
	[Style.BACKWARDS, '#RunStyle_Backwards'],
	[Style.PRO, '#RunStyle_Pro'],
	[Style.TELEPORT, '#RunStyle_Teleport']
]);

export function getRunStyleName(style: Style): string {
	return RunStyleNames.get(style) || '#RunStyle_Unknown';
}
