import type { Leaderboard, MMap } from './web/types/models/models';
import { TrackType } from './web/enums/track-type.enum';
import { Style } from './web/enums/style.enum';
import { GamemodeDefaultUIStyle } from './web/maps/gamemode-styles.map';

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

/**
 * Source/filter for the paginated records API (`Leaderboards.getLeaderboardRecords`).
 * Mirrors the engine's `LeaderboardRecordsFilter_t`.
 */
export enum LeaderboardRecordsFilter {
	GLOBAL = 0,
	FRIENDS = 1,
	LOBBY = 2,
	SAVED_REPLAYS = 3,
	AROUND = 4
}

/** Records are always fetched in fixed-size pages. Mirrors the engine's `LEADERBOARD_RECORDS_PER_PAGE`. */
export const LEADERBOARD_RECORDS_PER_PAGE = 20;

/**
 * A single leaderboard record row, as returned by `Leaderboards.getLoadedLeaderboardRecords`.
 * Mirrors the engine's `LeaderboardTime` JS shape.
 */
export interface LeaderboardRecord {
	rank: int32;
	playerName: string;
	steamID: string;
	runTime: float;
	/** Run date as a Unix timestamp (seconds); a uint64 marshalled to a JS string. */
	date: uint64_str;
	trackId: int32;
	style: Style;
	replayHash: string;
	fileURL: string;
	userRoles: int32;
	userBans: int32;
}

/** A loaded page of leaderboard records, as returned by `Leaderboards.getLoadedLeaderboardRecords`. */
export interface LoadedLeaderboardRecords {
	requestToken: int32;
	filter: LeaderboardRecordsFilter;
	/**
	 * The 0-based page of the result. For {@link LeaderboardRecordsFilter.AROUND} this is the page
	 * the engine resolved to (the one containing the local user's PB), not the page that was requested.
	 */
	page: int32;
	totalPages: int32;
	status: LeaderboardStatusType;
	records: LeaderboardRecord[];
}

export function getTrack(
	mapData: MMap,
	gamemode: Gamemode,
	trackType: TrackType = TrackType.MAIN,
	trackNum: number = 1,
	style?: Style
): Leaderboard | undefined {
	if (style === undefined) {
		style = GamemodeDefaultUIStyle.get(gamemode);
	}

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
export function getNumStages(mapData: MMap): number {
	return highestTrackNum(mapData, TrackType.STAGE);
}

export function getNumBonuses(mapData: MMap): number {
	return highestTrackNum(mapData, TrackType.BONUS);
}

export function getUserMapDataTrack(
	userMapData: MapCacheAPI.UserData | undefined,
	gamemode: Gamemode,
	trackType: TrackType = TrackType.MAIN,
	trackNum: number = 1,
	style: number = 0
): MapCacheAPI.UserTrackData | undefined {
	return userMapData?.tracks?.[(gamemode << 24) | (trackType << 16) | (trackNum << 8) | style];
}

export function sortLeaderboard(
	left: { trackNum: number; trackType: TrackType },
	right: { trackNum: number; trackType: TrackType }
): number {
	return left.trackType === right.trackType ? left.trackNum - right.trackNum : left.trackType - right.trackType;
}
