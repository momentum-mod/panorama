'use strict';

const GAMEMODE = {
	1: {
		name: 'Surf',
		shortName: 'Surf',
		prefix: 'surf_'
	},
	2: {
		name: 'Bhop',
		shortName: 'Bhop',
		prefix: 'bhop_'
	},
	3: {
		name: 'Climb',
		shortName: 'Climb',
		prefix: 'climb_'
	},
	4: {
		name: 'Rocket Jump',
		shortName: 'RJ',
		prefix: 'rj_'
	},
	5: {
		name: 'Sticky Jump',
		shortName: 'SJ',
		prefix: 'sj_'
	},
	6: {
		name: 'Tricksurf',
		shortName: 'Tricksurf',
		prefix: 'tsurf_'
	},
	7: {
		name: 'Accelerated Hop',
		shortName: 'Ahop',
		prefix: 'ahop_'
	},
	8: {
		name: 'Parkour',
		shortName: 'Parkour',
		prefix: 'pk_'
	},
	9: {
		name: 'Conc',
		shortName: 'Conc',
		prefix: 'conc_'
	},
	10: {
		name: 'Defrag',
		shortName: 'Defrag',
		prefix: 'df_'
	}
};

const GAMEMODE_WITH_NULL = {
	0: {
		name: 'Unknown',
		shortName: 'Unknown',
		prefix: ''
	},
	...GAMEMODE
};
