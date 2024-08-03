/** JS classes and enums for handling runs, comparisons, etc. */
namespace Run {
	export enum RunEntityType {
		PLAYER = 0,
		GHOST = 1,
		REPLAY = 2,
		ONLINE = 3
	}

	export interface RunEntityData {
		isInZone: boolean;
		timerState: Timer.TimerState;
		timerString: Timer.TimerState;
		strafeSync: float;
		strafeSync2: float;
		runFlags: uint32; // These are styles, not done yet.
		currentTrack: uint32;
		currentZone: uint32;
		startTick: uint32;
		tickRate: float;
		lastRunTime: uint32;
	}

	// Can't see where this is getting converted in C++, also this class this ridiculous and probably getting reworked,
	export type RunStatsData = any;

	/** Enum for why end of run is being shown */
	export enum EorShowReason {
		PLAYER_FINISHED_RUN = 0,
		REPLAY_FINISHED_RUN = 1,
		MANUALLY_SHOWN = 2
	}

	/** Enum for different run submission states */
	export enum RunStatusStates {
		PROGRESS = 0,
		SUCCESS = 1,
		ERROR = 2
	}

	/** Enum for types of submission status */
	export enum RunStatusTypes {
		PROGRESS = 0,
		UPLOAD = 1,
		SAVE = 2,
		ERROR = 3
	}

	/** Enum settings the icons for run statuses */
	export enum RunStatusIcons {
		PROGRESS = 'refresh',
		UPLOAD = 'cloud-upload',
		SAVE = 'content-save-check',
		ERROR = 'alert-octagon'
	}

	/** Data structure passed from C++, would be nice to clean up in future */
	export interface CPPRun {
		mapName: string;
		mapHash: string;
		playerName: string;
		steamID: string;
		date: string;
		tickInterval: number;
		runTime: number;
		startTick: number;
		endTime: number;
		runFlags: number;
		trackNum: number;
		zoneNum: number;
		stats: Run.RunStatsData;
	}
	
	
	/** Friendly JavaScript representation of a C++ Run object. */
	export class Run {
		mapName: string;
		mapHash: string;
		playerName: string;
		steamID: string;
		date: string;
		tickInterval: number;
		time: number;
		startTick: number;
		endTime: number;
		runFlags: number;
		trackNum: number;
		zoneNum: number;
		numZones: number;
		stats: RunStats;

		constructor(runObject: CPPRun) {
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

	export class RunStats {
		zones: Zone[];
		overallZone: Zone;

		/**
		 * @param runStatsObj - Ugly JSO from C++. Could perhaps create this better in C++ in future to avoid this.
		 * @param {number} tickInterval
		 * @param {number} limit - Limit to number of zones to process. -1 for all.
		 */
		constructor(
			runStatsObj: {
				numZones: number;
				statsObjects: Array<{ name: string; unit: string; values: number[] }>;
				times: { values: number[] };
			},
			tickInterval: number,
			limit: number = -1
		) {
			this.zones = [];
			// Start at 1 to skip overall zones
			for (let i = 1; i <= (limit === -1 ? runStatsObj.numZones : limit); i++) {
				const time = runStatsObj.times.values[i] * tickInterval;

				this.zones.push({
					name: i.toString(),
					accumulateTime: (i > 1 ? this.zones[i - 2].accumulateTime : 0) + time, // Offset index by extra -1, i tracks times.values so is +1 ahead
					time,
					stats: runStatsObj.statsObjects.map((stat) => ({
						name: stat.name,
						value: stat.values[i],
						unit: stat.unit
					}))
				});
			}

			this.overallZone = {
				name: 'Overall',
				accumulateTime: runStatsObj.times.values[0] * tickInterval,
				time: runStatsObj.times.values[0] * tickInterval,
				stats: runStatsObj.statsObjects.map((stat) => ({
					name: stat.name,
					value: stat.values[0],
					unit: stat.unit
				}))
			};
		}
	}

	export interface Zone {
		name: string;
		accumulateTime: number;
		time: number;
		stats: RunStat[];
	}

	export class Comparison {
		baseRun: Run;
		comparisonRun: Run;
		diff: number;
		basePlayerName: string;
		comparisonPlayerName: string;
		splits: Split[];
		overallSplit: Split;

		constructor(baseRun: Run, comparisonRun: Run) {
			this.baseRun = baseRun;
			this.comparisonRun = comparisonRun;
			this.diff = this.baseRun.time - this.comparisonRun.time;
			this.basePlayerName = baseRun.playerName;
			this.comparisonPlayerName = comparisonRun.playerName;

			this.splits = Comparison.generateSplits(baseRun.stats, comparisonRun.stats);

			this.overallSplit = {
				// This gets used as a panel ID, so don't include the hash. $.Localize call works fine without it.
				name: 'Run_Comparison_Split_Overall',
				accumulateTime: baseRun.stats.overallZone.accumulateTime,
				time: baseRun.stats.overallZone.accumulateTime,
				diff: baseRun.stats.overallZone.accumulateTime - comparisonRun.stats.overallZone.accumulateTime,
				delta: baseRun.stats.overallZone.accumulateTime - comparisonRun.stats.overallZone.accumulateTime,
				statsComparisons: baseRun.stats.overallZone.stats.map(
					(stat, j) => new RunStatsComparison(stat, comparisonRun.stats.overallZone.stats[j])
				)
			};
	}

		static generateSplits(baseRunStats: RunStats, comparisonRunStats: RunStats): Split[] {
			return baseRunStats.zones.map((baseZone, i) => {
				const compareZone = comparisonRunStats.zones[i];

				return {
					name: (i + 1).toString(),
					accumulateTime: baseZone.accumulateTime,
					time: baseZone.time,
					diff: baseZone.accumulateTime - compareZone.accumulateTime,
					delta: baseZone.time - compareZone.time,
					statsComparisons: baseZone.stats.map(
						(stat, j) => new RunStatsComparison(stat, compareZone.stats[j])
					)
				};
			});
		}
	}

	export interface Split {
		name: string;
		accumulateTime: number;
		time: number;
		diff: number;
		delta: number;
		statsComparisons: RunStatsComparison[];
	}

	export interface RunStat {
		name: string;
		value: number;
		unit: string;
	}

	export class RunStatsComparison {
		name: string;
		unit: string;
		baseValue: number;
		comparisonValue: number;
		diff: number;

		constructor(baseStat: RunStat, comparisonStat: RunStat) {
			this.name = baseStat.name;
			this.unit = baseStat.unit;
			this.baseValue = baseStat.value;
			this.comparisonValue = comparisonStat.value;
			this.diff = baseStat.value - comparisonStat.value;
		}
	}
}
