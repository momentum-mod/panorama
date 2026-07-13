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
 * Classify a PB's rank into a {@link CompletionGroup}, given the total number of
 * completions on the leaderboard. Returns null when the user hasn't completed the
 * track (null rank).
 *
 * Ported verbatim from the backend (previously `LeaderboardRunsService`'s
 * `getCompletionGroup` + `XpSystems.getRankXpForRank`): WR and Top10 take priority,
 * otherwise the numbered groups are sized dynamically from the completion count.
 */
export function getCompletionGroup(rank: number | null, totalCompletions: number): CompletionGroup | null {
	if (rank == null) return null;
	if (rank === 1) return CompletionGroup.WORLD_RECORD;
	if (rank <= 10) return CompletionGroup.TOP_10;

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
		if (rank < rankOffset + groupSize) {
			return numberedGroups[i];
		}
		rankOffset += groupSize;
	}

	// Rank falls beyond the last group - bottom group, matching the backend default.
	return CompletionGroup.GROUP_4;
}
