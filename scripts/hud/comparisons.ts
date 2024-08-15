const MAX_ACTIVE_SPLITS = 12;
const NEW_SPLIT_TRANSITION_DURATION = 2;

class HudComparisons {
	static runFinished = false;
	static currentZone = 0;
	static runStatsZoneIndex = 0;

	static panels = {
		splits: $('#Splits')
		// compare: $('#Compare')
	};

	static {
		$.RegisterEventHandler('HudCompare_Update', $.GetContextPanel(), this.updateComparisons.bind(this));
		$.RegisterForUnhandledEvent('OnMomentumTimerStateChange', this.onTimerEvent.bind(this));
	}

	static clearComparisons() {
		// this.panels.compare.RemoveAndDeleteChildren();
		this.panels.splits.RemoveAndDeleteChildren();
		this.runFinished = false;
		this.currentZone = 0;
		this.runStatsZoneIndex = 0;
	}

	static onTimerEvent(_ent, eventType) {
		if (eventType === TimerEvent.STARTED) {
			this.clearComparisons();
		}
	}

	static updateComparisons() {
		const currentData = $.GetContextPanel().currentRunData;
		const currentStats = $.GetContextPanel().currentRunStats;
		const comparisonRun = RunComparisonsAPI.GetLoadedComparison();

		const hasCompare = !!comparisonRun.compareRun;

		if (
			!currentData ||
			!currentData.isInZone ||
			!currentStats ||
			currentData.currentZone === 1 ||
			currentData.timerState === TimerState.PRACTICE
		) {
			return;
		}

		// Here, this.currentZone tracks how far into the run we are, so we can compare against currentData.currentZone,
		// so we don't fire on stage we've already hit.
		// this.runStatsZoneIndex tracks the correct index into the runStats array

		if (currentData.timerState === TimerState.NOTRUNNING) {
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
		if (splitPanels.length > MAX_ACTIVE_SPLITS) {
			for (const panel of splitPanels.filter((_, i) => splitPanels.length - i > MAX_ACTIVE_SPLITS))
				panel.RemoveAndDeleteChildren();
		}

		const data = hasCompare
			? Comparison.generateSplits(
					new RunStats(currentStats, currentData.tickRate),
					new RunStats(comparisonRun.compareRun.stats, currentData.tickRate),
					this.runStatsZoneIndex + 1
			  )[this.runStatsZoneIndex]
			: new RunStats(currentStats, currentData.tickRate, this.runStatsZoneIndex + 1).zones[
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
						diff: data.diff,
						delta: data.delta
				  }
				: {
						name: data.name,
						time: data.accumulateTime,
						isFirst: true
				  }
		);
	}
}
