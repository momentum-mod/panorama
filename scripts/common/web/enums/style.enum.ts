import { Gamemode } from './gamemode.enum';

export enum Style {
	NORMAL = 0,
	HALF_SIDEWAYS = 1,
	REAL_HALF_SIDEWAYS = 2,
	SIDEWAYS = 3,
	W_ONLY = 4,
	AD_ONLY = 5,
	S_ONLY = 6,
	BACKWARDS = 7,
	TELEPORT = 8
}

const STYLE_NAMES: Record<Style, string> = {
	[Style.NORMAL]: 'Normal',
	[Style.HALF_SIDEWAYS]: 'Half-Sideways',
	[Style.REAL_HALF_SIDEWAYS]: 'Half-Sideways',
	[Style.SIDEWAYS]: 'Sideways',
	[Style.W_ONLY]: 'W-Only',
	[Style.AD_ONLY]: 'A/D-Only',
	[Style.S_ONLY]: 'S-Only',
	[Style.BACKWARDS]: 'Backwards',
	[Style.TELEPORT]: 'Teleport'
};

/** Get the English name of a style */
export function styleEnglishName(style: Style, gamemode: Gamemode): string {
	if (
		style === Style.NORMAL &&
		(gamemode === Gamemode.CLIMB_MOM || gamemode === Gamemode.CLIMB_KZT || gamemode === Gamemode.CLIMB_16)
	) {
		return 'Pro';
	}

	return STYLE_NAMES[style] ?? 'Unknown';
}

export const COMPATIBLE_STYLES: Record<Style, Style[]> = {
	[Style.NORMAL]: [Style.TELEPORT], // Pro runs are compatible with Teleport leaderboard
	[Style.HALF_SIDEWAYS]: [Style.NORMAL],
	[Style.REAL_HALF_SIDEWAYS]: [Style.NORMAL],
	[Style.SIDEWAYS]: [Style.NORMAL],
	[Style.W_ONLY]: [Style.NORMAL],
	[Style.AD_ONLY]: [Style.NORMAL],
	[Style.S_ONLY]: [Style.NORMAL],
	[Style.BACKWARDS]: [Style.NORMAL],
	[Style.TELEPORT]: []
};
