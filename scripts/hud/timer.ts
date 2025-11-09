import { PanelHandler } from 'util/module-helpers';
import { HideHud } from 'common/state';
import * as Timer from 'common/timer';
import { registerHUDCustomizerComponent } from '../common/hud-customizer';

const DIFF_DISPLAY_TIME = 5;
const HIDDEN_CLASS = 'hudtimer--hidden';
const INACTIVE_CLASS = 'hudtimer__time--inactive';
const FINISHED_CLASS = 'hudtimer__time--finished';
const INCREASE_CLASS = 'hudtimer__comparison--increase';
const DECREASE_CLASS = 'hudtimer__comparison--decrease';
const ENABLE_FADE_CLASS = 'hudtimer__comparison--enable-fade';

@PanelHandler()
class HudTimerHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTimer>()!,
		time: $('#HudTimerTime')!,
		comparison: $('#HudTimerComparison')!
	};

	comparison: RunMetadata | null = null;
	fadeoutScheduleId: uuid | null = null;

	constructor() {
		this.panels.cp.SetDialogVariableFloat('runtime', 0);
		this.panels.cp.hiddenHUDBits = HideHud.TABMENU;

		$.RegisterEventHandler('HudProcessInput', this.panels.cp, () => {
			// Each frame just needs to update time, everything else is more specific events.
			this.panels.cp.SetDialogVariableFloat('runtime', MomentumTimerAPI.GetObservedTimerStatus().runTime);
		});

		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', () => {
			// Update core styling whenever timer state changes
			this.updateMainState();

			// Update diff as well to handle setting diff on track finish
			this.updateDiff();

			// This is only event where we care about playing a sound
			this.playStateSound();
		});

		$.RegisterForUnhandledEvent('OnObservedTimerCheckpointProgressed', () => {
			this.updateDiff();
		});

		$.RegisterForUnhandledEvent('ComparisonRunUpdated', () => {
			this.comparison = RunComparisonsAPI.GetComparisonRun();
		});

		$.RegisterForUnhandledEvent('OnSaveStateUpdate', () => {
			// If we load a savestate, update base timer classes based on whatever
			// the run state is, don't bother with comparisons.
			this.updateMainState();
			this.forceHideComparison();
		});

		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', () => {
			// Same as savestates, major change just happened, update main state
			// and ditch any comparisons.
			this.updateMainState();
			this.forceHideComparison();
		});

		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
			// Hide everything on level load until time is interacted with in
			// some way - same as HudStatus.
			this.panels.cp.AddClass(HIDDEN_CLASS);
			this.forceHideComparison();
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false
		});
	}

	updateMainState() {
		const { state } = MomentumTimerAPI.GetObservedTimerStatus();

		switch (state) {
			case Timer.TimerState.DISABLED:
				this.panels.time.AddClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				this.forceHideComparison();
				break;
			case Timer.TimerState.RUNNING:
				this.panels.time.RemoveClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				this.panels.cp.RemoveClass(HIDDEN_CLASS);
				break;
			case Timer.TimerState.FINISHED:
				this.panels.time.AddClass(FINISHED_CLASS);
				this.panels.time.RemoveClass(INACTIVE_CLASS);
				this.panels.cp.RemoveClass(HIDDEN_CLASS);
				break;
			case Timer.TimerState.PRIMED:
				this.panels.time.AddClass(INACTIVE_CLASS);
				this.panels.time.RemoveClass(FINISHED_CLASS);
				this.panels.cp.RemoveClass(HIDDEN_CLASS);
				this.forceHideComparison();
				break;
		}
	}

	updateDiff() {
		if (!this.comparison) return;

		const { state, trackId, majorNum, minorNum, runTime, segmentsCount, segmentCheckpointsCount } =
			MomentumTimerAPI.GetObservedTimerStatus();

		const metadata = MomentumTimerAPI.GetObservedRunMetadata();

		if (
			trackId.type !== this.comparison.trackId.type ||
			trackId.number !== this.comparison.trackId.number ||
			state === Timer.TimerState.PRIMED ||
			state === Timer.TimerState.DISABLED ||
			metadata?.tempId === this.comparison.tempId
		) {
			this.forceHideComparison();
			return;
		}

		const splits = MomentumTimerAPI.GetObservedTimerRunSplits();

		let diff = 0;
		if (state === Timer.TimerState.RUNNING) {
			if (majorNum === 1 && minorNum === 1) return;

			diff =
				Timer.generateSplit(
					splits,
					this.comparison.runSplits,
					majorNum,
					minorNum,
					segmentsCount,
					segmentCheckpointsCount,
					true
				).diff ?? 0;
		} else if (state === Timer.TimerState.FINISHED) {
			diff = runTime - this.comparison.runTime;
		}

		let diffSymbol: string;
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

		this.cancelFadeout();

		this.panels.comparison.RemoveClass(ENABLE_FADE_CLASS);
		this.panels.comparison.style.opacity = 1;

		this.panels.cp.SetDialogVariableFloat('runtime_diff', Math.abs(diff));
		this.panels.cp.SetDialogVariable('diff_symbol', diffSymbol);

		// Used to do this fade using a custom cubic-bezier but looks off for such a long duration,
		// keyframing is annoying, just JS is fine.
		this.fadeoutScheduleId = $.Schedule(DIFF_DISPLAY_TIME, () => {
			this.panels.comparison.AddClass(ENABLE_FADE_CLASS);
			this.panels.comparison.style.opacity = 0;
			this.fadeoutScheduleId = null;
		});
	}

	forceHideComparison() {
		this.cancelFadeout();

		this.panels.comparison.RemoveClass(ENABLE_FADE_CLASS);
		this.panels.comparison.style.opacity = 0;
	}

	cancelFadeout() {
		if (this.fadeoutScheduleId) {
			$.CancelScheduled(this.fadeoutScheduleId);
			this.fadeoutScheduleId = null;
		}
	}

	playStateSound() {
		const { state } = MomentumTimerAPI.GetObservedTimerStatus();

		switch (state) {
			case Timer.TimerState.DISABLED:
				if (this.isStopSoundEnabled) {
					$.PlaySoundEvent('Momentum.StopTimer');
				}
				break;
			case Timer.TimerState.RUNNING:
				if (this.isStartSoundEnabled) {
					$.PlaySoundEvent('Momentum.StartTimer');
				}
				break;
			case Timer.TimerState.FINISHED:
				if (this.isFinishSoundEnabled) {
					$.PlaySoundEvent('Momentum.FinishTimer');
				}
				break;
			case Timer.TimerState.PRIMED:
				// no sound
				break;
			default:
				$.Warning('Unknown timer state');
				break;
		}
	}

	get isStartSoundEnabled(): boolean {
		return GameInterfaceAPI.GetSettingBool('mom_timer_start_sound');
	}

	get isFinishSoundEnabled(): boolean {
		return GameInterfaceAPI.GetSettingBool('mom_timer_finish_sound');
	}

	get isStopSoundEnabled(): boolean {
		return GameInterfaceAPI.GetSettingBool('mom_timer_disable_sound');
	}
}
