import {
	GamemodeInfo as GamemodeInfoWeb,
	GamemodeInfoProperties as GamemodeInfoPropertiesWeb
} from './web/maps/gamemodes.map';
import { Gamemode } from './web/enums/gamemode.enum';

export interface GamemodeInfoProperties extends GamemodeInfoPropertiesWeb {
	i18n: string;
}

// Website repo has the majority of gamemode info using this file for any pano-specific stuff
const extraModeData = [
	[Gamemode.SURF, { i18n: '#Gamemode_Surf' }],
	[Gamemode.BHOP, { i18n: '#Gamemode_Bhop' }],
	[Gamemode.BHOP_HL1, { i18n: '#Gamemode_BhopHL1' }],
	[Gamemode.CLIMB_MOM, { i18n: '#Gamemode_KzMom' }],
	[Gamemode.CLIMB_KZT, { i18n: '#Gamemode_KzKzt' }],
	[Gamemode.CLIMB_16, { i18n: '#Gamemode_Kz16' }],
	[Gamemode.RJ, { i18n: '#Gamemode_RJ' }],
	[Gamemode.SJ, { i18n: '#Gamemode_SJ' }],
	[Gamemode.AHOP, { i18n: '#Gamemode_Ahop' }],
	[Gamemode.CONC, { i18n: '#Gamemode_Conc' }],
	[Gamemode.DEFRAG_CPM, { i18n: '#Gamemode_DefragCPM' }],
	[Gamemode.DEFRAG_VQ3, { i18n: '#Gamemode_DefragVQ3' }],
	[Gamemode.DEFRAG_VTG, { i18n: '#Gamemode_DefragVTG' }]
] as const;

// Just append to the existing data, shouldn't be using original version anywhere anyway.
for (const [gamemode, obj] of extraModeData) {
	Object.assign(GamemodeInfoWeb.get(gamemode), obj);
}

/** Miscellaneous gamemode info. Use this version, not the common/web/gamemodes.map.ts one!! */
export const GamemodeInfo = GamemodeInfoWeb as ReadonlyMap<Gamemode, GamemodeInfoProperties>;
