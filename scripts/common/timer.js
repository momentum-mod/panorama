const TimerEvent = {
	STARTED: 0,
	FINISHED: 1,
	STOPPED: 2,
	FAILED: 3
};

const TimerState = {
	NOTRUNNING: 0,
	RUNNING: 1,
	PRACTICE: 2
};

const TimerStateNEW = {
	DISABLED: 0,
	PRIMED: 1,
	RUNNING: 2,
	FINISHED: 3
};

const TrackType = {
	MAIN: 0,
	STAGE: 1,
	BONUS: 2
};

function GetTrackTypeName(type) {
	switch (type) {
		case TrackType.MAIN:
			return $.Localize('#TrackType_Main');
		case TrackType.STAGE:
			// TODO: support gamemode-specific name
			return $.Localize('#TrackType_Stage');
		case TrackType.BONUS:
			return $.Localize('#TrackType_Bonus');
		default:
			return 'UNKNOWN TRACK TYPE';
	}
}

function GetTrackGenericName(trackId) {
	return trackId.type === TrackType.MAIN
		? GetTrackTypeName(trackId.type)
		: `${GetTrackTypeName(trackId.type)} ${trackId.number}`;
}
