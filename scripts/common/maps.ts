import { getTrack } from './leaderboard';
import { checkDosa } from 'util/dont-show-again';
import type { MMap } from './web/types/models/models';
import { MapStatuses } from './web/enums/map-status.enum';
import { MapCreditType } from './web/enums/map-credit-type.enum';
import { TrackType } from './web/enums/track-type.enum';

/**
 * Download or launch a map, show missing games popup first if required games are not mounted
 */
export function handlePlayMap(mapData: MapCacheAPI.MapData, gamemodeOverride: Gamemode = null) {
	if (!mapData.mapFileExists) {
		// Need to download
		$.DispatchEvent('MapSelector_TryPlayMap', mapData.staticData.id);
		return;
	}

	const requiredGames = mapData.staticData.info?.requiredGames;
	const mountedGames = GameInterfaceAPI.GetMountedSteamApps();
	const missingGames = requiredGames?.filter((game) => !mountedGames.includes(game));

	if (missingGames?.length > 0 && !checkDosa('requiredGames')) {
		let params = `mapID=${mapData.staticData.id}&games=${requiredGames.join(',')}&dosaKey=requiredGames&dosaNameToken=Dosa_RequiredGames`;
		if (gamemodeOverride !== null) {
			params += `&gamemodeOverride=${gamemodeOverride}`;
		}

		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'RequiredGames',
			'file://{resources}/layout/modals/popups/required-games.xml',
			params
		);
	} else {
		if (gamemodeOverride !== null) {
			$.DispatchEvent('MapSelector_TryPlayMap_GameModeOverride', mapData.staticData.id, gamemodeOverride);
		} else {
			$.DispatchEvent('MapSelector_TryPlayMap', mapData.staticData.id);
		}
	}
}

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

/** Simplified credit object, derived from either a regular credit or a placeholder suggestion */
export interface SimpleMapCredit {
	alias: string;
	steamID?: string;
}

/**
 * Get collection of simplified credits data, optionally filtered by type.
 * If the map is in submission, placeholders suggestions are included, with steamID omitted.
 */
export function getAllCredits(staticData: MMap, type?: MapCreditType): SimpleMapCredit[] {
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
