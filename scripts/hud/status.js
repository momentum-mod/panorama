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

	// TEMP
	static USENEWTIMER = false;

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

	static onTimerStatusChanged() {
		this.USENEWTIMER = true;
		this.updateLabel();
	}

	static updateLabel() {
		if (this.USENEWTIMER) {
			const timerStatus = MomentumTimerAPI.GetObservedTimerStatus();

			const trackName = GetTrackGenericName(timerStatus.trackId);
			let timerState = null;

			switch (timerStatus.state) {
				// TODO maybe show disabled/primed in place of time instead of as part of status
				case TimerStateNEW.DISABLED:
					timerState = $.Localize('#HudStatus_TimerDisabled');
					break;
				case TimerStateNEW.PRIMED:
					timerState = $.Localize('#HudStatus_TimerPrimed');
					break;
				case TimerStateNEW.RUNNING:
					// TODO: support per-gamemode major/minor checkpoint names
					// TODO: pin down how we want to convey major/minor nums (Major-Minor, Major/Total, Minor/Total, etc)
					if (timerStatus.segments === 1) {
						if (timerStatus.segmentCheckpoints > 1)
							timerState = `${$.Localize('#HudStatus_Checkpoint')} ${timerStatus.minorNum}`;
						else {
							// no state text in this case
						}
					} else {
						timerState =
							timerStatus.segmentCheckpoints > 1
								? `${$.Localize('#HudStatus_Stage')} ${timerStatus.majorNum}-${timerStatus.minorNum}`
								: `${$.Localize('#HudStatus_Stage')} ${timerStatus.majorNum}`;
					}
					break;
				case TimerStateNEW.FINISHED:
					timerState = $.Localize('#HudStatus_TimerFinished');
					break;
				default:
					$.Warning('Unknown timer state');
					timerState = '???';
					break;
			}

			let text = timerState ? `${trackName} | ${timerState}` : trackName;

			// TODO maybe show these somewhere else instead of prepending tons of stuff
			if (this.saveStateUsing)
				text = `${$.Localize('#HudStatus_SaveState')} ${this.saveStateCurrent}/${
					this.saveStateCount
				} | ${text}`;

			if (this.inPracticeMode) text = `${$.Localize('#HudStatus_PracticeMode')} | ${text}`;

			this.label.text = text;
		} else {
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
	}

	static onLoad() {
		$.GetContextPanel().hiddenHUDBits = HideHud.TABMENU;
	}

	static onLevelInit() {
		this.USENEWTIMER = false;
	}

	static {
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', this.onZoneChange.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', this.onPracticeModeChange.bind(this));
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', this.onSaveStateChange.bind(this));

		$.RegisterForUnhandledEvent('LevelInitPostEntity', this.onLevelInit.bind(this));
		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', this.onTimerStatusChanged.bind(this));
		$.RegisterForUnhandledEvent('OnObservedTimerCheckpointProgressed', this.onTimerStatusChanged.bind(this));
		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', this.onTimerStatusChanged.bind(this));

		this.label.text = $.Localize('#HudStatus_Spawn');
	}
}
