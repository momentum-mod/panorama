'use_strict';

const TimerState = {
	NOTRUNNING: 0,
	RUNNING: 1,
	PRACTICE: 2
};

class HudStatus {
	static label = $('#HudStatusLabel');

	static numZones = 0;
	static curZone = -1;
	static curTrack = 0;
	static linear = true;
	static enter = false;
	static timerState = TimerState.NOTRUNNING;

	static inPracticeMode = false;

	static saveStateCount = 0;
	static saveStateCurrent = 0;
	static saveStateUsing = false;

	static onZoneChange(enter, linear, curZone, curTrack, timerState) {
		HudStatus.enter = enter;
		HudStatus.curZone = curZone;
		HudStatus.curTrack = curTrack;
		HudStatus.linear = linear;
		HudStatus.timerState = timerState;

		HudStatus.updateLabel();
	}

	static onMapLoad(_mapName) {
		const mapData = MapCacheAPI.GetCurrentMapData();
		if (!mapData) return;

		HudStatus.numZones = mapData['mainTrack']['numZones'];

		HudStatus.updateLabel();
	}

	static onPracticeModeChange(enabled) {
		HudStatus.inPracticeMode = enabled;
		HudStatus.updateLabel();
	}

	static onSaveStateChange(count, current, usingmenu) {
		HudStatus.saveStateCount = count;
		HudStatus.saveStateCurrent = current + 1; // need 1-indexing for display
		HudStatus.saveStateUsing = usingmenu;
		HudStatus.timerState = MomentumTimerAPI.GetTimerState();

		HudStatus.updateLabel();
	}

	static updateLabel() {
		const enteredStartZone = HudStatus.enter && HudStatus.curZone === 1;
		const enteredEndZone = HudStatus.enter && HudStatus.curZone === 0;

		let text = 'Spawn';

		if (HudStatus.saveStateUsing && HudStatus.timerState !== TimerState.RUNNING) {
			text = `SaveState ${HudStatus.saveStateCurrent}/${HudStatus.saveStateCount}`;
		}
		else {
			if (HudStatus.curTrack > 0) {
				// TODO: on zone refactor properly update number of zones for bonus tracks
				text = 'Bonus Track'; 
			}
			else if (enteredStartZone) {
				text = 'Start Zone';
			}
			else if (enteredEndZone) {
				text = 'End Zone';
			}
			else if (HudStatus.curZone >= 0) {
				text = `${HudStatus.linear ? 'Checkpoint' : 'Stage'} ${HudStatus.curZone}/${HudStatus.numZones}`;
			}
		}

		if (HudStatus.inPracticeMode) {
			text = `Practice Mode | ${text}`;
		}

		HudStatus.label.text = text;
	}

	static {
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', HudStatus.onZoneChange);
		$.RegisterForUnhandledEvent('MapCache_MapLoad', HudStatus.onMapLoad);
		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', HudStatus.onPracticeModeChange);
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', HudStatus.onSaveStateChange);
	}
}
