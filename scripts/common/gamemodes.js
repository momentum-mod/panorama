'use strict';

const GAMEMODE = {
	1: {
		name: '#Gamemode_Surf',
		shortName: '#Gamemode_Surf_Short',
		prefix: 'surf_'
	},
	2: {
		name: '#Gamemode_Bhop',
		shortName: '#Gamemode_Bhop_Short',
		prefix: 'bhop_'
	},
	3: {
		name: '#Gamemode_Climb',
		shortName: '#Gamemode_Climb_Short',
		prefix: 'climb_'
	},
	4: {
		name: '#Gamemode_RJ',
		shortName: '#Gamemode_RJ_Short',
		prefix: 'rj_'
	},
	5: {
		name: '#Gamemode_SJ',
		shortName: '#Gamemode_SJ_Short',
		prefix: 'sj_'
	},
	6: {
		name: '#Gamemode_Tricksurf',
		shortName: '#Gamemode_Tricksurf_Short',
		prefix: 'tsurf_'
	},
	7: {
		name: '#Gamemode_Ahop',
		shortName: '#Gamemode_Ahop_Short',
		prefix: 'ahop_'
	},
	8: {
		name: '#Gamemode_Parkour',
		shortName: '#Gamemode_Parkour_Short',
		prefix: 'pk_'
	},
	9: {
		name: '#Gamemode_Conc',
		shortName: '#Gamemode_Conc_Short',
		prefix: 'conc_'
	},
	10: {
		name: '#Gamemode_Defrag',
		shortName: '#Gamemode_Defrag_Short',
		prefix: 'df_'
	}
};

const GAMEMODE_WITH_NULL = {
	0: {
		name: '#Gamemode_Unknown',
		shortName: '#Unknown',
		prefix: ''
	},
	...GAMEMODE
};
