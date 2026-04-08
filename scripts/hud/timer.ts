import { PanelHandler } from 'util/module-helpers';
import { HideHud } from 'common/state';
import * as Timer from 'common/timer';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

const DIFF_DISPLAY_TIME = 5;
const HIDDEN_CLASS = 'hudtimer--hidden';
const ENABLE_FADE_CLASS = 'hudtimer__comparison--enable-fade';

const Colors = {
	//Main timer colors
	INACTIVE: 'rgba(200, 200, 200, 1)',
	PRIMED: 'rgba(200, 200, 200, 1)',
	RUNNING: 'rgba(255, 255, 255, 1)',
	FINISHED: 'rgba(122, 238, 122, 1)',
	//Comparison colors
	INCREASE: 'rgba(16, 118, 168, 1)',
	DECREASE: 'rgba(255, 106, 106, 1)',
	INVISIBLE: 'rgba(0, 0, 0, 0)'
};

@PanelHandler()
class HudTimerHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTimer>()!,
		time: $('#HudTimerTime')!,
		comparison: $('#HudTimerComparison')!
	};

	comparison: RunMetadata | null = null;
	showComparison: boolean;
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
			resizeX: true,
			resizeY: false,
			dynamicStyles: {
				showComparisons: {
					name: 'Show Comparisons',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.showComparison = value;
					}
				},
				alignText: {
					name: 'Align Text',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['.hudtimer__time', '.hudtimer__comparison'],
					callbackFunc: (panel, value) => {
						switch (value) {
							case 0:
								panel.style.horizontalAlign = 'left';
								break;
							case 1:
								panel.style.horizontalAlign = 'center';
								break;
							case 2:
								panel.style.horizontalAlign = 'right';
								break;
						}
					},
					settingProps: { min: 0, max: 2 }
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: ['.hudtimer__time', '.hudtimer__comparison'],
					styleProperty: 'backgroundColor'
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.hudtimer__time',
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.hudtimer__time',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				comparisonFont: {
					name: 'Comparison Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.hudtimer__comparison',
					styleProperty: 'fontFamily'
				},
				comparisonFontSize: {
					name: 'Comparison Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.hudtimer__comparison',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				inactiveColor: {
					name: 'Inactive Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Colors.INACTIVE = value as color;
						this.updateMainState();
					}
				},
				primedColor: {
					name: 'Primed Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Colors.PRIMED = value as color;
						this.updateMainState();
					}
				},
				runningColor: {
					name: 'Running Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Colors.RUNNING = value as color;
						this.updateMainState();
					}
				},
				finishedColor: {
					name: 'Finished Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Colors.FINISHED = value as color;
						this.updateMainState();
					}
				},
				comparisonIncreaseColor: {
					name: 'Comparison Increase Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Colors.INCREASE = value as color;
					}
				},
				comparisonDecreaseColor: {
					name: 'Comparison Decrease Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Colors.DECREASE = value as color;
					}
				}
			}
		});
	}

	updateMainState() {
		const { state } = MomentumTimerAPI.GetObservedTimerStatus();

		switch (state) {
			case Timer.TimerState.DISABLED:
				this.panels.time.style.color = Colors.INACTIVE;
				this.panels.cp.RemoveClass(HIDDEN_CLASS);
				this.forceHideComparison();
				break;
			case Timer.TimerState.RUNNING:
				this.panels.time.style.color = Colors.RUNNING;
				this.panels.cp.RemoveClass(HIDDEN_CLASS);
				break;
			case Timer.TimerState.FINISHED:
				this.panels.time.style.color = Colors.FINISHED;
				this.panels.cp.RemoveClass(HIDDEN_CLASS);
				break;
			case Timer.TimerState.PRIMED:
				this.panels.time.style.color = Colors.PRIMED;
				this.panels.cp.RemoveClass(HIDDEN_CLASS);
				this.forceHideComparison();
				break;
		}
	}

	updateDiff() {
		if (!this.comparison || !this.showComparison) return;

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
			this.panels.comparison.style.color = Colors.DECREASE;
			diffSymbol = '+';
		} else if (diff < 0) {
			this.panels.comparison.style.color = Colors.INCREASE;
			diffSymbol = '-';
		} else {
			this.panels.comparison.style.color = Colors.INVISIBLE;
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
