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
			this.hasTimerStateUpdated = true;
			this.update();
		});

		$.RegisterForUnhandledEvent('OnObservedTimerCheckpointProgressed', () => {
			this.hasTimerStateUpdated = true;
			this.update();
		});

		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', () => {
			// Don't show savestate stuff if we start watching replay/specing
			// Though note you don't get savestate stuff back on exiting replay/specing
			// until you do savestate stuff again - don't have a good solution to that.
			this.saveStatesActive = false;
			this.update();
		});

		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', (enabled) => {
			this.inPracticeMode = enabled;
			this.update();
		});

		// Called when savestates added, removed, all removed, teleported to, menu closed
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', (count, current, usingMenu) => {
			// usingMenu has very specific behaviour; defaults to false,
			// set true when you teleport to a saveloc (incl with console command), not on saveloc ceration
			// set false when menu is closed, and on level shutdown
			//
			// So toggling whether we show savestate info in status based on this is okay - presumably intended.
			// It becomes enabled until you actually teleport to a savestate,
			// then stays enabled until menu closes or level changes.
			this.saveStatesActive = usingMenu;
			this.saveStateCount = count;
			this.saveStateCurrent = current + 1; // need 1-indexing for display

			this.update();
		});

		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
			this.saveStatesActive = false;
			this.inPracticeMode = false;
			this.update();
		});
	}

	saveStatesActive = false;
	saveStateCount = 0;
	saveStateCurrent = 0;

	inPracticeMode = false;

	// Whether timer state has changed at all. Starting false means we won't show timer
	// status at all until you first enter a start zone. Avoids map with no zones showing
	// "Timer Disabled" all the time, or when starting in the spawn area of a map.
	hasTimerStateUpdated = false;

	update() {
		const strings = this.hasTimerStateUpdated ? [this.getTimerText()] : [];

		if (this.saveStatesActive) {
			strings.unshift(`${this.strs.saveState} ${this.saveStateCurrent}/${this.saveStateCount}`);
		}

		if (this.inPracticeMode) {
			strings.unshift(this.strs.practiceMode);
		}

		this.panels.cp.SetHasClass(
			'hudstatus--hidden',
			!this.saveStatesActive && !this.inPracticeMode && !this.hasTimerStateUpdated
		);

		this.panels.label.text = strings.join(' | ');
	}

	private getTimerText(): string {
		const { state, trackId, segmentsCount, segmentCheckpointsCount, majorNum, minorNum } =
			MomentumTimerAPI.GetObservedTimerStatus();

		const gamemode = GameModeAPI.GetCurrentGameMode();
		const segmentTerm = $.Localize(GameModeAPI.GetGameModeSegmentToken(gamemode));
		const checkpointTerm = $.Localize(GameModeAPI.GetGameModeCheckpointToken(gamemode));

		if (state === TimerState.DISABLED) {
			return this.strs.disabled;
		}

		// Timer has been interacted with if it's not disabled
		this.hasTimerStateUpdated = true;

		if (state === TimerState.PRIMED) {
			let str = this.strs.primed + ' | ';
			if (trackId.type === TrackType.MAIN) {
				str += this.strs.mainTrack;
			} else if (trackId.type === TrackType.STAGE) {
				str += `${segmentTerm} ${trackId.number}`;
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
				return segmentCheckpointsCount > 1 ? `${checkpointTerm} ${minorNum}/${segmentCheckpointsCount}` : '';
			} else {
				return segmentCheckpointsCount > 1
					? `${segmentTerm} ${majorNum}/${segmentsCount} | ${checkpointTerm} ${minorNum}/${segmentCheckpointsCount}`
					: `${segmentTerm} ${majorNum}/${segmentsCount}`;
			}
		} else if (trackId.type === TrackType.STAGE) {
			return segmentCheckpointsCount > 1
				? `${segmentTerm} ${trackId.number} | ${checkpointTerm} ${minorNum}/${segmentCheckpointsCount}`
				: `${segmentTerm} ${trackId.number}`;
		} else {
			// Bonus
			return segmentCheckpointsCount > 1
				? `${this.strs.bonus} ${trackId.number} | ${checkpointTerm} ${minorNum}/${segmentCheckpointsCount}`
				: `${this.strs.bonus} ${trackId.number}`;
		}
	}

	// Cache strings to save endless $.Localize calls
	readonly strs = {
		disabled: $.Localize('#Timer_Disabled'),
		primed: $.Localize('#Timer_Primed'),
		finished: $.Localize('#Timer_Finished'),
		mainTrack: $.Localize('#Timer_Main_Track'),
		bonus: $.Localize('#Timer_Bonus'),
		saveState: $.Localize('#Timer_SaveState'),
		practiceMode: $.Localize('#Timer_PracticeMode')
	};
}
