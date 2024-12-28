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

export interface RunSplits {
	trackStats: RunStats;
	segments: RunSegment[];
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

export interface RunStats {
	maxOverallSpeed: float;
	maxHorizontalSpeed: float;

	overallDistanceTravelled: float;
	horizontalDistanceTravelled: float;

	jumps: uint16;
	strafes: uint16;
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

export interface Comparison {
	baseRun: RunMetadata;
	comparisonRun: RunMetadata;
	diff: number;
	overallSplit: ComparisonSplit;
	segmentSplits: ComparisonSplit[];
}

export interface ComparisonSplit {
	name: string;
	accumulateTime: number;
	time: number;
	diff: number;
	delta: number;
	statsComparisons?: RunStatsComparison[];
}

export function generateComparison(baseRun: RunMetadata, comparisonRun: RunMetadata): Comparison {
	return {
		baseRun,
		comparisonRun,
		diff: baseRun.runTime - comparisonRun.runTime,
		overallSplit: generateOverallComparisonSplit(baseRun, comparisonRun),
		segmentSplits: generateComparisonSplits(baseRun.runSplits, comparisonRun.runSplits)
	};
}

// TODO: untested
export function generateOverallComparisonSplit(baseRun: RunMetadata, comparisonRun: RunMetadata): ComparisonSplit {
	return {
		name: 'Run_Comparison_Split_Overall',
		accumulateTime: baseRun.runTime,
		time: baseRun.runTime,
		diff: baseRun.runTime - comparisonRun.runTime,
		delta: 0,
		statsComparisons: generateStatsComparison(baseRun.runSplits.trackStats, comparisonRun.runSplits.trackStats)
	};
}

export function generateComparisonSplits(baseRunSplits: RunSplits, comparisonRunSplits: RunSplits): ComparisonSplit[] {
	return baseRunSplits.segments.map((_, i) =>
		// TODO: Generate subsegment splits
		generateSegmentComparisonSplit(baseRunSplits, comparisonRunSplits, i, 0)
	);
}

export function generateSegmentComparisonSplit(
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

export function generateFinishSplitComparison(
	baseRunTime: number,
	baseRunSplits: RunSplits,
	comparisonRunTime: number,
	comparisonRunSplits: RunSplits
): ComparisonSplit {
	const baseSplitTime = baseRunTime - baseRunSplits.segments.at(-1).subsegments.at(-1).timeReached;
	const comparisonSplitTime = comparisonRunTime - comparisonRunSplits.segments.at(-1).subsegments.at(-1).timeReached;

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

const RunStatsUnits: Record<keyof RunStats, string> = {
	maxOverallSpeed: 'ups',
	maxHorizontalSpeed: 'ups',

	overallDistanceTravelled: 'units',
	horizontalDistanceTravelled: 'units',

	jumps: 'jumps',
	strafes: 'strafes'
};

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
