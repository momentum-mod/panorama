import { PanelHandler } from 'util/module-helpers';
import * as Timer from 'common/timer';
import {
	BackgroundColorStyle,
	BorderStyles,
	CustomizerPropertyType,
	getHudCustomizer,
	MarginStyles,
	PaddingStyles,
	registerHUDCustomizerComponent
} from 'common/hud-customizer';

// MomTV networking limits max numbers of networked splits to 10; this value is
// immutable and used to build out our split panel arrays.
const MAX_SPLITS = 10;

// Each panel is a split "row", which are actually each in separate columns, to
// achieve grid spacing. To update, set props then call pushSplitUpdate.
interface SplitRow {
	name: Label;
	time: Label;
	diff: Label;
	split?: Timer.Split;
}

@PanelHandler()
class HudComparisonsHandler {
	readonly panels = {
		cp: $.GetContextPanel<HudComparisons>(),
		splits: {
			names: $<Panel>('#SplitNames')!,
			times: $<Panel>('#SplitTimes')!,
			diffs: $<Panel>('#SplitDiffs')!
		}
	};

	// tempID of controlled replay if we're watching a replay, otherwise null.
	controlledReplayID: number | null = null;
	comparison: Timer.RunMetadata | null = null;

	// Build out our permanent split panel array. This classes's job is ultimately to just tweak
	// each panel's properties as needed.
	// Code is simpler is the most recent split is at the front of the array, and the container has a
	// `flow-children: up;` layout.
	splitRows: SplitRow[] = Array.from({ length: MAX_SPLITS }, (_, i) => ({
		name: $.CreatePanel(
			'Label',
			$.CreatePanel('Panel', this.panels.splits.names, '', {
				class: 'hud-splits__cell hud-splits__cell--name ' + (i === 0 ? 'hud-splits__cell--latest' : '')
			}),
			'',
			{
				class: 'hud-splits__name',
				text: '{s:name}'
			}
		),
		time: $.CreatePanel(
			'Label',
			$.CreatePanel('Panel', this.panels.splits.times, '', {
				class: 'hud-splits__cell hud-splits__cell--time ' + (i === 0 ? 'hud-splits__cell--latest' : '')
			}),
			'',
			{
				class: 'hud-splits__time',
				text: '{g:time:time}'
			}
		),
		diff: $.CreatePanel(
			'Label',
			$.CreatePanel('Panel', this.panels.splits.diffs, '', {
				class: 'hud-splits__cell hud-splits__cell--diff ' + (i === 0 ? 'hud-splits__cell--latest' : '')
			}),
			'',
			{
				class: 'hud-splits__diff diff',
				text: '{s:diff_sign}{g:time:diff}'
			}
		)
	}));

	// - When timer progression changes:
	//   - Generate progression split, set bottom-most split to it
	//   - Push all other splits up by setting them to the previous split's properties
	// - When timer state changes,
	//   - To primed: Clear all splits
	//   - To running: Clear all splits
	//   - To disabled: Clear all splits
	//   - To finished: Generate final split, set bottom-most split to it
	// - When comparison changes:
	//   - Update all splits to use new comparison
	// - When timer replaced:
	//   - Regenerate everything. During seeking we'll do this a *lot*, but this
	//     design is very performant and can handle it. If we ever need to speed it
	//     up, could add an event specifically for seeking.
	constructor() {
		$.RegisterForUnhandledEvent('OnObservedTimerStateChange', () => {
			const { state, runTime, segmentsCount, segmentCheckpointsCount } =
				MomentumTimerAPI.GetObservedTimerStatus();

			if (state === Timer.TimerState.FINISHED && (segmentsCount > 1 || segmentCheckpointsCount > 1)) {
				const splits = MomentumTimerAPI.GetObservedTimerRunSplits();

				this.updateLatestSplit(
					Timer.generateFinishSplit(
						splits,
						this.comparison?.runSplits ?? null,
						runTime,
						this.comparison?.runTime ?? 0,
						segmentsCount,
						segmentCheckpointsCount
					)
				);
			} else {
				this.clearSplits();
			}
		});

		$.RegisterForUnhandledEvent('ComparisonRunUpdated', () => {
			const { state } = MomentumTimerAPI.GetObservedTimerStatus();

			this.comparison = RunComparisonsAPI.GetComparisonRun();

			// If timer just finished and we're not watching a replay, don't update - otherwise
			// comparison will get set to the run you just finished when you PB which we
			// obviously don't want to happen.
			if (!(state === Timer.TimerState.FINISHED && this.controlledReplayID === null)) {
				this.recomputeComparisons();
			}
		});

		$.RegisterForUnhandledEvent('OnObservedTimerCheckpointProgressed', () => {
			const { majorNum, minorNum, segmentsCount, segmentCheckpointsCount } =
				MomentumTimerAPI.GetObservedTimerStatus();

			const splits = MomentumTimerAPI.GetObservedTimerRunSplits();

			this.updateLatestSplit(
				Timer.generateSplit(
					splits,
					this.comparison?.runSplits ?? null,
					majorNum,
					minorNum,
					segmentsCount,
					segmentCheckpointsCount,
					true
				)
			);
		});

		$.RegisterForUnhandledEvent('OnObservedTimerReplaced', () => {
			this.controlledReplayID = MomentumTimerAPI.GetObservedRunMetadata()?.tempId ?? null;
			this.regenerateSplits();
		});

		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
			this.clearSplits();
		});

		let tempComparison: any;
		let tempReplayID: any;
		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => {
			// Usually players using HUD customizer won't be in a run, so generate dummy splits. If they *are* in a run,
			// don't alter them in any way.
			const { state } = MomentumTimerAPI.GetObservedTimerStatus();

			if (state === Timer.TimerState.DISABLED || state === Timer.TimerState.PRIMED) {
				tempComparison = this.comparison;
				tempReplayID = this.controlledReplayID;
				this.createDummySplits();
			}
		});

		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => {
			const { state } = MomentumTimerAPI.GetObservedTimerStatus();
			if (state === Timer.TimerState.DISABLED || state === Timer.TimerState.PRIMED) {
				this.comparison = tempComparison;
				this.controlledReplayID = tempReplayID;
				this.clearSplits();
			}
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			// Layouting out dummy splits can take like 100 (!!) frames in debug, until then the panel has 0 and overlay
			// panel gets mispositioned. So just wait until width is at least 64px.
			expectedMinWidth: 64,
			dynamicStyles: {
				...MarginStyles,
				...PaddingStyles,
				// TODO(customizer): Currently always takes up full height, so background takes up a lot of space.
				// Adding making empty rows 0-height is quite hard, if doing so, try to follow the layouting and CSS
				// carefully before changing, it's complicated!
				// Also if someone wanted this is a flow group, the height shifts would be very annoying, maybe put the
				// fixed height behaviour being a checkbox.
				...BackgroundColorStyle,
				// TODO(customizer): Border is visible when you have no comparisons (e.g. in start zone).
				// Need to apply a class to outermost panel conditionally.
				...BorderStyles,
				// TODO(customizer): Blurring blurs the entire panel, not the backbuffer. Adding #ChatInput to
				// #HudBlur's blurrects has same issue, no idea what's different about that panel from say,
				// TabMenu/Spectator.
				blur: {
					name: 'Background Blur',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (panel, value) => {
						const blurTarget = $.GetContextPanel().GetParent()!.FindChild<HudBlurTarget>('HudBlur')!;
						if (value) {
							blurTarget.AddBlurPanel(panel);
						} else {
							blurTarget.RemoveBlurPanel(panel);
						}
					}
				}
			}
		});
	}

	regenerateSplits() {
		const {
			state,
			majorNum: currMaj,
			minorNum: currMin,
			runTime,
			segmentsCount,
			segmentCheckpointsCount
		} = MomentumTimerAPI.GetObservedTimerStatus();

		if (
			state === Timer.TimerState.PRIMED ||
			state === Timer.TimerState.DISABLED ||
			(segmentsCount === 1 && segmentCheckpointsCount === 1) // Never show for single-segment runs, pointless
		) {
			this.clearSplits();
			return;
		}

		const splits = MomentumTimerAPI.GetObservedTimerRunSplits();

		let idx = 0; // Index into split rows

		// Create a finish split first, if we're at the end of a run
		if (state === Timer.TimerState.FINISHED) {
			this.updateSplit(
				this.splitRows[0],
				Timer.generateFinishSplit(
					splits,
					this.comparison?.runSplits ?? null,
					runTime,
					this.comparison?.runTime ?? 0,
					segmentsCount,
					segmentCheckpointsCount
				)
			);

			idx++;
		}

		for (let segIdx = splits.segments.length - 1; segIdx >= 0 && idx < MAX_SPLITS; segIdx--) {
			const segment = splits.segments[segIdx];
			const majorNum = segIdx + 1;

			for (let subIdx = segment.subsegments.length - 1; subIdx >= 0 && idx < MAX_SPLITS; subIdx--) {
				const subseg = segment.subsegments[subIdx];

				if (majorNum === 1 && subseg.minorNum === 1) continue;
				if (majorNum > currMaj || (majorNum === currMaj && subseg.minorNum > currMin)) continue;

				this.updateSplit(
					this.splitRows[idx],
					Timer.generateSplit(
						splits,
						this.comparison?.runSplits ?? null,
						majorNum,
						subseg.minorNum,
						splits.segments.length,
						currMaj === majorNum ? segmentCheckpointsCount : segment.subsegments.length,
						true
					)
				);

				idx++;
			}
		}

		// Clear any old splits if above loop didn't exhaust all available rows
		for (; idx < MAX_SPLITS; idx++) {
			this.clearSplit(this.splitRows[idx]);
		}
	}

	recomputeComparisons() {
		const splits = MomentumTimerAPI.GetObservedTimerRunSplits();

		this.splitRows.forEach((row) => {
			if (!row.split) return;

			if (this.hasUniqueComparison()) {
				row.split = Timer.generateSplit(
					splits,
					this.comparison?.runSplits ?? null,
					row.split.majorNum,
					row.split.minorNum,
					row.split.segmentsCount,
					row.split.segmentCheckpointsCount,
					true // round to float, could be networked data
				);
			} else {
				// Split obj might have some irrelevant properties, but they won't be used
				row.split.hasComparison = false;
			}

			this.pushSplitUpdate(row);
		});
	}

	/** Set the properties of the bottom-most split, and adjust all the others */
	updateLatestSplit(props?: Timer.Split) {
		// Would be possible to avoid all the pushSplitUpdate calls if we moved panels
		// around in their containers, but we need to regenerate everything anyway when
		// handling OnObservedTimerReplaced, which is the most frequent case where we
		// have to update splits.
		for (let i = MAX_SPLITS - 1; i > 0; i--) {
			this.updateSplit(this.splitRows[i], this.splitRows[i - 1].split);
		}

		this.updateSplit(this.splitRows[0], props);
	}

	updateSplit(row: SplitRow, props?: Timer.Split) {
		if (!props) return;

		row.split = props;
		this.pushSplitUpdate(row);
	}

	pushSplitUpdate({ name, time, diff, split }: SplitRow) {
		if (!split) {
			name.AddClass('hud-splits__name--hidden');
			time.AddClass('hud-splits__time--hidden');
			diff.AddClass('hud-splits__diff--hidden');
			return;
		}

		// Possible subsegment styling -- currently unused.
		// const isSubsegment = props.subsegmentIndex > 0;
		// name.SetHasClass('hud-splits__name--subsegment', isSubsegment);
		// time.SetHasClass('hud-splits__time--subsegment', isSubsegment);
		// diff.SetHasClass('hud-splits__diff--subsegment', isSubsegment);

		name.SetDialogVariable('name', split.name);
		time.SetDialogVariableFloat('time', split.time);
		name.RemoveClass('hud-splits__name--hidden');
		time.RemoveClass('hud-splits__time--hidden');

		const { trackId } = MomentumTimerAPI.GetObservedTimerStatus();
		const hasComparison =
			getHudCustomizer()?.isOpen() ||
			(split.hasComparison &&
				// hasUniqueComparison is based on controlledReplayID which is updated whenever observed timer
				// changes, so `split` will be derived from current timer
				this.hasUniqueComparison() &&
				// Ensure we're definitely on the same track, currently possible that the comparison could be
				// on a different one
				trackId.type === this.comparison.trackId.type &&
				trackId.number === this.comparison.trackId.number);

		diff.SetHasClass('hud-splits__diff--hidden', !hasComparison);

		if (!hasComparison) return;

		diff.SetDialogVariable('diff_sign', split.diff! > 0 ? '+' : split.diff === 0 ? '' : '-');
		diff.SetDialogVariableFloat('diff', Math.abs(split.diff!));
		diff.SetHasClass('--ahead', split.diff! < 0);
		diff.SetHasClass('--behind', split.diff! > 0);
		diff.SetHasClass('--gain', split.delta! <= 0);
		diff.SetHasClass('--loss', split.delta! > 0);
	}

	clearSplits() {
		this.splitRows.forEach((row) => this.clearSplit(row));
	}

	clearSplit(row: SplitRow) {
		delete row.split;

		// No need to set dialog vars/styles since will be invisible until updated
		row.name.AddClass('hud-splits__name--hidden');
		row.time.AddClass('hud-splits__time--hidden');
		row.diff.AddClass('hud-splits__diff--hidden');
	}

	// Check whether comparison run is identical to the observed replay (if exists) so we never
	// show pointless +0:00 comparisons by comparing a run to itself.
	hasUniqueComparison(): this is { comparison: Timer.RunMetadata } {
		return this.comparison !== null && this.comparison.tempId !== this.controlledReplayID;
	}

	createDummySplits() {
		const times = new Array(MAX_SPLITS);
		let t = 0;
		for (let i = 0; i < MAX_SPLITS; i++) {
			t += 10 + Math.random() * 10;
			times[i] = t;
		}

		for (let i = MAX_SPLITS - 1; i >= 0; i--) {
			this.updateSplit(this.splitRows[MAX_SPLITS - 1 - i], {
				majorNum: i + 1,
				minorNum: 1,
				segmentsCount: MAX_SPLITS,
				segmentCheckpointsCount: 1,
				name: `${i + 1}`,
				time: times[i],
				segmentTime: times[i],
				delta: Math.random() * 4 - 2,
				diff: Math.random() * 4 - 2,
				hasComparison: true
			});
		}
	}
}
