import { PanelHandler } from 'util/module-helpers';
import { Comparison, RunMetadata, ComparisonSplit, TimerState, RunSplits } from 'common/timer';

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

		this.panels.splits.RemoveAndDeleteChildren();

		// TODO: Regenerate comparisons with new info
		//this.updateComparisons();
	}

	updateComparisons() {
		const timerStatus = MomentumTimerAPI.GetObservedTimerStatus();
		const runSplits = MomentumTimerAPI.GetObservedTimerRunSplits();

		if (timerStatus.state === TimerState.PRIMED) {
			this.panels.splits.RemoveAndDeleteChildren();
			return;
		}

		const hasCompare =
			!!this.comparison &&
			timerStatus.trackId.type === this.comparison.trackId.type &&
			timerStatus.trackId.number === this.comparison.trackId.number;

		// TODO: Unordered/optional splits
		// TODO: Subsegment splits
		if (timerStatus.state === TimerState.RUNNING) {
			if (timerStatus.majorNum <= 1 || timerStatus.minorNum > 1) {
				return;
			}

			const split = hasCompare
				? Comparison.generateSplits(runSplits, this.comparison.runSplits)[timerStatus.majorNum - 1]
				: {
						name: timerStatus.majorNum - 1,
						accumulateTime: timerStatus.runTime
					};

			this.addComparisonSplit(split, timerStatus.majorNum, hasCompare);
		} else if (timerStatus.state === TimerState.FINISHED) {
			const split = hasCompare
				? Comparison.generateFinishSplit(
						timerStatus.runTime,
						runSplits,
						this.comparison.runTime,
						this.comparison.runSplits
					)
				: {
						name: runSplits.segments.length.toString(),
						accumulateTime: timerStatus.runTime
					};

			this.addComparisonSplit(split, timerStatus.majorNum, hasCompare);
		}
	}

	addComparisonSplit(split: any, majorNum: number, hasCompare: boolean): void {
		const splitPanels = this.panels.splits.Children().reverse();
		if (splitPanels.length > this.maxActiveSplits) {
			splitPanels
				.filter((_, i) => splitPanels.length - i > this.maxActiveSplits)
				.forEach((panel) => panel.RemoveAndDeleteChildren());
		}

		const wrapper = $.CreatePanel('Panel', this.panels.splits, `Split${split.name}`, {
			class: 'hud-comparisons__split'
		});

		if (majorNum > 1) {
			const lastSplit = this.panels.splits.GetFirstChild().GetFirstChild();
			lastSplit?.RemoveClass('split--latest');
		}

		this.panels.splits.MoveChildBefore(wrapper, this.panels.splits.Children()[0]);

		const panel = $.CreatePanel('Split', wrapper, '', { class: 'split--hud split--latest' });

		Object.assign(
			panel,
			hasCompare
				? {
						name: split.name,
						time: split.accumulateTime,
						isFirst: false,
						diff: (split as ComparisonSplit).diff,
						delta: (split as ComparisonSplit).delta
					}
				: {
						name: split.name,
						time: split.accumulateTime,
						isFirst: true
					}
		);
	}
}
