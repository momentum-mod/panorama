import { MapStatuses, MapCreditType, MMap, TrackType } from './web';
import { getTrack } from './leaderboard';

export enum MapListType {
	APPROVED = 0,
	SUBMISSIONS = 1
}

/** Get the tier of a track, used a suggested tier if the map is in submission */
export function getTier(
	staticData: MMap,
	gamemode: Gamemode,
	trackType = TrackType.MAIN,
	trackNum = 1
): number | undefined {
	return MapStatuses.IN_SUBMISSION.includes(staticData.status)
		? staticData.submission.suggestions.find(
				(s) => s.gamemode === gamemode && s.trackType === trackType && s.trackNum === trackNum
			)?.tier
		: getTrack(staticData, gamemode, trackType, trackNum)?.tier;
}

/**
 * Get collection of simplified credits data, optionally filtered by type.
 * If the map is in submission, placeholders suggestions are included, with steamID omitted.
 */
export function getAllCredits(staticData: MMap, type?: MapCreditType): Array<{ alias: string; steamID?: string }> {
	const credits = [];

	let normal = staticData.credits;
	if (normal) {
		if (type !== undefined) {
			normal = normal?.filter(({ type: t }) => t === type);
		}

		credits.push(...normal.map(({ user: { alias, steamID } }) => ({ alias, steamID })));
	}

	if (!MapStatuses.IN_SUBMISSION.includes(staticData.status)) {
		return credits;
	}

	let placeholders = staticData.submission.placeholders;
	if (placeholders) {
		if (type !== undefined) {
			placeholders = placeholders?.filter(({ type: t }) => t === type);
		}

		credits.push(...placeholders.map(({ alias }) => ({ alias })));
	}

	return credits;
}

export function getAuthorNames(staticData: MMap): string {
	return getAllCredits(staticData, MapCreditType.AUTHOR)
		.map(({ alias }) => alias)
		.join(', ');
}
