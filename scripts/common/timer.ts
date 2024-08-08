import { Gamemode, Leaderboard, MMap, TrackType } from './web';

export enum TimerEvent {
	STARTED = 0,
	FINISHED = 1,
	STOPPED = 2,
	FAILED = 3
}

export enum TimerState {
	NOTRUNNING = 0,
	RUNNING = 1,
	PRACTICE = 2
}

export function getMainTrack(mapData: MMap, gamemode: Gamemode): Leaderboard {
	return mapData.leaderboards.find(
		(leaderboard) =>
			leaderboard.gamemode === gamemode && leaderboard.trackType === TrackType.MAIN && leaderboard.style === 0
	);
}

export function getNumZones(mapData: MMap): number {
	return mapData.leaderboards.filter((leaderboard) => leaderboard.trackType === TrackType.STAGE).length;
}
