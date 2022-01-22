'use_strict';

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

const INACTIVE_CLASS = 'hudtimer__time--inactive';
const FINISHED_CLASS = 'hudtimer__time--finished';
const FAILED_CLASS = 'hudtimer__time--failed';

const INCREASE_CLASS = 'hudtimer__comparison--increase';
const DECREASE_CLASS = 'hudtimer__comparison--decrease';
const FADEOUT_CLASS = 'hudtimer__comparison--fadeout';
const FADEOUT_START_CLASS = 'hudtimer__comparison--fade-start';

class HudTimer {
	static timeLabel = $('#HudTimerTime');
	static compLabel = $('#HudTimerComparison');

	static prevZone = 0;

	static onTimerStarted() {
		HudTimer.timeLabel.RemoveClass(FAILED_CLASS); // fail animation could be happening, so force stop
		HudTimer.timeLabel.RemoveClass(INACTIVE_CLASS);

		if (MomentumTimerAPI.IsStartSoundEnabled())
			$.PlaySoundEvent("Momentum.StartTimer");
	}
	static onTimerFinished() {
		HudTimer.timeLabel.AddClass(FINISHED_CLASS);

		$.GetContextPanel().SetDialogVariableFloat('runtime', MomentumTimerAPI.GetCurrentRunTime());

		if (MomentumTimerAPI.IsFinishSoundEnabled())
			$.PlaySoundEvent("Momentum.FinishTimer");
	}
	static onTimerStopped() {
		HudTimer.resetTimer();

		// if we want special styling for timer artificially running (via savestate), do it here like so
		// if (MomentumTimerAPI.GetTimerState() === TimerState.PRACTICE) HudTimer.timeLabel.AddClass(PRACTICE_CLASS);
		
		if (MomentumTimerAPI.IsStopSoundEnabled())
			$.PlaySoundEvent("Momentum.StopTimer");
	}
	static onTimerFailed() {
		// failed to start timer, so resetting is not needed

		HudTimer.timeLabel.TriggerClass(FAILED_CLASS);
		
		if (MomentumTimerAPI.IsFailSoundEnabled())
			$.PlaySoundEvent("Momentum.FailedStartTimer");
	}

	static onUpdate() {
		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState === TimerState.NOTRUNNING) return;

		$.GetContextPanel().SetDialogVariableFloat('runtime', MomentumTimerAPI.GetCurrentRunTime());
	}

	static onZoneChange(enter, linear, curZone, _curTrack, timerState) {
		if (timerState === TimerState.NOTRUNNING && enter && curZone === 1) {
			// timer state is not reset on map finished until entering the start zone again (on reset)
			HudTimer.resetTimer();
			HudTimer.timeLabel.RemoveClass(FINISHED_CLASS);
			return;
		}
		
		if (timerState === TimerState.RUNNING && curZone > 1 && enter === linear && HudTimer.prevZone !== curZone) {
			const diff = RunComparisonsAPI.GetLoadedComparisonOverallDiff(curZone);

			let diffSymbol;
			if (diff > 0) {
				HudTimer.compLabel.AddClass(DECREASE_CLASS);
				HudTimer.compLabel.RemoveClass(INCREASE_CLASS);
				diffSymbol = '+';
			} else if (diff < 0) {
				HudTimer.compLabel.AddClass(INCREASE_CLASS);
				HudTimer.compLabel.RemoveClass(DECREASE_CLASS);
				diffSymbol = '-';
			} else {
				HudTimer.compLabel.RemoveClass(INCREASE_CLASS);
				HudTimer.compLabel.RemoveClass(DECREASE_CLASS);
				diffSymbol = '±';
			}

			$.GetContextPanel().SetDialogVariableFloat('runtimediff', Math.abs(diff));
			$.GetContextPanel().SetDialogVariable('diffSymbol', diffSymbol);

			HudTimer.compLabel.AddClass(FADEOUT_START_CLASS);
			HudTimer.compLabel.TriggerClass(FADEOUT_CLASS);
		}

		HudTimer.prevZone = curZone;
	}

	static resetTimer() {
		$.GetContextPanel().SetDialogVariableFloat('runtime', 0);
		HudTimer.timeLabel.AddClass(INACTIVE_CLASS);
		HudTimer.compLabel.RemoveClass(FADEOUT_START_CLASS);
		HudTimer.compLabel.TriggerClass(FADEOUT_CLASS);
		HudTimer.prevZone = 0;
	}

	static onTimerEvent(type) {
		switch(type) {
			case TimerEvent.STARTED:
				HudTimer.onTimerStarted();
				break;
			case TimerEvent.FINISHED:
				HudTimer.onTimerFinished();
				break;
			case TimerEvent.STOPPED:
				HudTimer.onTimerStopped();
				break;
			case TimerEvent.FAILED:
				HudTimer.onTimerFailed();
				break;
			default:
				$.Warning('Unknown timer event given to Momentum hud timer!');
				break;
		}
	}

	static onSaveStateChange(_count, _current, _usingmenu) {
		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState !== TimerState.RUNNING) {
			HudTimer.resetTimer();
			HudTimer.timeLabel.RemoveClass(FINISHED_CLASS);
		}
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), HudTimer.onUpdate);
		$.RegisterForUnhandledEvent('OnMomentumTimerStateChange', HudTimer.onTimerEvent);
		$.RegisterForUnhandledEvent('OnMomentumZoneChange', HudTimer.onZoneChange);
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', HudTimer.onSaveStateChange);
		
		$.GetContextPanel().SetDialogVariableFloat('runtime', 0);
	}
}
