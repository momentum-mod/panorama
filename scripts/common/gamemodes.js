const GameMode = {
	SURF: 1,
	BHOP: 2,
	CLIMB: 3,
	RJ: 4,
	SJ: 5,
	TRICKSURF: 6,
	AHOP: 7,
	PARKOUR: 8,
	CONC: 9,
	DEFRAG: 10
};

const GameModeWithNull = {
	UNKNOWN: 0,
	...GameMode
};

const GameModeInfo = {
	[GameMode.SURF]: {
		idName: 'Surf',
		name: '#Gamemode_Surf',
		shortName: '#Gamemode_Surf_Short',
		prefix: 'surf_'
	},
	[GameMode.BHOP]: {
		idName: 'Bhop',
		name: '#Gamemode_Bhop',
		shortName: '#Gamemode_Bhop_Short',
		prefix: 'bhop_'
	},
	[GameMode.CLIMB]: {
		idName: 'Climb',
		name: '#Gamemode_Climb',
		shortName: '#Gamemode_Climb_Short',
		prefix: 'climb_'
	},
	[GameMode.RJ]: {
		idName: 'RJ',
		name: '#Gamemode_RJ',
		shortName: '#Gamemode_RJ_Short',
		prefix: 'rj_'
	},
	[GameMode.SJ]: {
		idName: 'SJ',
		name: '#Gamemode_SJ',
		shortName: '#Gamemode_SJ_Short',
		prefix: 'sj_'
	},
	[GameMode.TRICKSURF]: {
		idName: 'Tricksurf',
		name: '#Gamemode_Tricksurf',
		shortName: '#Gamemode_Tricksurf_Short',
		prefix: 'tsurf_'
	},
	[GameMode.AHOP]: {
		idName: 'Ahop',
		name: '#Gamemode_Ahop',
		shortName: '#Gamemode_Ahop_Short',
		prefix: 'ahop_'
	},
	[GameMode.PARKOUR]: {
		idName: 'Parkour',
		name: '#Gamemode_Parkour',
		shortName: '#Gamemode_Parkour_Short',
		prefix: 'pk_'
	},
	[GameMode.CONC]: {
		idName: 'Conc',
		name: '#Gamemode_Conc',
		shortName: '#Gamemode_Conc_Short',
		prefix: 'conc_'
	},
	[GameMode.DEFRAG]: {
		idName: 'Defrag',
		name: '#Gamemode_Defrag',
		shortName: '#Gamemode_Defrag_Short',
		prefix: 'df_'
	}
};

const GameModeInfoWithNull = {
	[GameModeWithNull.UNKNOWN]: {
		idName: 'Unknown',
		name: '#Gamemode_Unknown',
		shortName: '#Gamemode_Unknown',
		prefix: ''
	},
	...GameModeInfo
};
