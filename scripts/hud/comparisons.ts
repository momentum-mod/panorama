import { PanelHandler } from 'util/module-helpers';
import { TimerEvent_OLD, TimerState_OLD } from 'common/timer';
import { Comparison_OLD, RunStats_OLD, Split_OLD } from 'common/timer';

@PanelHandler()
class HudComparisonsHandler {
	runFinished = false;
	currentZone = 0;
	runStatsZoneIndex = 0;

	readonly maxActiveSplits = 12;
	readonly newSplitTransitionDuration = 2;

	readonly panels = {
		splits: $<Panel>('#Splits')
		// compare: $('#Compare')
	};

	constructor() {
		$.RegisterEventHandler('HudCompare_Update', $.GetContextPanel(), () => this.updateComparisons());
		$.RegisterForUnhandledEvent('OnMomentumTimerStateChange', (arg, arg2) => this.onTimerEvent(arg, arg2));
	}

	clearComparisons() {
		// this.panels.compare.RemoveAndDeleteChildren();
		this.panels.splits.RemoveAndDeleteChildren();
		this.runFinished = false;
		this.currentZone = 0;
		this.runStatsZoneIndex = 0;
	}

	onTimerEvent(_ent: any, eventType: any) {
		if (eventType === TimerEvent_OLD.STARTED) {
			this.clearComparisons();
		}
	}

	updateComparisons() {
		/* TODO
		const currentData = $.GetContextPanel<HudComparisons>().currentRunData;
		const currentStats = $.GetContextPanel<HudComparisons>().currentRunStats;
		const comparisonRun = RunComparisonsAPI.GetLoadedComparison();

		const hasCompare = !!comparisonRun.compareRun;

		if (
			!currentData ||
			!currentData.isInZone ||
			!currentStats ||
			currentData.currentZone === 1 ||
			currentData.timerState === TimerState_OLD.PRACTICE
		) {
			return;
		}

		// Here, this.currentZone tracks how far into the run we are, so we can compare against currentData.currentZone,
		// so we don't fire on stage we've already hit.
		// this.runStatsZoneIndex tracks the correct index into the runStats array

		if (currentData.timerState === TimerState_OLD.NOT_RUNNING) {
			// The only time we care about comparisons when timer is not running is if you just
			// hit the end zone *for the first time*
			if (!this.runFinished && currentData.currentZone === 0) {
				// We're at the last zone, set index to last in the RunStats zone array
				this.runStatsZoneIndex = currentStats.numZones - 1;
				this.currentZone = 0;

				// Track that we've finished so this never runs again
				this.runFinished = true;
			} else {
				return;
			}
		} else {
			// Return out if you went back a zone
			if (currentData.currentZone <= this.currentZone) {
				return;
			} else {
				// This is the first time you hit this zone
				this.currentZone = currentData.currentZone;
				this.runStatsZoneIndex = currentData.currentZone - 2; // -2 but currentZone is offset by the end and start zones
			}
		}

		const splitPanels = this.panels.splits.Children().reverse();
		if (splitPanels.length > this.maxActiveSplits) {
			for (const panel of splitPanels.filter((_, i) => splitPanels.length - i > this.maxActiveSplits))
				panel.RemoveAndDeleteChildren();
		}

		const data = hasCompare
			? Comparison_OLD.generateSplits(
					new RunStats_OLD(currentStats, currentData.tickRate),
					new RunStats_OLD(comparisonRun.compareRun.stats, currentData.tickRate)
					// this.runStatsZoneIndex + 1 TODO: this was being passed to generateSplits, but that only takes two args. What was this for?
				)[this.runStatsZoneIndex]
			: new RunStats_OLD(currentStats, currentData.tickRate, this.runStatsZoneIndex + 1).zones[
					this.runStatsZoneIndex
				];

		const wrapper = $.CreatePanel('Panel', this.panels.splits, `Split${data.name}`, {
			class: 'hud-comparisons__split'
		});

		if (this.runStatsZoneIndex > 0) {
			const lastSplit = this.panels.splits.GetFirstChild().GetFirstChild();
			lastSplit?.RemoveClass('split--latest');
		}

		this.panels.splits.MoveChildBefore(wrapper, this.panels.splits.Children()[0]);

		const panel = $.CreatePanel('Split', wrapper, '', { class: 'split--hud split--latest' });

		// Animation code I might try in 0.9.2

		// Avoids hardcoding a height value. Waits for one split to spawn and have correct height, then tracks it.
		// Means first one won't animate height but that's fine as there's nothing for it to push upwards
		// $.Schedule(0.05, () => (this.latestSplitHeight ??= panel.actuallayoutheight / panel.actualuiscale_y));

		// if (!this.latestSplitHeight) return;

		// panel.style.height = `${this.latestSplitHeight}px`;
		// wrapper.style.transitionDuration = '0s';
		// wrapper.style.height = '0px';
		// wrapper.style.transitionDuration = `${NEW_SPLIT_TRANSITION_DURATION}s`;
		// wrapper.style.height = `${this.latestSplitHeight}px`;

		Object.assign(
			panel,
			hasCompare
				? {
						name: data.name,
						time: data.accumulateTime,
						isFirst: false,
						diff: (data as Split_OLD).diff,
						delta: (data as Split_OLD).delta
					}
				: {
						name: data.name,
						time: data.accumulateTime,
						isFirst: true
					}
		);
		*/
	}
}
