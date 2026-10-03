import { CompletionGroup } from './web/enums/completion-group.enum';

/**
 * Group-classification parameters, kept identical to the backend's
 * `RANK_XP_PARAMS.groups` (libs/xp-systems/src/constants.ts in the website repo).
 * Only the group *number* depends on these; the group point/XP values don't
 * affect classification, so they're omitted.
 *
 * These aren't synced from the website (fetch-web only syncs libs/constants), so
 * if the backend values change, update them here to match.
 */
const GROUP_PARAMS = {
	maxGroups: 4,
	scaleFactors: [1, 1.5, 2, 2.5],
	exponents: [0.5, 0.56, 0.62, 0.68],
	minSizes: [10, 45, 125, 250]
} as const;

/**
 * Record of last rank for each group eg. groupBoundaries[10] = CompletionGroup.TOP_10
 */
export type GroupBoundaries = Record<number, CompletionGroup>;

/**
 * Returns {@link GroupBoundaries} based on total completions
 * Calculations based on the backend
 */
export function getGroupBoundaries(totalCompletions: number): GroupBoundaries {
	const boundaries: GroupBoundaries = {
		1: CompletionGroup.WORLD_RECORD,
		10: CompletionGroup.TOP_10
	};

	const numberedGroups = [
		CompletionGroup.GROUP_1,
		CompletionGroup.GROUP_2,
		CompletionGroup.GROUP_3,
		CompletionGroup.GROUP_4
	];

	let rankOffset = 11;
	for (let i = 0; i < GROUP_PARAMS.maxGroups; i++) {
		const groupSize = Math.max(
			GROUP_PARAMS.scaleFactors[i] * totalCompletions ** GROUP_PARAMS.exponents[i],
			GROUP_PARAMS.minSizes[i]
		);
		const threshold = rankOffset + groupSize;
		const lastRank = Math.ceil(threshold - 1);
		boundaries[lastRank] = numberedGroups[i];
		rankOffset = threshold;
	}

	return boundaries;
}

/**
 * Classify a PB's rank into a {@link CompletionGroup}, given {@link GroupBoundaries}
 * Returns null when the user hasn't completed the track (null rank).
 */
export function getCompletionGroup(rank: number | null, boundaries: GroupBoundaries): CompletionGroup | null {
	if (rank == null) return null;
	if (rank === 1) return CompletionGroup.WORLD_RECORD;
	if (rank <= 10) return CompletionGroup.TOP_10;

	for (const [boundary, group] of Object.entries(boundaries)) {
		if (rank <= +boundary) {
			return group;
		}
	}

	return null;
}
