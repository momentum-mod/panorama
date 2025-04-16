import { PanelHandler } from 'util/module-helpers';
import { HideHud } from 'common/state';
import { TimerState } from 'common/timer';
import { TrackType } from 'common/web';

@PanelHandler()
class HudStatusHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudStatus>(),
		label: $<Label>('#HudStatusLabel')!
	};

	constructor() {
		$.GetContextPanel<MomHudStatus>().hiddenHUDBits = HideHud.TABMENU;

		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', () => {
			this.update();
		});

		$.RegisterForUnhandledEvent('OnObservedTimerCheckpointProgressed', () => {
			this.update();
		});

		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', () => {
			this.timerInteractedWith = true;
			// Don't show savestate stuff if we start watching replay/specing
			// Though note you don't get savestate stuff back on exiting replay/specing
			// until you do savestate stuff again - don't have a good solution to that.
			this.saveStatesActive = false;
			this.update();
		});

		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', (enabled) => {
			this.inPracticeMode = enabled;
			this.timerInteractedWith = true;
			this.update();
		});

		// Called when savestates added, removed, all removed, teleported to, menu closed
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', (count, current, usingMenu) => {
			// usingMenu has very specific behaviour; defaults to false,
			// set true when you teleport to a saveloc (incl with console command), not on saveloc ceration
			// set false when menu is closed, and on level shutdown
			//
			// So toggling whether we show savestate info in status based on this is okay - presumably intended.
			// It become enabled until you actually teleport to a savestate,
			// then stays enabled until menu closes or level changes.
			this.saveStatesActive = usingMenu;
			this.saveStateCount = count;
			this.saveStateCurrent = current + 1; // need 1-indexing for display

			this.timerInteractedWith = true;
			this.update();
		});

		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
			this.timerInteractedWith = false;
			this.saveStatesActive = false;
			this.inPracticeMode = false;
			this.update();
		});
	}

	saveStatesActive = false;
	saveStateCount = 0;
	saveStateCurrent = 0;

	inPracticeMode = false;

	// Whether player has doing anything timer related yet, e.g. primed, started, savelocced, used practice mode.
	timerInteractedWith = false;

	update() {
		let text = this.getTimerText();

		if (this.saveStatesActive) {
			text = `${this.strs.saveState} ${this.saveStateCurrent}/${this.saveStateCount} | ${text}`;
		}

		if (this.inPracticeMode) {
			text = `${this.strs.practiceMode} | ${text}`;
		}

		this.panels.cp.SetHasClass('hudstatus--hidden', !this.timerInteractedWith);

		this.panels.label.text = text;
	}

	private getTimerText(): string {
		const { state, trackId, segmentsCount, segmentCheckpointsCount, majorNum, minorNum } =
			MomentumTimerAPI.GetObservedTimerStatus();

		if (state === TimerState.DISABLED) {
			return this.strs.disabled;
		}

		// Timer has been interacted with if it's not disabled
		this.timerInteractedWith = true;

		if (state === TimerState.PRIMED) {
			let str = this.strs.primed + ' | ';
			if (trackId.type === TrackType.MAIN) {
				str += this.strs.mainTrack;
			} else if (trackId.type === TrackType.STAGE) {
				str += `${this.strs.stage} ${trackId.number}`;
			} else {
				str += `${this.strs.bonus} ${trackId.number}`;
			}

			return str;
		}

		if (state === TimerState.FINISHED) {
			return this.strs.finished;
		}

		// state is TimerState.RUNNING
		if (trackId.type === TrackType.MAIN) {
			if (segmentsCount === 1) {
				return segmentCheckpointsCount > 1 ? `${this.strs.cp} ${minorNum}/${segmentCheckpointsCount}` : '';
			} else {
				return segmentCheckpointsCount > 1
					? `${this.strs.stage} ${majorNum}/${segmentsCount} | ${this.strs.cp} ${minorNum}/${segmentCheckpointsCount}`
					: `${this.strs.stage} ${majorNum}/${segmentsCount}`;
			}
		} else if (trackId.type === TrackType.STAGE) {
			return segmentCheckpointsCount > 1
				? `${this.strs.stage} ${trackId.number} | ${this.strs.cp} ${minorNum}/${segmentCheckpointsCount}`
				: `${this.strs.stage} ${trackId.number}`;
		} else {
			// Bonus
			return segmentCheckpointsCount > 1
				? `${this.strs.bonus} ${trackId.number} | ${this.strs.cp} ${minorNum}/${segmentCheckpointsCount}`
				: `${this.strs.bonus} ${trackId.number}`;
		}
	}

	// Cache strings to save endless $.Localize calls
	readonly strs = {
		disabled: $.Localize('#Timer_Disabled'),
		primed: $.Localize('#Timer_Primed'),
		finished: $.Localize('#Timer_Finished'),
		mainTrack: $.Localize('#Timer_Main'),
		cp: $.Localize('#Timer_Checkpoint'),
		stage: $.Localize('#Timer_Stage'),
		bonus: $.Localize('#Timer_Bonus'),
		saveState: $.Localize('#Timer_SaveState'),
		practiceMode: $.Localize('#Timer_PracticeMode')
	};
}
