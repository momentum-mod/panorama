import { PanelHandler } from 'util/module-helpers';
import { HideHud } from 'common/state';
import { TimerEvent_OLD, TimerState, TimerState_OLD } from 'common/timer';

const INACTIVE_CLASS = 'hudtimer__time--inactive';
const FINISHED_CLASS = 'hudtimer__time--finished';
const FAILED_CLASS = 'hudtimer__time--failed';

const INCREASE_CLASS = 'hudtimer__comparison--increase';
const DECREASE_CLASS = 'hudtimer__comparison--decrease';
const FADEOUT_CLASS = 'hudtimer__comparison--fadeout';
const FADEOUT_START_CLASS = 'hudtimer__comparison--fade-start';

@PanelHandler()
class HudTimerHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTimer>(),
		time: $('#HudTimerTime'),
		comparison: $('#HudTimerComparison')
	};

	prevZone = 0;

	constructor() {
		$.RegisterEventHandler('HudProcessInput', this.panels.cp, () => this.onUpdate());
		$.RegisterForUnhandledEvent('OnMomentumTimerStateChange', (arg1, arg2) => this.onTimerEvent(arg1, arg2));
		$.RegisterForUnhandledEvent(
			'OnMomentumZoneChange',
			(entering, isLinear, currentZone, currentTrack, timerState) =>
				this.onZoneChange(entering, isLinear, currentZone, currentTrack, timerState)
		);
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', (count, current, usingMenu) =>
			this.onSaveStateChange(count, current, usingMenu)
		);
		$.RegisterForUnhandledEvent('OnMomentumReplayStopped', () => this.onReplayStopped());

		this.panels.cp.SetDialogVariableFloat('runtime', 0);
		this.panels.cp.hiddenHUDBits = HideHud.TABMENU;

		// NEW
		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', () => this.onTimerStateChange());
		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', () => this.onTimerReplaced());
	}

	onTimerStarted() {
		this.panels.time.RemoveClass(FAILED_CLASS); // fail animation could be happening, so force stop
		this.panels.time.RemoveClass(INACTIVE_CLASS);

		if (this.isStartSoundEnabled) {
			$.PlaySoundEvent('Momentum.StartTimer');
		}
	}

	onTimerFinished() {
		this.panels.time.AddClass(FINISHED_CLASS);

		$.GetContextPanel().SetDialogVariableFloat('runtime', MomentumTimerAPI.GetCurrentRunTime());

		if (this.isFinishSoundEnabled) {
			$.PlaySoundEvent('Momentum.FinishTimer');
		}
	}

	onTimerStopped() {
		this.resetTimer();

		// if we want special styling for timer artificially running (via savestate), do it here like so
		// if (MomentumTimerAPI.GetTimerState() === Globals.Timer.State.PRACTICE) HudTimerthis.panels.time.AddClass(PRACTICE_CLASS);

		if (this.isStopSoundEnabled) {
			$.PlaySoundEvent('Momentum.StopTimer');
		}
	}

	onTimerFailed() {
		// failed to start timer, so resetting is not needed

		this.panels.time.TriggerClass(FAILED_CLASS);

		if (this.isFailSoundEnabled) {
			$.PlaySoundEvent('Momentum.FailedStartTimer');
		}
	}

	onUpdate() {
		this.panels.cp.SetDialogVariableFloat('runtime', MomentumTimerAPI.GetObservedTimerStatus().runTime);
	}

	onZoneChange(enter: any, linear: any, curZone: any, _curTrack: any, timerState: any) {
		if (timerState === TimerState_OLD.NOT_RUNNING && enter && curZone === 1) {
			// timer state is not reset on map finished until entering the start zone again (on reset)
			this.resetTimer();
			this.panels.time.RemoveClass(FINISHED_CLASS);
			return;
		}

		if (timerState === TimerState_OLD.RUNNING && curZone > 1 && enter === linear && this.prevZone !== curZone) {
			const diff = RunComparisonsAPI.GetLoadedComparisonOverallDiff(curZone);

			let diffSymbol;
			if (diff > 0) {
				this.panels.comparison.AddClass(DECREASE_CLASS);
				this.panels.comparison.RemoveClass(INCREASE_CLASS);
				diffSymbol = '+';
			} else if (diff < 0) {
				this.panels.comparison.AddClass(INCREASE_CLASS);
				this.panels.comparison.RemoveClass(DECREASE_CLASS);
				diffSymbol = '-';
			} else {
				this.panels.comparison.RemoveClass(INCREASE_CLASS);
				this.panels.comparison.RemoveClass(DECREASE_CLASS);
				diffSymbol = '';
			}

			this.panels.cp.SetDialogVariableFloat('runtimediff', Math.abs(diff));
			this.panels.cp.SetDialogVariable('diffSymbol', diffSymbol);

			this.panels.comparison.AddClass(FADEOUT_START_CLASS);
			this.panels.comparison.TriggerClass(FADEOUT_CLASS);
		}

		this.prevZone = curZone;
	}

	forceHideComparison() {
		this.panels.comparison.RemoveClass(FADEOUT_START_CLASS);
		this.panels.comparison.TriggerClass(FADEOUT_CLASS);
	}

	resetTimer() {
		this.panels.cp.SetDialogVariableFloat('runtime', 0);
		this.panels.time.AddClass(INACTIVE_CLASS);
		this.forceHideComparison();
		this.prevZone = 0;
	}

	onTimerEvent(_ent: any, type: any) {
		switch (type) {
			case TimerEvent_OLD.STARTED:
				this.onTimerStarted();
				break;
			case TimerEvent_OLD.FINISHED:
				this.onTimerFinished();
				break;
			case TimerEvent_OLD.STOPPED:
				this.onTimerStopped();
				break;
			case TimerEvent_OLD.FAILED:
				this.onTimerFailed();
				break;
			default:
				$.Warning('Unknown timer event given to Momentum hud timer!');
				break;
		}
	}

	onSaveStateChange(_count: any, _current: any, _usingmenu: any) {
		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState !== TimerState_OLD.RUNNING) {
			this.resetTimer();
			this.panels.time.RemoveClass(FINISHED_CLASS);
		}
	}

	onReplayStopped() {
		this.panels.time.RemoveClass(FINISHED_CLASS);

		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState !== TimerState_OLD.RUNNING) {
			this.resetTimer();
			return;
		}

		this.forceHideComparison();
		this.panels.time.RemoveClass(INACTIVE_CLASS);
		this.prevZone = ZonesAPI.GetCurrentZone(); // if curZone === 0 and the timer is running we have big problems
	}

	onTimerStateChange() {
		this.updateFullState();
		this.playStateSound();
	}

	onTimerReplaced() {
		this.updateFullState();
	}

	updateFullState() {
		const timerStatus = MomentumTimerAPI.GetObservedTimerStatus();

		switch (timerStatus.state) {
			case TimerState.DISABLED:
				this.panels.time.AddClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				break;
			case TimerState.RUNNING:
				this.panels.time.RemoveClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				break;
			case TimerState.FINISHED:
				this.panels.time.AddClass(FINISHED_CLASS);
				this.panels.time.RemoveClass(INACTIVE_CLASS);
				break;
			case TimerState.PRIMED:
				this.panels.time.AddClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				break;
			default:
				$.Warning('Unknown timer state');
				break;
		}

		this.panels.cp.SetDialogVariableFloat('runtime', MomentumTimerAPI.GetObservedTimerStatus().runTime);
	}

	playStateSound() {
		const timerStatus = MomentumTimerAPI.GetObservedTimerStatus();

		switch (timerStatus.state) {
			case TimerState.DISABLED:
				if (this.isStopSoundEnabled) $.PlaySoundEvent('Momentum.StopTimer');
				break;
			case TimerState.RUNNING:
				if (this.isStartSoundEnabled) $.PlaySoundEvent('Momentum.StartTimer');
				break;
			case TimerState.FINISHED:
				if (this.isFinishSoundEnabled) $.PlaySoundEvent('Momentum.FinishTimer');
				break;
			case TimerState.PRIMED:
				// no sound
				break;
			default:
				$.Warning('Unknown timer state');
				break;
		}
	}

	get isStartSoundEnabled(): boolean {
		return GameInterfaceAPI.GetSettingBool('mom_hud_timer_sound_start_enable');
	}

	get isFinishSoundEnabled(): boolean {
		return GameInterfaceAPI.GetSettingBool('mom_hud_timer_sound_finish_enable');
	}

	get isStopSoundEnabled(): boolean {
		return GameInterfaceAPI.GetSettingBool('mom_hud_timer_sound_stop_enable');
	}

	get isFailSoundEnabled(): boolean {
		return GameInterfaceAPI.GetSettingBool('mom_hud_timer_sound_fail_enable');
	}
}
