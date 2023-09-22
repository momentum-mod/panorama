/**
 * JS classes and enums for handling runs, comparisons, etc.
 */

/**
 * Enum for why end of run is being shown
 * @enum {number}
 */
const EorShowReason = {
	PLAYER_FINISHED_RUN: 0,
	REPLAY_FINISHED_RUN: 1,
	MANUALLY_SHOWN: 2
};

/**
 * Enum for different run submission states
 * @enum {number}
 */
const RunStatusStates = {
	PROGRESS: 0,
	SUCCESS: 1,
	ERROR: 2
};

/**
 * Enum for types of submission status
 * @enum {number}
 */
const RunStatusTypes = {
	PROGRESS: 0,
	UPLOAD: 1,
	SAVE: 2,
	ERROR: 3
};

/**
 * Enum settings the icons for run statuses
 * @enum {string}
 */
const RunStatusIcons = {
	PROGRESS: 'refresh',
	UPLOAD: 'cloud-upload',
	SAVE: 'content-save-check',
	ERROR: 'alert-octagon'
};

/**
 * Friendly JavaScript representation of a C++ Run object.
 * @property {string} mapName - Name of the map
 * @property {string} mapHash - Alphanumeric hash unique to the map
 * @property {string} playerName - Steam name of the local player
 * @property {string} date - Date the run was submitted
 * @property {number} Tick interval - Number of ticks per second (reciprocal of the tickrate)
 * @property {number} time - The total time of the run
 * @property {number} startTick - The tick the run started on
 * @property {number} endTick - The tick the run ended on
 * @property {number} runFlags - Not sure. We should probably make an enum for this circa 0.10.0
 * @property {number} trackNum
 * @property {number} zoneNum - The tick the run ended on
 * @property {Object} stats - See RunStats below
 */
class Run {
	/**
	 * @param {Object} runObject - JSON passed in from C++
	 */
	constructor(runObject) {
		this.mapName = runObject.mapName;
		this.mapHash = runObject.mapHash;
		this.playerName = runObject.playerName;
		this.steamID = runObject.steamID;
		this.date = runObject.date;
		this.tickInterval = runObject.tickInterval;
		this.time = runObject.runTime;
		this.startTick = runObject.startTick;
		this.endTime = runObject.endTime;
		this.runFlags = runObject.runFlags;
		this.trackNum = runObject.trackNum;
		this.zoneNum = runObject.zoneNum;
		this.numZones = runObject.stats.numZones;

		this.stats = new RunStats(runObject.stats, this.tickInterval);
	}
}

/**
 * This is the meaty part of the run data.
 * @property {Zone[]} zones
 * @property {Zone} overallZone
 */
class RunStats {
	/**
	 * @param {Object} runStatsObject - JSON from C++. A "numZones" number, and an array of
	 * 		"statsObjects", which is a name string, unit string, and
	 * 		an array of numbers consisting of the total, then all the stages, then a null.
	 * @param {number} tickInterval
	 * @param {number} limit - Limit to number of zones to process. -1 for all.
	 */
	constructor(runStatsObj, tickInterval, limit = -1) {
		this.zones = [];
		// Start at 1 to skip overall zones
		for (let i = 1; i <= (limit === -1 ? runStatsObj.numZones : limit); i++) {
			const time = runStatsObj.times.values[i] * tickInterval;

			this.zones.push(
				new Zone(
					i,
					(i > 1 ? this.zones[i - 2].accumulateTime : 0) + time, // Offset index by extra -1, i tracks times.values so is +1 ahead
					time,
					runStatsObj.statsObjects.map((stat) => new RunStat(stat.name, stat.values[i], stat.unit))
				)
			);
		}

		this.overallZone = new Zone(
			'Overall',
			runStatsObj.times.values[0] * tickInterval,
			runStatsObj.times.values[0] * tickInterval,
			runStatsObj.statsObjects.map((stat) => new RunStat(stat.name, stat.values[0], stat.unit))
		);
	}
}

class Zone {
	/**
	 * @param {string} name
	 * @param {number} accumulateTime
	 * @param {number} time
	 * @param {RunStats[]} stats
	 */
	constructor(name, accumulateTime, time, stats) {
		this.name = name;
		this.accumulateTime = accumulateTime;
		this.time = time;
		this.stats = stats;
	}
}

/**
 * @property {Run} baseRun
 * @property {Run} comparisonRun
 * @property {number} diff
 * @property {string} basePlayerName
 * @property {string} comparisonPlayerName
 * @property {Split[]} comparisonPlayerName
 */
class Comparison {
	/**
	 * @param {Run} baseRun
	 * @param {Run} comparisonRun
	 * */
	constructor(baseRun, comparisonRun) {
		this.baseRun = baseRun;
		this.comparisonRun = comparisonRun;
		this.diff = this.baseRun.time - this.comparisonRun.time;
		this.basePlayerName = baseRun.playerName;
		this.comparisonPlayerName = comparisonRun.playerName;

		this.splits = Comparison.generateSplits(baseRun.stats, comparisonRun.stats);

		this.overallSplit = new Split(
			// This gets used as a panel ID, so don't include the hash. $.Localize call works fine without it.
			'Run_Comparison_Split_Overall',
			baseRun.stats.overallZone.accumulateTime,
			baseRun.stats.overallZone.accumulateTime,
			baseRun.stats.overallZone.accumulateTime - comparisonRun.stats.overallZone.accumulateTime,
			baseRun.stats.overallZone.accumulateTime - comparisonRun.stats.overallZone.accumulateTime,
			baseRun.stats.overallZone.stats.map(
				(stat, j) => new RunStatsComparison(stat, comparisonRun.stats.overallZone.stats[j])
			)
		);
	}

	/**
	 * @param {RunStats} baseRunStats
	 * @param {RunStats} comparisonRunStats
	 * @returns {Split[]}
	 */
	static generateSplits(baseRunStats, comparisonRunStats) {
		return baseRunStats.zones.map((baseZone, i) => {
			const compareZone = comparisonRunStats.zones[i];

			return new Split(
				i + 1,
				baseZone.accumulateTime,
				baseZone.time,
				baseZone.accumulateTime - compareZone.accumulateTime,
				baseZone.time - compareZone.time,
				baseZone.stats.map((stat, j) => new RunStatsComparison(stat, compareZone.stats[j]))
			);
		});
	}
}

class Split {
	/**
	 * @param {string} name - Name of split, usually an int or "overall"
	 * @param {number} accumulateTime - Total time into the run
	 * @param {number} time - Time of current split
	 * @param {number} diff - Time difference vs comparison
	 * @param {number} delta - Change in difference between previous split and current
	 * @param {RunStatsComparison[]} statsComparisons - Arrays of RunStatsComparisons
	 * */
	constructor(name, accumulateTime, time, diff, delta, statsComparisons) {
		this.name = name;
		this.accumulateTime = accumulateTime;
		this.time = time;
		this.diff = diff;
		this.delta = delta;
		this.statsComparisons = statsComparisons;
	}
}

class RunStat {
	/**
	 * @param {string} name
	 * @param {number} value
	 * @param {string} unit
	 */
	constructor(name, value, unit) {
		this.name = name;
		this.value = value;
		this.unit = unit;
	}
}

class RunStatsComparison {
	/**
	 *
	 * @param {*} baseStat
	 * @param {*} comparisonStat
	 */
	constructor(baseStat, comparisonStat) {
		this.name = baseStat.name;
		this.unit = baseStat.unit;
		this.baseValue = baseStat.value;
		this.comparisonValue = comparisonStat.value;
		this.diff = baseStat.value - comparisonStat.value;
	}
}
