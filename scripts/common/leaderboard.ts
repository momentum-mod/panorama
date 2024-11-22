import { Gamemode, Leaderboard, MMap, TrackType } from './web';

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

export function getTrack(
	mapData: MMap,
	gamemode: Gamemode,
	trackType: TrackType = TrackType.MAIN,
	trackNum: number = 1,
	style: number = 0
): Leaderboard {
	return mapData.leaderboards.find(
		(leaderboard) =>
			leaderboard.gamemode === gamemode &&
			leaderboard.trackType === trackType &&
			leaderboard.trackNum === trackNum &&
			leaderboard.style === style
	);
}

function highestTrackNum(mapData: MMap, trackType: TrackType): number {
	return Math.max(
		...mapData.leaderboards
			.filter((leaderboard) => leaderboard.trackType === trackType)
			.map((leaderboard) => leaderboard.trackNum)
	);
}
export function getNumZones(mapData: MMap): number {
	return highestTrackNum(mapData, TrackType.STAGE) - 1;
}

export function getNumBonuses(mapData: MMap): number {
	return highestTrackNum(mapData, TrackType.BONUS) - 1;
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
