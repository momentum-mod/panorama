'use_strict';

const TimerState = {
	NOTRUNNING: 0,
	RUNNING: 1,
	PRACTICE: 2
};

class HudStatus {
	static label = $('#HudStatusLabel');

	static curZone = -1;
	static curTrack = -1;
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
			if (enteredStartZone) {
				text = 'Start Zone';
			}
			else if (enteredEndZone) {
				text = 'End Zone';
			}
			else if (HudStatus.curZone >= 0) {
				text = `${HudStatus.linear ? 'Checkpoint' : 'Stage'} ${HudStatus.curZone}/${ZonesAPI.GetZoneCount(HudStatus.curTrack)}`;
			}
			
			if (HudStatus.curTrack > 0) {
				text = `Bonus ${HudStatus.curTrack} | ${text}`;
			}
		}

		if (HudStatus.inPracticeMode) {
			text = `Practice Mode | ${text}`;
		}

		HudStatus.label.text = text;
	}

	static {
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', HudStatus.onZoneChange);
		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', HudStatus.onPracticeModeChange);
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', HudStatus.onSaveStateChange);
	}
}
