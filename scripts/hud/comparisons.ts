import { PanelHandler } from 'util/module-helpers';
import { RunMetadata } from 'common/timer';

@PanelHandler()
class HudComparisonsHandler {
	comparison: RunMetadata = null;

	readonly maxActiveSplits = 12;
	readonly newSplitTransitionDuration = 2;

	readonly panels = {
		splits: $<Panel>('#Splits')
		// compare: $('#Compare')
	};

	constructor() {
		$.RegisterForUnhandledEvent('ComparisonRunUpdated', () => this.onComparisonRunUpdated());
		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', () => this.updateComparisons());
		$.RegisterForUnhandledEvent('OnObservedTimerCheckpointProgressed', () => this.updateComparisons());
		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', () => this.updateComparisons());
	}

	onComparisonRunUpdated() {
		this.comparison = RunComparisonsAPI.GetComparisonRun();

		$.Msg(`Got comparison run ${this.comparison?.filePath ?? 'NONE'}`);

		if (this.comparison) {
			$.Msg(`jumps: ${this.comparison.runSplits.trackStats.jumps}`);
		}

		this.updateComparisons();
	}

	updateComparisons() {
		const timerStatus = MomentumTimerAPI.GetObservedTimerStatus();
		const runSplits = MomentumTimerAPI.GetObservedTimerRunSplits();

		if (
			timerStatus.trackId.type === this.comparison.trackId.type &&
			timerStatus.trackId.number === this.comparison.trackId.number
			// eslint-disable-next-line no-empty
		) {
		} else {
			// Track differs -- could maybe do a best-effort comparison if one is a stage and one is the main track,
			// otherwise make sure the comparison HUD is cleared
		}
	}
}
