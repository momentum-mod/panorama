/**
 * JS classes and enums for handling leaderboards
 */

/**
 * Friendly JavaScript representation of a C++ Run object.
 * @property {number} mapID - ID of the map
 * @property {number} gamemode - GameMode for this leaderboard item
 * @property {number} trackType - Type of the track (main, stage, bonus)
 * @property {number} trackNum - ID of the track
 * @property {number} style - Style of the leaderboard item (normal, HSW, W-only, etc.)
 * @property {number} tier - Tier of the track
 * @property {string} tags - Tags used to filter this track
 * @property {boolean} ranked - Is this track ranked?
 * @property {boolean} linear - Is this track linear?
 */
class Leaderboard {
	/**
	 * @param {Object} leaderboardObject - JSON passed in from C++
	 */
	constructor(leaderboardObject) {
		this.mapID = leaderboardObject.mapID;
		this.gamemode = leaderboardObject.gamemode;
		this.trackType = leaderboardObject.trackType;
		this.trackNum = leaderboardObject.trackNum;
		this.style = leaderboardObject.style;
		this.tier = leaderboardObject.tier;
		this.tags = leaderboardObject.tags;
		this.ranked = leaderboardObject.ranked;
		this.linear = leaderboardObject.linear;
	}
}
