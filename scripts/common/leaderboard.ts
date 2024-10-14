import { CombinedMapStatuses, Gamemode, Leaderboard, MMap, TrackType } from './web';

export enum LeaderboardListType {
	LOCAL = 0,
	GLOBAL = 1,
	LOBBY = 2
}

export enum LeaderboardType {
	LOCAL = 0,
	LOCAL_DOWNLOADED = 1,
	TOP10 = 2,
	FRIENDS = 3,
	AROUND = 4,
	LOBBY = 5
}

export enum LeaderboardEntryType {
	INVALID = -1,
	LOCAL = 0,
	ONLINE = 1,
	ONLINE_CACHED = 2
}

export enum LeaderboardStatusType {
	TIMES_LOADED = 0,
	TIMES_LOADING = 1,
	NO_TIMES_RETURNED = 2,
	SERVER_ERROR = 3,
	NO_PB_SET = 4,
	NO_FRIENDS = 5,
	UNAUTHORIZED_FRIENDS_LIST = 6
}

function matchModeTypeAndStyle(lb: Leaderboard, gamemode: Gamemode, trackType: TrackType, style: number): boolean {
	return lb.gamemode === gamemode && lb.trackType === trackType && lb.style === 0;
}

export function getMainTrack(mapData: MMap, mode: Gamemode, style = 0): Leaderboard {
	return mapData.leaderboards.find((lb) => matchModeTypeAndStyle(lb, mode, TrackType.MAIN, style));
}

export function getStages(mapData: MMap, mode: Gamemode, style = 0): Leaderboard[] {
	return mapData.leaderboards.filter((lb) => matchModeTypeAndStyle(lb, mode, TrackType.STAGE, style));
}

export function getBonuses(mapData: MMap, mode: Gamemode, style = 0): Leaderboard[] {
	return mapData.leaderboards.filter((lb) => matchModeTypeAndStyle(lb, mode, TrackType.BONUS, style));
}

// export function getNumZones(mapData: MMap, mode: Gamemode): number {
// 	const stages = mapData.leaderboards.filter(
// 		({ trackType, gamemode, style }) => mode === gamemode && trackType === TrackType.STAGE && style === 0
// 	).length;
//
// 	if (stages > 0) {
// 		return stages;
// 	} else {
// 		return getMainTrack(mapData, mode) ? 1 : 0;
// 	}
// }
//
/**
 * Takes a panel and sets specific dialog variables and classes depending on its leaderboards,
 * such as whether to display tier, linear/staged etc.
 */
export function createLeaderboardSummaryPanel(panel: Panel, mapData: MMap, mode: Gamemode): void {
	if (!mapData) return;

	const mainTrack = getMainTrack(mapData, mode);
	if (mainTrack?.tier && !CombinedMapStatuses.IN_SUBMISSION.includes(mapData.status)) {
		panel.SetDialogVariableInt('tier', mainTrack.tier);
		panel.RemoveClass('lb-summary--tier-hidden');
	} else {
		panel.AddClass('lb-summary--tier-hidden');
	}

	if (mainTrack.linear === true) {
		panel.SetDialogVariable('linearity', $.Localize('#MapInfo_Type_Linear'));
		panel.RemoveClass('lb-summary--linearity--hidden');
	} else if (mainTrack.linear === false) {
		panel.SetDialogVariable('linearity', $.Localize('#MapInfo_Type_Staged'));
		panel.RemoveClass('lb-summary--linearity--hidden');
	} else {
		panel.AddClass('lb-summary--linearity--hidden');
	}

	if (mainTrack.linear === false) {
		panel.SetDialogVariableInt('stages', getStages(mapData, mode).length);
		panel.RemoveClass('lb-summary--stages-hidden');
	} else {
		panel.AddClass('lb-summary--stages-hidden');
	}

	const numBonuses = getBonuses(mapData, mode).length;
	if (numBonuses > 0) {
		panel.SetDialogVariableInt('bonuses', numBonuses);
		panel.RemoveClass('lb-summary--bonuses-hidden');
	} else {
		panel.AddClass('lb-summary--bonuses-hidden');
	}
}

export function getUserMapDataTrack(
	userMapData: MapCacheAPI.UserData,
	gamemode: Gamemode,
	trackType: TrackType = TrackType.MAIN,
	trackNum: number = 1,
	style: number = 0
): MapCacheAPI.UserTrackData | undefined {
	return userMapData?.tracks?.[(gamemode << 24) | (trackType << 16) | (trackNum << 8) | style];
}
