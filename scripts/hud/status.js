class HudStatus {
	/** @type {Label} @static */
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

		let text = $.Localize('#HudStatus_Spawn');

		if (this.saveStateUsing && this.timerState !== TimerState.RUNNING) {
			text = `${$.Localize('#HudStatus_SaveState')} ${this.saveStateCurrent}/${this.saveStateCount}`;
		} else {
			if (enteredStartZone) {
				text = $.Localize('#HudStatus_StartZone');
			} else if (enteredEndZone) {
				text = $.Localize('#HudStatus_EndZone');
			} else if (this.curZone >= 0) {
				text = `${$.Localize(this.linear ? '#HudStatus_Checkpoint' : '#HudStatus_Stage')} ${
					this.curZone
				}/${ZonesAPI.GetZoneCount(this.curTrack)}`;
			}

			if (this.curTrack > 0) {
				text = `${$.Localize('#HudStatus_Bonus')} ${this.curTrack} | ${text}`;
			}
		}

		if (this.inPracticeMode) {
			text = `${$.Localize('#HudStatus_PracticeMode')} | ${text}`;
		}

		this.label.text = text;
	}

	static onLoad() {
		$.GetContextPanel().hiddenHUDBits = HideHud.LEADERBOARDS;
	}

	static {
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', this.onZoneChange.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', this.onPracticeModeChange.bind(this));
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', this.onSaveStateChange.bind(this));

		this.label.text = $.Localize('#HudStatus_Spawn');
	}
}
