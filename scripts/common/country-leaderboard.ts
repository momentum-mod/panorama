import { LeaderboardRecord } from 'common/leaderboard';
import { TrackType } from 'common/web/enums/track-type.enum';
import { Style } from 'common/web/enums/style.enum';
import { Gamemode } from 'common/web/enums/gamemode.enum';

// The game's leaderboard records don't include a country, so they're read from the public web API
const API_URL = 'https://api.momentum-mod.org/v1';

// The most the API returns in one request
const RUNS_PER_REQUEST = 100;

// Cap how many requests one leaderboard may take
const MAX_REQUESTS = 50;

interface ApiLeaderboardResponse {
	totalCount: number;
	data: Array<{
		rank: number;
		time: number;
		createdAt: string;
		user: { steamID: string; alias: string; country?: string };
	}>;
}

export interface CountryLeaderboardQuery {
	mapID: number;
	gamemode: Gamemode;
	trackType: TrackType;
	trackNum: number;
	style: Style;
	country: string;
}

export interface CountryLeaderboardUpdate {
	/** All runs from the country found so far, ranked among themselves. */
	records: LeaderboardRecord[];
	done: boolean;
	failed: boolean;
}

/**
 * Download a leaderboard and pick out the runs from one country, reporting after every request.
 * Stops as soon as `isCancelled` returns true.
 */
export function loadCountryLeaderboard(
	query: CountryLeaderboardQuery,
	isCancelled: () => boolean,
	onUpdate: (update: CountryLeaderboardUpdate) => void
) {
	const { mapID, gamemode, trackType, trackNum, style, country } = query;
	const records: LeaderboardRecord[] = [];

	const request = (index: number) => {
		const url =
			`${API_URL}/maps/${mapID}/leaderboard?gamemode=${gamemode}&trackType=${trackType}` +
			`&trackNum=${trackNum}&style=${style}&skip=${index * RUNS_PER_REQUEST}&take=${RUNS_PER_REQUEST}`;

		get(url, (response) => {
			if (isCancelled()) return;

			const body = parseResponse(response.responseText);
			if (!body) {
				$.Warning(`Country leaderboard request failed (${response.statusText}): ${url}`);
				onUpdate({ records, done: true, failed: true });
				return;
			}

			for (const run of body.data) {
				if (run.user?.country !== country) continue;

				records.push({
					rank: records.length + 1,
					playerName: run.user.alias,
					steamID: run.user.steamID,
					runTime: run.time,
					date: `${Math.floor(Date.parse(run.createdAt) / 1000)}` as uint64_str,
					trackId: 0,
					style,
					replayHash: '',
					fileURL: '',
					userRoles: 0,
					userBans: 0
				});
			}

			const done =
				body.data.length < RUNS_PER_REQUEST ||
				(index + 1) * RUNS_PER_REQUEST >= body.totalCount ||
				index + 1 >= MAX_REQUESTS;

			onUpdate({ records, done, failed: false });
			if (!done && !isCancelled()) request(index + 1);
		});
	};

	request(0);
}

/** The global rank of one player's run, or null if it can't be found. */
export function getGlobalRank(
	query: Omit<CountryLeaderboardQuery, 'country'>,
	steamID: string,
	onResult: (rank: number | null) => void
) {
	const { mapID, gamemode, trackType, trackNum, style } = query;
	const url =
		`${API_URL}/maps/${mapID}/leaderboard?gamemode=${gamemode}&trackType=${trackType}` +
		`&trackNum=${trackNum}&style=${style}&steamIDs=${steamID}`;

	get(url, (response) => onResult(parseResponse(response.responseText)?.data[0]?.rank ?? null));
}

/** GET a URL, always calling `complete`: the game throws if the domain isn't whitelisted. */
function get(url: string, complete: (response: { responseText: string; statusText: string }) => void) {
	try {
		$.AsyncWebRequest(url, { type: 'GET', complete });
	} catch (error) {
		complete({ responseText: '', statusText: String(error) });
	}
}

function parseResponse(text: string): ApiLeaderboardResponse | null {
	try {
		// Responses can end in a null character, which JSON.parse rejects
		const body = JSON.parse((text ?? '').replace(/\0+$/, ''));
		// An empty leaderboard may leave out the data array
		if (body?.totalCount === 0) return { totalCount: 0, data: [] };
		return Array.isArray(body?.data) ? body : null;
	} catch {
		return null;
	}
}
