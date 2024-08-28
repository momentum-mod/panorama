import { PanelHandler } from 'util/module-helpers';
import { HideHud } from 'common/state';
import { TimerState } from '../common/timer';

const INACTIVE_CLASS = 'hudtimer__time--inactive';
const FINISHED_CLASS = 'hudtimer__time--finished';
const FAILED_CLASS = 'hudtimer__time--failed';

const INCREASE_CLASS = 'hudtimer__comparison--increase';
const DECREASE_CLASS = 'hudtimer__comparison--decrease';
const FADEOUT_CLASS = 'hudtimer__comparison--fadeout';
const FADEOUT_START_CLASS = 'hudtimer__comparison--fade-start';

@PanelHandler()
class HudTimer {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTimer>(),
		time: $('#HudTimerTime'),
		comparison: $('#HudTimerComparison')
	};

	prevZone = 0;
	previousState = TimerState.DISABLED;

	constructor() {
		this.panels.cp.SetDialogVariableFloat('runtime', 0);
		this.panels.cp.hiddenHUDBits = HideHud.TABMENU;

		$.RegisterEventHandler('HudProcessInput', this.panels.cp, () => this.onUpdate());

		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', (_trackID) => {
			this.updateFullState();
			this.playStateChangeSound();
		});
		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', () => {
			this.updateFullState();
		});

		$.RegisterForUnhandledEvent('OnSaveStateUpdate', () => this.onSaveStateChange());
		$.RegisterForUnhandledEvent('OnMomentumReplayStopped', () => this.onReplayStopped());
	}

	timerHandler: uuid | null = null;

	updateTimerValue() {
		this.panels.cp.SetDialogVariableFloat('runtime', MomentumTimerAPI.GetObservedTimerStatus().runTime);
	}

	startRunningTimer() {
		this.timerHandler = $.RegisterEventHandler('HudProcessInput', this.panels.cp, () => this.updateTimerValue());
	}

	stopRunningTimer() {
		if (!this.timerHandler) return;

		$.UnregisterEventHandler('HudProcessInput', this.panels.cp, this.timerHandler);
		this.timerHandler = null;
	}

	onZoneChange(enter, linear, curZone, _curTrack, timerState) {
		if (timerState === TimerState.NOTRUNNING && enter && curZone === 1) {
			// timer state is not reset on map finished until entering the start zone again (on reset)
			this.resetTimer();
			this.panels.time.RemoveClass(FINISHED_CLASS);
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

			this.panels.cp.SetDialogVariableFloat('runtimediff', Math.abs(diff));
			this.panels.cp.SetDialogVariable('diffSymbol', diffSymbol);

			this.compLabel.AddClass(FADEOUT_START_CLASS);
			this.compLabel.TriggerClass(FADEOUT_CLASS);
		}

		this.prevZone = curZone;
	}

	forceHideComparison() {
		this.compLabel.RemoveClass(FADEOUT_START_CLASS);
		this.compLabel.TriggerClass(FADEOUT_CLASS);
	}

	resetTimer() {
		this.panels.cp.SetDialogVariableFloat('runtime', 0);
		this.panels.time.AddClass(INACTIVE_CLASS);
		this.forceHideComparison();
		this.prevZone = 0;
	}

	onSaveStateChange() {
		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState !== TimerState.RUNNING) {
			this.resetTimer();
			this.panels.time.RemoveClass(FINISHED_CLASS);
		}
	}

	onReplayStopped() {
		this.panels.time.RemoveClass(FINISHED_CLASS);

		const timerState = MomentumTimerAPI.GetTimerState();
		if (timerState !== TimerState.RUNNING) {
			this.resetTimer();
			return;
		}

		this.forceHideComparison();
		this.panels.time.RemoveClass(INACTIVE_CLASS);
		this.prevZone = ZonesAPI.GetCurrentZone(); // if curZone === 0 and the timer is running we have big problems
	}

	updateFullState() {
		const timerStatus = MomentumTimerAPI.GetObservedTimerStatus();

		switch (timerStatus.state) {
			case TimerStateNEW.DISABLED:
				this.panels.time.AddClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				break;
			case TimerStateNEW.RUNNING:
				this.panels.time.RemoveClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				break;
			case TimerStateNEW.FINISHED:
				this.panels.time.AddClass(FINISHED_CLASS);
				this.panels.time.RemoveClass(INACTIVE_CLASS);
				break;
			case TimerStateNEW.PRIMED:
				this.panels.time.AddClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				break;
			default:
				$.Warning('Unknown timer state');
				break;
		}

		this.panels.cp.SetDialogVariableFloat('runtime', MomentumTimerAPI.GetObservedTimerStatus().runTime);
	}

	playStateChangeSound() {
		// TODO: Idk how to get whether we failed or not. This class needs a LOT of work.
		switch (MomentumTimerAPI.GetObservedTimerStatus().state) {
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
