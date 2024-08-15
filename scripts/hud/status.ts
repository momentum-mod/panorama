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

	static onTimerStatusChanged() {
		this.updateLabel();
	}

	static updateLabel() {
		const timerStatus = MomentumTimerAPI.GetObservedTimerStatus();

		let text = '';

		switch (timerStatus.state) {
			case TimerStateNEW.DISABLED:
				text = $.Localize('#HudStatus_TimerDisabled');
				break;
			case TimerStateNEW.PRIMED:
				text = $.Localize('#HudStatus_TimerPrimed');
				break;
			case TimerStateNEW.RUNNING:
				switch (timerStatus.trackId.type) {
					case TrackType.MAIN:
						if (timerStatus.segmentsCount === 1) {
							if (timerStatus.segmentCheckpointsCount > 1) {
								text = `${$.Localize('#HudStatus_Checkpoint')} ${timerStatus.minorNum}/${
									timerStatus.segmentCheckpointsCount
								}`;
							} else {
								// no state text in this case
							}
						} else {
							text =
								timerStatus.segmentCheckpointsCount > 1
									? `${$.Localize('#HudStatus_Stage')} ${timerStatus.majorNum}/${
											timerStatus.segmentsCount
									  } | ${$.Localize('#HudStatus_Checkpoint')} ${timerStatus.minorNum}/${
											timerStatus.segmentCheckpointsCount
									  }`
									: `${$.Localize('#HudStatus_Stage')} ${timerStatus.majorNum}/${
											timerStatus.segmentsCount
									  }`;
						}
						break;
					case TrackType.STAGE:
						text =
							timerStatus.segmentCheckpointsCount > 1
								? `${$.Localize('#HudStatus_Stage')} ${timerStatus.trackId.number} | ${$.Localize(
										'#HudStatus_Checkpoint'
								  )} ${timerStatus.minorNum}/${timerStatus.segmentCheckpointsCount}`
								: `${$.Localize('#HudStatus_Stage')} ${timerStatus.trackId.number}`;
						break;
					case TrackType.BONUS:
						text =
							timerStatus.segmentCheckpointsCount > 1
								? `${$.Localize('#HudStatus_Bonus')} ${timerStatus.trackId.number} | ${$.Localize(
										'#HudStatus_Checkpoint'
								  )} ${timerStatus.minorNum}/${timerStatus.segmentCheckpointsCount}`
								: `${$.Localize('#HudStatus_Bonus')} ${timerStatus.trackId.number}`;
						break;
				}
				break;
			case TimerStateNEW.FINISHED:
				text = $.Localize('#HudStatus_TimerFinished');
				break;
			default:
				$.Warning('Unknown timer state');
				text = '???';
				break;
		}

		// TODO: maybe show these somewhere else instead of prepending tons of stuff
		if (this.saveStateUsing) {
			text = `${$.Localize('#HudStatus_SaveState')} ${this.saveStateCurrent}/${this.saveStateCount} | ${text}`;
		}

		if (this.inPracticeMode) {
			text = `${$.Localize('#HudStatus_PracticeMode')} | ${text}`;
		}

		this.label.text = text;
	}

	static onLoad() {
		$.GetContextPanel().hiddenHUDBits = HideHud.TABMENU;
	}

	static {
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', this.onZoneChange.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', this.onPracticeModeChange.bind(this));
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', this.onSaveStateChange.bind(this));

		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', this.onTimerStatusChanged.bind(this));
		$.RegisterForUnhandledEvent('OnObservedTimerCheckpointProgressed', this.onTimerStatusChanged.bind(this));
		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', this.onTimerStatusChanged.bind(this));

		this.label.text = $.Localize('#HudStatus_Spawn');
	}
}
