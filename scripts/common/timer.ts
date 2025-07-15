type Gamemode = import('common/web').Gamemode;

//#region Types

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
	tempId: number;
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
	/**
	 * Note that minorNum is defined on RunSubsegment, but there's no majorNum on RunSegment.
	 *
	 * This is by design and very important to understanding the data structure:
	 * - Segments are always ordered and required, so majorNum is always equal to segments.indexOf(segment) + 1.
	 * - Subsegments aren't necessarily either ordered or required, therefore subsegment indices don't reliably map to
	 *   minorNum.
	 *
	 *  So for a given majorNum min and minorNum maj, the correct way to find a subsegment is
	 *  ```ts
	 *  segments[maj - 1].subsegments.find(subseg => subseg.minorNum === min)
	 *  ```
	 *  whilst you should never use
	 *  ```ts
	 *  segments[maj - 1].subsegments[min - 1];
	 *  ```
	 */
	minorNum: uint8;

	timeReached: float;

	/** Velocity when triggering this checkpoint; note the difference between this and Segment.effectiveStartVelocity */
	velocityWhenReached: vec3;

	stats: RunStats;
}

export interface RunStats {
	maxOverallSpeed: float;
	maxHorizontalSpeed: float;

	overallDistanceTravelled: float;
	horizontalDistanceTravelled: float;

	jumps: uint16;
	strafes: uint16;
}

export type RunStatType = keyof RunStats;

export const RunStatsProperties: Record<RunStatType, { unit: string; isPositiveGood: boolean }> = {
	maxOverallSpeed: {
		unit: 'ups',
		isPositiveGood: true
	},
	maxHorizontalSpeed: {
		unit: 'ups',
		isPositiveGood: true
	},
	overallDistanceTravelled: {
		unit: 'units',
		isPositiveGood: false
	},
	horizontalDistanceTravelled: {
		unit: 'units',
		isPositiveGood: false
	},
	jumps: {
		unit: 'jumps',
		isPositiveGood: false
	},
	strafes: {
		unit: 'strafes',
		isPositiveGood: false
	}
};

//#endregion
//#region Utility Functions

/**
 * For a given base and comparison splits, finds the split in base splits for a given majorNum and minorNum, then
 * picks the appropriate split in the comparison splits, accounting for missing and unordered checkpoints.
 */
export function findSubsegmentComparison(
	baseSplits: RunSplits,
	compSplits: RunSplits | null,
	majorNum: number,
	minorNum: number
): [RunSubsegment, RunSubsegment | null] {
	const baseSeg = baseSplits.segments[majorNum - 1];
	const baseSubsegIdx = baseSeg.subsegments.findIndex((ss) => ss.minorNum === minorNum);

	// If this happens, something's gone wrong in the caller logic.
	if (baseSubsegIdx === -1) {
		throw new Error(`Missing subsegment for majorNum: ${majorNum}, minorNum: ${minorNum}`);
	}

	if (!compSplits) {
		return [baseSeg.subsegments[baseSubsegIdx], null];
	}

	const compSeg = compSplits.segments[majorNum - 1];
	// Rare case when zones differ, could be undefined.
	if (!compSeg) {
		return [baseSeg.subsegments[baseSubsegIdx], null];
	}

	const compSubsegIdx = compSeg.subsegments.findIndex((ss) => ss.minorNum === minorNum);

	// Easy case, base and comp are at same position in splits: return respective subsegs
	//   Base ----S1---Cp1-----Cp2----
	//   Comp ---S1----Cp1----Cp2-----
	if (baseSubsegIdx === compSubsegIdx) {
		return [baseSeg.subsegments[baseSubsegIdx], compSeg.subsegments[compSubsegIdx]];
	}

	// Indices don't match, but checkpoints are ordered, so comp missed this checkpoint: return comp undefined
	//   Base ----S1---Cp1-----Cp2----
	//   Comp ---S1-----------Cp2-----
	if (baseSeg.checkpointsOrdered) {
		return [baseSeg.subsegments[baseSubsegIdx], null];
	}

	// Indices don't match, checkpoints *aren't* ordered: return the comp at same index as base, if exists
	//   Base ----S1---Cp1-----Cp1----
	//   Comp ---S1-----Cp2----Cp2----
	// This won't always be useful information, but at best it'll be like comparing "collectible" count,
	// e.g. how fast did they get their 2nd collectible, 3rd collectible, etc...
	return [baseSeg.subsegments[baseSubsegIdx], compSeg.subsegments[baseSubsegIdx] ?? null];
}

/**
 * Try to find the index of a subsegment hit previously in the given splits, taking unordered and missing checkpoints into
 * account, returning last subsegment index in the previous segment if a starting subsegment is provided.
 * @returns Tuple of [majorNum, minorNum]
 */
export function findPreviousSubsegment(splits: RunSplits, majorNum: number, minorNum: number): [number, number] {
	if (minorNum === 1) {
		if (majorNum === 1) {
			// If we're at the very start of the run, there is no previous subsegment
			return [0, 0];
		}

		// If minorNum == 1 we're in a starting segment, so the previous subsegment is always the last subsegment in the
		// last segment's subsegments. Segments are never optional, and must have had a start segment so both index
		// accesses must be valid.

		if (!splits.segments[majorNum - 2].subsegments) {
			// Subsegments are omitted for segments before the most recent LIMITED_DATA_MAX_SUBSEGMENTS segments, so
			// trying to access here would throw. If this happens, return 0, 0 so comparisons can treat as having no
			// previous subsegment.
			$.Warning(
				`Timer.findPreviousSubsegment: Previous segment ${majorNum - 2} has no subsegments, don't try to access past LIMITED_DATA_MAX_SUBSEGMENTS!`
			);
			return [0, 0];
		}

		return [majorNum - 1, splits.segments[majorNum - 2].subsegments.length];
	}

	const segment = splits.segments[majorNum - 1];

	// Find last subsegment in subsegments, i.e. in chronological order -- for unordered/missing subsegments this
	// could be < minorNum - 1
	const subsegment = segment.subsegments[segment.subsegments.findIndex((ss) => ss.minorNum === minorNum) - 1];

	// Weird if this happens, our JS is probably bad!
	if (!subsegment) {
		throw new Error(`Missing subsegment for majorNum: ${majorNum}, minorNum: ${minorNum}`);
	}

	return [majorNum, subsegment.minorNum];
}

/**
 * Picks an appropriate name for a split based on the splits data and the current majorNum and minorNum.
 * For tracks with both multiple segments and subsegments, returns string in "X-Y" form, otherwise just "X".
 */
export function getSplitName(
	splits: RunSplits,
	majorNum: number,
	minorNum: number,
	segmentsCount: number,
	segmentsCheckpointsCount: number
): string {
	if (majorNum === 1 && minorNum === 1) return '';

	// Single segment run (e.g. linear surf map): previous minorNum
	// Note that splits.segments.length is viable here since only contains splits hit so far.
	if (segmentsCount === 1) {
		const [, prevMin] = findPreviousSubsegment(splits, majorNum, minorNum);
		return prevMin.toString();
	}

	// Multiple segments, multiple subsegments
	// (e.g. RJ map with courses): "X-Y" for previous majorNum, previous minorNum
	if (segmentsCheckpointsCount > 1) {
		// For these zones, we want:
		//  S1----CP1----CP2----S2----CP1----CP2----END
		// (n/a)  1-1    1-2    1-3   2-1    2-2    2-3
		// So:
		// Maj 1, Min 1 => N/A      Maj 1, Min 2 => 1-1      Maj 1, Min 3 => 1-2
		// Maj 2, Min 1 => 1-3      Maj 2, Min 2 => 2-1      Maj 2, Min 3 => 2-2
		// END => 2-3
		const [prevMaj, prevMin] = findPreviousSubsegment(splits, majorNum, minorNum);
		return `${prevMaj}-${prevMin}`;
	}

	// Multiple segments, all with single subsegments (e.g. staged surf map): previous majorNum
	return (majorNum - 1).toString();
}

//#endregion
//#region Splits Generation

export interface Split {
	/** Use majorNum = 0 and minorNum = 0 for "Overall" */
	majorNum: number;
	minorNum: number;

	/**
	 * This will be the name of the *previous* subsegment,
	 * e.g. if you hit S1 CP2 => 1-1, S2 CP1 => 1-2
	 */
	name: string;

	/** Total duration until now **/
	time: number;

	/** Duration of this individual segment */
	segmentTime: number;

	/** False if comparison run has missing segment for given majorNum and minorNum  */
	hasComparison: boolean;

	/** Base time - comp time */
	diff?: number;

	/** Base segment time - comp segment time */
	delta?: number;

	segmentsCount: number;

	segmentCheckpointsCount: number;

	statsComparisons?: Record<RunStatType, RunStatsComparison>;
}

export interface RunStatsComparison {
	name: RunStatType;
	unit: string;
	baseValue: number;
	comparisonValue: number;
	diff: number;
	isPositiveGood: boolean;
}

/**
 * Generate a "Split" object for a given majorNum and minorNum. If non-null comparison is given, generates diff, delta,
 * optionally stats.
 * @param baseSplits - The splits to use as the base for the comparison
 * @param compSplits - The splits to use as the comparison. If not given, no comparison will be made
 * @param majorNum - majorNum of the base split.
 * @param minorNum - minorNum of the base split. Don't use a subsegment index here! (See RunSegment.minorNum docs)
 * @param segmentsCount - The number of segments in the entire run (not just the splits so far).
 * 						  Needed to determine split name.
 * @param segmentCheckpointsCount - The number of checkpoints in the current segment (not just the splits so far).
 * 						 			Needed to determine split name.
 * @param fround - Whether to use Math.fround before calculating delta/delta. If either baseSplits or compSplits could
 * 				   be from a networked timer, this should be true.
 * @param generateStats - Whether to generate stats for the split. If true, statsComparisons will be populated.
 *                        Networked data does not contain these stats!
 */
export function generateSplit(
	baseSplits: RunSplits,
	compSplits: RunSplits | null,
	majorNum: number,
	minorNum: number,
	segmentsCount: number,
	segmentCheckpointsCount: number,
	fround: boolean,
	generateStats = false
): Split {
	const [base, comp] = findSubsegmentComparison(baseSplits, compSplits, majorNum, minorNum) ?? [];

	if (!base) {
		throw new Error(`Missing base subsegment for majorNum: ${majorNum}, minorNum: ${minorNum}`);
	}

	const name = getSplitName(baseSplits, majorNum, minorNum, segmentsCount, segmentCheckpointsCount);
	const [prevMaj, prevMin] = findPreviousSubsegment(baseSplits, majorNum, minorNum);

	const split: Split = {
		name,
		majorNum,
		minorNum,
		segmentsCount,
		segmentCheckpointsCount,
		segmentTime: 0,
		time: 0,
		diff: 0,
		delta: 0,
		hasComparison: false
	};

	// If we're at the very start of the run, there is no previous subsegment
	if (prevMaj === 0 && prevMin === 0) return split;

	const [prevBase, prevComp] = findSubsegmentComparison(baseSplits, compSplits, prevMaj, prevMin) ?? [];

	split.time = base.timeReached;
	split.segmentTime = computeDiff(base.timeReached, prevBase.timeReached, fround);

	if (!comp) return split;

	split.diff = computeDiff(base.timeReached, comp.timeReached, fround);
	split.hasComparison = true;

	if (!prevComp) return split;

	split.delta = computeDiff(split.segmentTime, computeDiff(comp.timeReached, prevComp.timeReached, fround), fround);

	if (!generateStats) return split;

	split.statsComparisons = generateStatsComparison(base.stats, comp.stats);
	return split;
}

export function generateFinishSplit(
	baseSplits: RunSplits,
	compSplits: RunSplits | null,
	baseRunTime: number,
	compRunTime: number,
	segmentsCount: number,
	segmentCheckpointsCount: number,
	generateStats = false,
	fround = false
): Split {
	const prevBase = baseSplits.segments.at(-1)?.subsegments?.at(-1);
	if (!prevBase) throw new Error('Base run has no subsegments somehow');

	const split: Split = {
		name: getSplitName(baseSplits, segmentsCount + 1, 1, segmentsCount, segmentCheckpointsCount),
		majorNum: segmentsCount + 1,
		minorNum: 1,
		segmentsCount,
		segmentCheckpointsCount,
		time: baseRunTime,
		segmentTime: computeDiff(baseRunTime, prevBase.timeReached, fround),
		hasComparison: false
	};

	if (!compSplits || compSplits.segments.length === 0) return split;

	const prevComp = compSplits.segments.at(-1)?.subsegments?.at(-1);
	if (!prevComp) throw new Error('Comparison run has no subsegments somehow');

	split.hasComparison = true;
	split.diff = computeDiff(baseRunTime, compRunTime, fround);
	split.delta = computeDiff(split.segmentTime, computeDiff(compRunTime, prevComp.timeReached, fround), fround);

	if (generateStats) {
		split.statsComparisons = generateStatsComparison(baseSplits.trackStats, compSplits.trackStats);
	}

	return split;
}

/**
 * Take the difference of two doubles, optionally using Math.fround to ensure the result is a float.
 *
 * Timer networking uses 32-bit floats, replays use 64-bit, so use rounding for values that might
 * come from networked timer, e.g. HUD comparisons.
 */
export function computeDiff(base: double, comp: double, fround: boolean): double | float {
	return fround ? Math.fround(base) - Math.fround(comp) : base - comp;
}

export function generateStatsComparison(
	baseStats: RunStats,
	comparisonStat: RunStats,
	fround = false
): Record<RunStatType, RunStatsComparison> {
	return Object.fromEntries(
		Object.keys(baseStats).map((key) => [
			key,
			{
				name: key,
				unit: RunStatsProperties[key].unit,
				isPositiveGood: RunStatsProperties[key].isPositiveGood,
				baseValue: baseStats[key],
				comparisonValue: comparisonStat[key],
				diff: computeDiff(baseStats[key], comparisonStat[key], fround)
			}
		])
	) as Record<RunStatType, RunStatsComparison>;
}

export interface Comparison {
	baseRun: RunMetadata;
	comparisonRun: RunMetadata;
	diff: number;
	overallSplit: Split;
	segmentSplits: Split[][];
}

export function generateComparison(baseRun: RunMetadata, comparisonRun: RunMetadata): Comparison {
	return {
		baseRun,
		comparisonRun,
		diff: computeDiff(baseRun.runTime, comparisonRun.runTime, false),
		overallSplit: generateOverallComparisonSplit(baseRun, comparisonRun),
		segmentSplits: generateComparisonSplits(baseRun, comparisonRun)
	};
}

const OverallSplitName = $.Localize('#Run_Comparison_Split_Overall');

export function generateOverallComparisonSplit(baseRun: RunMetadata, comparisonRun: RunMetadata): Split {
	return {
		name: OverallSplitName,
		majorNum: 0,
		minorNum: 0,
		segmentsCount: 0,
		segmentCheckpointsCount: 0,
		time: baseRun.runTime,
		segmentTime: baseRun.runTime,
		hasComparison: true,
		diff: computeDiff(baseRun.runTime, comparisonRun.runTime, false),
		delta: 0,
		statsComparisons: generateStatsComparison(baseRun.runSplits!.trackStats, comparisonRun.runSplits!.trackStats)
	};
}

export function generateComparisonSplits(baseRun: RunMetadata, comparisonRun: RunMetadata): Split[][] {
	if (!baseRun.runSplits || !comparisonRun.runSplits) return [[]];
	const baseSplits = baseRun.runSplits;

	// Note that we're deliberately leaving in the 1-1 start split here. It should never be shown
	// in comparison or end-of-run splits, but needed for the line graph to work correctly.
	const segmentsCount = baseSplits.segments.length;
	const comparisonSplits = baseSplits.segments.map((segment, i) =>
		segment.subsegments.map((subsegment) =>
			generateSplit(
				baseSplits!,
				comparisonRun.runSplits,
				i + 1,
				subsegment.minorNum,
				segmentsCount,
				segment.subsegments.length,
				false, // Function takes a RunMetadata which is only available for a completed run, not need to fround
				true
			)
		)
	);

	comparisonSplits.push([
		generateFinishSplit(
			baseSplits,
			comparisonRun.runSplits,
			baseRun.runTime,
			comparisonRun.runTime,
			segmentsCount,
			baseSplits.segments.at(-1)!.subsegments.length,
			true
		)
	]);

	return comparisonSplits;
}

//#endregion
//#region End of Run / Run Submission

/** Enum for why end of run is being shown */
export enum EndOfRunShowReason {
	PLAYER_FINISHED_RUN = 0,
	MANUALLY_SHOWN = 1
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

// #endregion
