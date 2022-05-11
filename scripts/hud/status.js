'use strict';

class HudStatus {
	/** @type {Label} @static */
	static label = $('#HudStatusLabel');

	static curZone = -1;
	static curTrack = -1;
	static linear = true;
	static enter = false;
	static timerState = TIMER_STATE.NOTRUNNING;

	static inPracticeMode = false;

	static saveStateCount = 0;
	static saveStateCurrent = 0;
	static saveStateUsing = false;

	static onZoneChange(enter, linear, curZone, curTrack, timerState) {
		this.enter = enter;
		this.curZone = curZone;
		this.curTrack = curTrack;
		this.linear = linear;
		this.timerState = timerState;

		this.updateLabel();
	}

	static onPracticeModeChange(enabled) {
		this.inPracticeMode = enabled;
		this.updateLabel();
	}

	static onSaveStateChange(count, current, usingmenu) {
		this.saveStateCount = count;
		this.saveStateCurrent = current + 1; // need 1-indexing for display
		this.saveStateUsing = usingmenu;
		this.timerState = MomentumTimerAPI.GetTimerState();

		this.updateLabel();
	}

	static updateLabel() {
		const enteredStartZone = this.enter && this.curZone === 1;
		const enteredEndZone = this.enter && this.curZone === 0;

		let text = 'Spawn';

		if (this.saveStateUsing && this.timerState !== TIMER_STATE.RUNNING) {
			text = `SaveState ${this.saveStateCurrent}/${this.saveStateCount}`;
		} else {
			if (enteredStartZone) {
				text = 'Start Zone';
			} else if (enteredEndZone) {
				text = 'End Zone';
			} else if (this.curZone >= 0) {
				text = `${this.linear ? 'Checkpoint' : 'Stage'} ${this.curZone}/${ZonesAPI.GetZoneCount(
					this.curTrack
				)}`;
			}

			if (this.curTrack > 0) {
				text = `Bonus ${this.curTrack} | ${text}`;
			}
		}

		if (this.inPracticeMode) {
			text = `Practice Mode | ${text}`;
		}

		this.label.text = text;
	}

	static onLoad() {
		$.GetContextPanel().hiddenHUDBits = HIDEHUD.LEADERBOARDS;
	}

	static {
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', this.onZoneChange.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', this.onPracticeModeChange.bind(this));
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', this.onSaveStateChange.bind(this));

		this.label.text = 'Spawn';
	}
}
