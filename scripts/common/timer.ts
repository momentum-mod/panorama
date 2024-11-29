type Gamemode = import('common/web').Gamemode;

/* eslint-disable @typescript-eslint/naming-convention */
export enum TimerEvent_OLD {
	STARTED = 0,
	FINISHED = 1,
	STOPPED = 2,
	FAILED = 3
}

export enum TimerState_OLD {
	NOT_RUNNING = 0,
	RUNNING = 1,
	PRACTICE = 2
}

export enum TimerState {
	DISABLED,
	PRIMED,
	RUNNING,
	FINISHED
}

export enum ZoneType {
	NONE = 0,

	/** When majorNum = 1, and minorNum = 1 */
	START = 1,

	END = 2,

	/** When majorNum > 1 and minorNum = 1 */
	MAJOR_CHECKPOINT = 3,

	/** All other timer segment zones */
	MINOR_CHECKPOINT = 4,

	CANCEL = 5
}

export interface TrackID {
	type: uint8;
	number: uint8;
}

export interface TimerStatus {
	trackId: TrackID;
	state: TimerState;
	runTime: float;
	runTimeTickstamp: int32;
	majorNum: uint8;
	minorNum: uint8;
	segmentsCount: uint8;
	segmentCheckpointsCount: uint8;
}

export interface RunStats {
	maxOverallSpeed: float;
	maxHorizontalSpeed: float;

	overallDistanceTravelled: float;
	horizontalDistanceTravelled: float;

	jumps: uint16;
	strafes: uint16;
}

export interface RunSegment {
	/** Contains an entry for every subsegment the player has reached so far */
	subsegments: RunSubsegment[];

	stats: RunStats;

	/** This is velocity when effectively starting this segment (when *leaving* the first zone) */
	effectiveStartVelocity: vec3;

	/**
	 * Whether this segment's checkpoints have a logical order. This lets split comparison logic know if apparent gaps
	 * are due to skipped checkpoints (align subsegments by minorNum) or are just unordered checkpoints (don't align).
	 */
	checkpointsOrdered: boolean;
}

/**
 * A subsegment begins at the checkpoint zone with the specified minorNum (which may be a Major Checkpoint zone,
 * possibly the overall track start) and ends when another checkpoint zone is activated (which may not be the next
 * in logical order if checkpoints can be skipped or done out of order).
 *
 * The very first subsegment of a run across all segments actually begins when the run starts and so will have
 * timeReached == 0.0. For all other subsegments, timeReached has a meaningful value. Also note that for subsegments
 * after the first overall, stat tracking includes time spent within its corresponding checkpoint zone.
 */
export interface RunSubsegment {
	minorNum: uint8;

	timeReached: float;

	/** Velocity when triggering this checkpoint; note the difference between this and Segment.effectiveStartVelocity */
	velocityWhenReached: vec3;

	stats: RunStats;
}

export interface RunSplits {
	trackStats: RunStats;
	segments: RunSegment[];
}

export function getSplitSegmentTime(runSplits: RunSplits, segmentIndex: number, subsegmentIndex: number): number {
	if (subsegmentIndex > 0) {
		return (
			runSplits.segments[segmentIndex].subsegments[subsegmentIndex].timeReached -
			runSplits.segments[segmentIndex].subsegments[subsegmentIndex - 1].timeReached
		);
	}

	if (segmentIndex > 0) {
		return (
			runSplits.segments[segmentIndex].subsegments[subsegmentIndex].timeReached -
			runSplits.segments[segmentIndex - 1].subsegments.at(-1).timeReached
		);
	}

	return 0;
}

export function getSegmentName(segmentIndex: number, subsegmentIndex: number): string {
	return subsegmentIndex >= 1 ? `${segmentIndex + 1}-${subsegmentIndex}` : segmentIndex.toString();
}

export interface RunMetadata {
	filePath: string;
	timestamp: number;
	gameMode: Gamemode;
	tickInterval: float;
	playerSteamId: number;
	playerName: string;
	trackId: TrackID;
	runTime: double;
	runSplits: RunSplits | null;
}

/** Enum for why end of run is being shown */
export enum EndOfRunShowReason {
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

export enum RunEntityType {
	PLAYER = 0,
	GHOST = 1,
	REPLAY = 2,
	ONLINE = 3
}

// ================================
// PRE 0.10.0 SHITE BELOW (KILL)
// ================================

export interface RunEntityData_OLD {
	isInZone: boolean;
	timerState: TimerState_OLD;
	timerString: TimerState_OLD;
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
export type RunStatsData_OLD = any;

/** Data structure passed from C++, would be nice to clean up in future */
export interface CPPRun_OLD {
	mapName: string;
	mapHash: string;
	playerName: string;
	steamID: steamID;
	date: string;
	tickInterval: number;
	runTime: number;
	startTick: number;
	endTime: number;
	runFlags: number;
	trackNum: number;
	zoneNum: number;
	stats: RunStatsData_OLD;
}

/** Friendly JavaScript representation of a C++ Run object. */
export class Run_OLD {
	mapName: string;
	mapHash: string;
	playerName: string;
	steamID: steamID;
	date: string;
	tickInterval: number;
	time: number;
	startTick: number;
	endTime: number;
	runFlags: number;
	trackNum: number;
	zoneNum: number;
	numZones: number;
	stats: RunStats_OLD;

	constructor(runObject: CPPRun_OLD) {
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

		this.stats = new RunStats_OLD(runObject.stats, this.tickInterval);
	}
}

export class RunStats_OLD {
	zones: Zone_OLD[];
	overallZone: Zone_OLD;

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

export interface Zone_OLD {
	name: string;
	accumulateTime: number;
	time: number;
	stats: RunStat[];
}

export class Comparison {
	baseRun: Run_OLD;
	comparisonRun: Run_OLD;
	diff: number;
	basePlayerName: string;
	comparisonPlayerName: string;
	splits: ComparisonSplit[];
	overallSplit: ComparisonSplit;

	constructor(baseRun: Run_OLD, comparisonRun: Run_OLD) {
		this.baseRun = baseRun;
		this.comparisonRun = comparisonRun;
		this.diff = this.baseRun.time - this.comparisonRun.time;
		this.basePlayerName = baseRun.playerName;
		this.comparisonPlayerName = comparisonRun.playerName;

		// TODO: Refactor when updating comparison menu
		//this.splits = Comparison.generateSplits(baseRun.stats, comparisonRun.stats);

		this.overallSplit = {
			// This gets used as a panel ID, so don't include the hash. $.Localize call works fine without it.
			name: 'Run_Comparison_Split_Overall',
			accumulateTime: baseRun.stats.overallZone.accumulateTime,
			time: baseRun.stats.overallZone.accumulateTime,
			diff: baseRun.stats.overallZone.accumulateTime - comparisonRun.stats.overallZone.accumulateTime,
			delta: baseRun.stats.overallZone.accumulateTime - comparisonRun.stats.overallZone.accumulateTime
			// statsComparisons: baseRun.stats.overallZone.stats.map(
			// 	(stat, j) => new RunStatsComparison(stat, comparisonRun.stats.overallZone.stats[j])
			// )
		};
	}

	static generateSplits(baseRunSplits: RunSplits, comparisonRunSplits: RunSplits): ComparisonSplit[] {
		return baseRunSplits.segments.map((_, i) => {
			// TODO: Generate subsegment splits
			return this.generateSegmentSplit(baseRunSplits, comparisonRunSplits, i, 0);
		});
	}

	static generateSegmentSplit(
		baseRunSplits: RunSplits,
		comparisonRunSplits: RunSplits,
		segmentIndex: number,
		subsegmentIndex: number
	): ComparisonSplit {
		const baseAccumulateTime = baseRunSplits.segments[segmentIndex].subsegments[subsegmentIndex].timeReached;
		const comparisonAccumulateTime =
			comparisonRunSplits.segments[segmentIndex].subsegments[subsegmentIndex].timeReached;
		const baseSplitTime = getSplitSegmentTime(baseRunSplits, segmentIndex, subsegmentIndex);
		const comparisonSplitTime = getSplitSegmentTime(comparisonRunSplits, segmentIndex, subsegmentIndex);

		return {
			name: getSegmentName(segmentIndex, subsegmentIndex),
			accumulateTime: baseAccumulateTime,
			time: baseSplitTime,
			diff: baseAccumulateTime - comparisonAccumulateTime,
			delta: baseSplitTime - comparisonSplitTime,
			statsComparisons: generateStatsComparison(
				baseRunSplits.segments[segmentIndex].subsegments[subsegmentIndex].stats,
				comparisonRunSplits.segments[segmentIndex].subsegments[subsegmentIndex].stats
			)
		};
	}

	static generateFinishSplit(
		baseRunTime: number,
		baseRunSplits: RunSplits,
		comparisonRunTime: number,
		comparisonRunSplits: RunSplits
	): ComparisonSplit {
		const baseSplitTime = baseRunTime - baseRunSplits.segments.at(-1).subsegments.at(-1).timeReached;
		const comparisonSplitTime =
			comparisonRunTime - comparisonRunSplits.segments.at(-1).subsegments.at(-1).timeReached;

		return {
			name: baseRunSplits.segments.length.toString(),
			accumulateTime: baseRunTime,
			time: baseSplitTime,
			diff: baseRunTime - comparisonRunTime,
			delta: baseSplitTime - comparisonSplitTime,
			statsComparisons: generateStatsComparison(
				baseRunSplits.segments.at(-1).subsegments.at(-1).stats,
				comparisonRunSplits.segments.at(-1).subsegments.at(-1).stats
			)
		};
	}
}

export interface ComparisonSplit {
	name: string;
	accumulateTime: number;
	time: number;
	diff: number;
	delta: number;
	statsComparisons?: RunStatsComparison[];
}

export interface RunStat {
	name: string;
	value: number;
	unit: string;
}

const RunStatsUnits: Record<keyof RunStats, string> = {
	maxOverallSpeed: 'ups',
	maxHorizontalSpeed: 'ups',

	overallDistanceTravelled: 'units',
	horizontalDistanceTravelled: 'units',

	jumps: 'jumps',
	strafes: 'strafes'
};

export interface RunStatsComparison {
	name: string;
	unit: string;
	baseValue: number;
	comparisonValue: number;
	diff: number;
}

export function generateStatsComparison(baseStats: RunStats, comparisonStat: RunStats): RunStatsComparison[] {
	return (Object.keys(baseStats) as Array<keyof RunStats>).map((key) => ({
		name: key,
		unit: RunStatsUnits[key],
		baseValue: baseStats[key],
		comparisonValue: comparisonStat[key],
		diff: baseStats[key] - comparisonStat[key]
	}));
}
