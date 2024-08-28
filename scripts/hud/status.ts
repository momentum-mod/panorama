import { PanelHandler } from 'util/module-helpers';
import { HideHud } from 'common/state';
import { TimerState } from 'common/timer';
import { TrackType } from 'common/web';

@PanelHandler()
class HudStatusHandler {
	label = $<Label>('#HudStatusLabel');

	constructor() {
		$.RegisterForUnhandledEvent('OnMomentumPlayerPracticeModeStateChange', (enabled) =>
			this.onPracticeModeChange(enabled)
		);
		$.RegisterForUnhandledEvent('OnSaveStateUpdate', (count, current, usingMenu) =>
			this.onSaveStateChange(count, current, usingMenu)
		);
		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', (_trackID) => this.update());
		$.RegisterForUnhandledEvent('OnObservedTimerCheckpointProgressed', (_trackID) => this.update());
		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', () => this.update());

		$.GetContextPanel<MomHudStatus>().hiddenHUDBits = HideHud.TABMENU;

		this.label.text = $.Localize('#HudStatus_Spawn');
	}

	inPracticeMode = false;

	saveStateCount = 0;
	saveStateCurrent = 0;
	saveStateUsing = false;

	onPracticeModeChange(enabled: boolean) {
		this.inPracticeMode = enabled;
		this.update();
	}

	onSaveStateChange(count: number, current: number, usingMenu: boolean) {
		this.saveStateCount = count;
		this.saveStateCurrent = current + 1; // need 1-indexing for display
		this.saveStateUsing = usingMenu;

		this.update();
	}

	update() {
		let text = this.getTimerText();

		// TODO: maybe show these somewhere else instead of prepending tons of stuff
		if (this.saveStateUsing) {
			text = `${this.strs.saveState} ${this.saveStateCurrent}/${this.saveStateCount} | ${text}`;
		}

		if (this.inPracticeMode) {
			text = `${this.strs.practiceMode} | ${text}`;
		}

		this.label.text = text;
	}

	private getTimerText(): string {
		const { state, trackId, segmentsCount, segmentCheckpointsCount, majorNum, minorNum } =
			MomentumTimerAPI.GetObservedTimerStatus();

		if (state === TimerState.DISABLED) {
			return $.Localize('#HudStatus_TimerDisabled');
		}

		if (state === TimerState.PRIMED) {
			return $.Localize('#HudStatus_TimerPrimed');
		}

		if (state === TimerState.FINISHED) {
			return $.Localize('#HudStatus_TimerFinished');
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
		cp: $.Localize('#HudStatus_Checkpoint'),
		stage: $.Localize('#HudStatus_Stage'),
		bonus: $.Localize('#HudStatus_Bonus'),
		saveState: $.Localize('#HudStatus_SaveState'),
		practiceMode: $.Localize('#HudStatus_PracticeMode')
	};
}
