import { Style } from 'common/web/enums/style.enum';
import { CompleteMap } from './web/types/utils/compete-map.type';

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
	[Style.TELEPORT, '#RunStyle_Teleport'],
	[Style.BUFFERED_JUMP, '#RunStyle_BufferedJump'],
	[Style.SCROLL, '#RunStyle_Scroll'],
	[Style._400VELBUFFERED, '#RunStyle_400VelBuffered'],
	[Style._400VELSCROLL, '#RunStyle_400VelScroll']
]) satisfies CompleteMap<Style>;

export function getRunStyleName(style: Style): string {
	return RunStyleNames.get(style) || '#RunStyle_Unknown';
}
