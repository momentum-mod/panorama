/**
 * Enum for track types
 * @enum {number}
 */
const TrackType = {
	MAIN: 0,
	STAGE: 1,
	BONUS: 2
};

/**
 * Enum for map credits
 * @enum {number}
 */
const MapCreditType = {
	UNKNOWN: -1,
	AUTHOR: 0,
	CONTRIBUTOR: 1,
	TESTER: 2,
	SPECIAL_THANKS: 3
};

function GetMainTrack(mapData, gamemode) {
	return mapData.leaderboards.find(
		(leaderboard) =>
			leaderboard.gamemode === gamemode && leaderboard.trackType === TrackType.MAIN && leaderboard.style === 0
	);
}

function GetNumZones(mapData) {
	return mapData.leaderboards.filter((leaderboard) => leaderboard.trackType === TrackType.STAGE).length;
}
