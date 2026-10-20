import { CompletionGroup } from './web/enums/completion-group.enum';

/**
 * Port of libs/xp-systems/src/rank-groups.ts in the website repo.
 * fetch-web only syncs libs/constants, so sync this manually.
 */
const RANK_GROUP_TOP_RANKS = 10;
const RANK_GROUP_FIELD_FRACTION = 2 / 3;
const RANK_GROUP_MIN_ENDS = [20, 35, 60, 100, 150, 200] as const;
const RANK_GROUP_COUNT = RANK_GROUP_MIN_ENDS.length;

const NUMBERED_GROUPS = [
	CompletionGroup.GROUP_1,
	CompletionGroup.GROUP_2,
	CompletionGroup.GROUP_3,
	CompletionGroup.GROUP_4,
	CompletionGroup.GROUP_5,
	CompletionGroup.GROUP_6
];

/** Record of last rank for each group eg. groupBoundaries[10] = CompletionGroup.TOP_10 */
export type GroupBoundaries = Record<number, CompletionGroup>;

/** Last rank of each numbered group (index 0 = group 1). May exceed the board size on small boards. */
export function getRankGroupEnds(completions: number): number[] {
	const field = Math.max(0, completions - RANK_GROUP_TOP_RANKS);
	return RANK_GROUP_MIN_ENDS.map((minEnd, i) =>
		Math.max(
			minEnd,
			RANK_GROUP_TOP_RANKS + Math.floor((field * RANK_GROUP_FIELD_FRACTION) / 2 ** (RANK_GROUP_COUNT - 1 - i))
		)
	);
}

export function getGroupBoundaries(totalCompletions: number): GroupBoundaries {
	const boundaries: GroupBoundaries = {
		1: CompletionGroup.WORLD_RECORD,
		[RANK_GROUP_TOP_RANKS]: CompletionGroup.TOP_10
	};
	getRankGroupEnds(totalCompletions).forEach((end, i) => {
		boundaries[end] = NUMBERED_GROUPS[i];
	});
	return boundaries;
}

/**
 * Returns null if the user hasn't completed the track, or if the rank is past group 6's cutoff
 * (the website calls that NO_GROUP; here no pill is shown).
 */
export function getCompletionGroup(rank: number | null, boundaries: GroupBoundaries): CompletionGroup | null {
	if (rank == null) return null;
	if (rank === 1) return CompletionGroup.WORLD_RECORD;
	if (rank <= RANK_GROUP_TOP_RANKS) return CompletionGroup.TOP_10;

	for (const [boundary, group] of Object.entries(boundaries)) {
		if (rank <= +boundary) return group;
	}
	return null;
}
