const INACTIVE_CLASS = 'hudtimer__time--inactive';
const FINISHED_CLASS = 'hudtimer__time--finished';
const FAILED_CLASS = 'hudtimer__time--failed';

const INCREASE_CLASS = 'hudtimer__comparison--increase';
const DECREASE_CLASS = 'hudtimer__comparison--decrease';
const FADEOUT_CLASS = 'hudtimer__comparison--fadeout';
const FADEOUT_START_CLASS = 'hudtimer__comparison--fade-start';

class HudTimer {
	/** @type {Label} @static */
	static timeLabel = $('#HudTimerTime');
	/** @type {Label} @static */
	static compLabel = $('#HudTimerComparison');

	static prevZone = 0;

	static onTimerStarted() {
		this.timeLabel.RemoveClass(FAILED_CLASS); // fail animation could be happening, so force stop
		this.timeLabel.RemoveClass(INACTIVE_CLASS);

		if (MomentumTimerAPI.IsStartSoundEnabled()) $.PlaySoundEvent('Momentum.StartTimer');
	}
	static onTimerFinished() {
		this.timeLabel.AddClass(FINISHED_CLASS);

		$.GetContextPanel().SetDialogVariableFloat('runtime', MomentumTimerAPI.GetCurrentRunTime());

		if (MomentumTimerAPI.IsFinishSoundEnabled()) $.PlaySoundEvent('Momentum.FinishTimer');
	}
	static onTimerStopped() {
		this.resetTimer();

		// if we want special styling for timer artificially running (via savestate), do it here like so
		// if (MomentumTimerAPI.GetTimerState() === TimerState.PRACTICE) HudTimer.timeLabel.AddClass(PRACTICE_CLASS);

		if (MomentumTimerAPI.IsStopSoundEnabled()) $.PlaySoundEvent('Momentum.StopTimer');
	}
	static onTimerFailed() {
		// failed to start timer, so resetting is not needed

		this.timeLabel.TriggerClass(FAILED_CLASS);

		if (MomentumTimerAPI.IsFailSoundEnabled()) $.PlaySoundEvent('Momentum.FailedStartTimer');
	}

	static onUpdate() {
		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState === TimerState.NOTRUNNING) return;

		$.GetContextPanel().SetDialogVariableFloat('runtime', MomentumTimerAPI.GetCurrentRunTime());
	}

	static onZoneChange(enter, linear, curZone, _curTrack, timerState) {
		if (timerState === TimerState.NOTRUNNING && enter && curZone === 1) {
			// timer state is not reset on map finished until entering the start zone again (on reset)
			this.resetTimer();
			this.timeLabel.RemoveClass(FINISHED_CLASS);
			return;
		}

		if (timerState === TimerState.RUNNING && curZone > 1 && enter === linear && HudTimer.prevZone !== curZone) {
			const diff = RunComparisonsAPI.GetLoadedComparisonOverallDiff(curZone);

			let diffSymbol;
			if (diff > 0) {
				this.compLabel.AddClass(DECREASE_CLASS);
				this.compLabel.RemoveClass(INCREASE_CLASS);
				diffSymbol = '+';
			} else if (diff < 0) {
				this.compLabel.AddClass(INCREASE_CLASS);
				this.compLabel.RemoveClass(DECREASE_CLASS);
				diffSymbol = '-';
			} else {
				this.compLabel.RemoveClass(INCREASE_CLASS);
				this.compLabel.RemoveClass(DECREASE_CLASS);
				diffSymbol = '';
			}

			$.GetContextPanel().SetDialogVariableFloat('runtimediff', Math.abs(diff));
			$.GetContextPanel().SetDialogVariable('diffSymbol', diffSymbol);

			this.compLabel.AddClass(FADEOUT_START_CLASS);
			this.compLabel.TriggerClass(FADEOUT_CLASS);
		}

		this.prevZone = curZone;
	}

	static forceHideComparison() {
		this.compLabel.RemoveClass(FADEOUT_START_CLASS);
		this.compLabel.TriggerClass(FADEOUT_CLASS);
	}

	static resetTimer() {
		$.GetContextPanel().SetDialogVariableFloat('runtime', 0);
		this.timeLabel.AddClass(INACTIVE_CLASS);
		this.forceHideComparison();
		this.prevZone = 0;
	}

	static onTimerEvent(_ent, type) {
		switch (type) {
			case TimerEvent.STARTED:
				this.onTimerStarted();
				break;
			case TimerEvent.FINISHED:
				this.onTimerFinished();
				break;
			case TimerEvent.STOPPED:
				this.onTimerStopped();
				break;
			case TimerEvent.FAILED:
				this.onTimerFailed();
				break;
			default:
				$.Warning('Unknown timer event given to Momentum hud timer!');
				break;
		}
	}

	static onSaveStateChange(_count, _current, _usingmenu) {
		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState !== TimerState.RUNNING) {
			this.resetTimer();
			this.timeLabel.RemoveClass(FINISHED_CLASS);
		}
	}

	static onReplayStopped() {
		this.timeLabel.RemoveClass(FINISHED_CLASS);

		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState !== TimerState.RUNNING) {
			this.resetTimer();
			return;
		}

		this.forceHideComparison();
		this.timeLabel.RemoveClass(INACTIVE_CLASS);
		this.prevZone = ZonesAPI.GetCurrentZone(); // if curZone === 0 and the timer is running we have big problems
	}

	static onLoad() {
		$.GetContextPanel().hiddenHUDBits = HideHud.LEADERBOARDS;
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumTimerStateChange', this.onTimerEvent.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', this.onZoneChange.bind(this));
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', this.onSaveStateChange.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumReplayStopped', this.onReplayStopped.bind(this));

		$.GetContextPanel().SetDialogVariableFloat('runtime', 0);
	}
}
