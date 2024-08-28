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

export function getMainTrack(mapData: MMap, gamemode: Gamemode): Leaderboard {
	return mapData.leaderboards.find(
		(leaderboard) =>
			leaderboard.gamemode === gamemode && leaderboard.trackType === TrackType.MAIN && leaderboard.style === 0
	);
}

export function getNumZones(mapData: MMap): number {
	return mapData.leaderboards.filter((leaderboard) => leaderboard.trackType === TrackType.STAGE).length;
}
