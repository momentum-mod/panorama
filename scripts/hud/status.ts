class HudStatus {
label = $<Label>('#HudStatusLabel');

curZone = -1;
curTrack = -1;
linear = true;
enter = false;
timerState = _.Timer.TimerState.NOTRUNNING;

inPracticeMode = false;

saveStateCount = 0;
saveStateCurrent = 0;
saveStateUsing = false;

onZoneChange(enter, linear, curZone, curTrack, timerState) {
		this.enter = enter;
		this.curZone = curZone;
		this.curTrack = curTrack;
		this.linear = linear;
		this.timerState = timerState;

		this.updateLabel();
	}

onPracticeModeChange(enabled) {
		this.inPracticeMode = enabled;
		this.updateLabel();
	}

onSaveStateChange(count, current, usingmenu) {
		this.saveStateCount = count;
		this.saveStateCurrent = current + 1; // need 1-indexing for display
		this.saveStateUsing = usingmenu;
		this.timerState = MomentumTimerAPI.GetTimerState();

		this.updateLabel();
	}

updateLabel() {
		const enteredStartZone = this.enter && this.curZone === 1;
		const enteredEndZone = this.enter && this.curZone === 0;

		let text = $.Localize('#HudStatus_Spawn');

		if (this.saveStateUsing && this.timerState !== _.Timer.TimerState.RUNNING) {
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

onLoad() {
		$.GetContextPanel<MomHudStatus>().hiddenHUDBits = _.State.HideHud.TABMENU;
	}

constructor() {
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', this.onZoneChange.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', this.onPracticeModeChange.bind(this));
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', this.onSaveStateChange.bind(this));

		this.label.text = $.Localize('#HudStatus_Spawn');
	}
}
