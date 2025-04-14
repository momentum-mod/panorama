import { PanelHandler } from 'util/module-helpers';
import * as Timer from 'common/timer';
import * as LineGraph from 'components/graphs/line-graph';

@PanelHandler()
class EndOfRunHandler {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		time: $<Label>('#RunTime')!,
		diff: $<Label>('#RunDiff')!,
		splits: $<Panel>('#Splits')!,
		detailedStats: $<Panel>('#DetailedStats')!,
		graph: $<LineGraph>('#SplitsGraph')!,
		zoneStats: $<Panel>('#ZoneStats')!,
		runStatusIndicators: $<Panel>('#RunStatusIndicators')!,
		saveStatus: $<Image>('#SaveStatus')!,
		uploadStatus: $<Image>('#UploadStatus')!,
		actionButtons: $<Panel>('#EndOfRunActionButtons')!,
		selectedGraphPoint: null as Button | null
	};

	baseRun!: Timer.RunMetadata;
	// Possibly undefined, if we're not comparing to a run. Note that the baseRun *can* be undefined, before
	// EndOfRun_Show is called, but that should never happen be allowed to happen.
	comparisonRun?: Timer.RunMetadata | null;

	comparison?: Timer.Comparison | null;
	selectedSplit?: Timer.Split | null;

	constructor() {
		// End of run goes through 3 stages in sequence:
		// 1) Run is completed after player enters end zone (EndofRun_Result_RunFinish)
		// 2) Replay for the run has been compressed and saved to disk (EndOfRun_Result_RunSave)
		// 3) Replay has been uploaded and verified (EndOfRun_Result_RunUpload)
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunFinish', (run) => this.onRunFinished(run));
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunSave', (saved, run) => this.updateRunSavedStatus(saved, run));
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunUpload', (uploaded, cosXP, rankXP, lvlGain) =>
			this.updateRunUploadStatus(uploaded, cosXP, rankXP, lvlGain)
		);
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.initOnMapLoad(isOfficial));
	}

	/** Hides the end of run panel, when a new map is loaded. */
	initOnMapLoad(isOfficial: boolean) {
		this.panels.uploadStatus.SetHasClass('hide', !isOfficial);

		this.hideEndOfRun(true, false);
	}

	updateRunStatusIndicator(status: Timer.RunStatusStates, type: Timer.RunStatusTypes) {
		const statusPanel = type === Timer.RunStatusTypes.UPLOAD ? this.panels.uploadStatus : this.panels.saveStatus;

		statusPanel.SetHasClass('spin-clockwise', status === Timer.RunStatusStates.PROGRESS);
		statusPanel.SetHasClass('endofrun__run-status-indicator--progress', status === Timer.RunStatusStates.PROGRESS);
		statusPanel.SetHasClass('endofrun__run-status-indicator--success', status === Timer.RunStatusStates.SUCCESS);
		statusPanel.SetHasClass('endofrun__run-status-indicator--error', status === Timer.RunStatusStates.ERROR);

		let icon: string, text: string | undefined, style: string;

		switch (status) {
			case Timer.RunStatusStates.PROGRESS:
				icon = `file://{images}/${Timer.RunStatusIcons.PROGRESS}.svg`;
				break;
			case Timer.RunStatusStates.SUCCESS:
				icon = `file://{images}/${
					type === Timer.RunStatusTypes.UPLOAD ? Timer.RunStatusIcons.UPLOAD : Timer.RunStatusIcons.SAVE
				}.svg`;
				text = $.Localize(
					type === Timer.RunStatusTypes.UPLOAD
						? 'EndOfRun_Status_UploadSuccess'
						: 'EndOfRun_Status_SaveSuccess'
				);
				style = 'positive';
				break;
			case Timer.RunStatusStates.ERROR:
			default:
				icon = `file://{images}/${Timer.RunStatusIcons.ERROR}.svg`;
				text = $.Localize(
					type === Timer.RunStatusTypes.UPLOAD ? 'EndOfRun_Status_UploadFail' : 'EndOfRun_Status_SaveFail'
				);
				style = 'error';
		}

		statusPanel.SetImage(icon);

		if (text) {
			statusPanel.SetPanelEvent('onmouseover', () =>
				UiToolkitAPI.ShowTitleImageTextTooltipStyled(
					statusPanel.id,
					'',
					icon,
					text,
					`tooltip--notitle--${style}`
				)
			);
		} else {
			statusPanel.ClearPanelEvent('onmouseover');
		}
	}

	onRunFinished(run: Timer.RunMetadata) {
		const observedStatus = MomentumTimerAPI.GetObservedTimerStatus();
		if (observedStatus.trackId.type !== run.trackId.type || observedStatus.trackId.number !== run.trackId.number) {
			return;
		}

		this.baseRun = run;
		this.comparisonRun = RunComparisonsAPI.GetComparisonRun();

		this.showNewEndOfRun(Timer.EndOfRunShowReason.PLAYER_FINISHED_RUN);
	}

	updateRunSavedStatus(saved: boolean, run: Timer.RunMetadata) {
		const observedStatus = MomentumTimerAPI.GetObservedTimerStatus();
		if (observedStatus.trackId.type !== run.trackId.type || observedStatus.trackId.number !== run.trackId.number) {
			return;
		}

		this.baseRun = run;
		this.comparisonRun = RunComparisonsAPI.GetComparisonRun();

		this.updateRunStatusIndicator(
			saved ? Timer.RunStatusStates.SUCCESS : Timer.RunStatusStates.ERROR,
			Timer.RunStatusTypes.SAVE
		);
	}

	updateRunUploadStatus(uploaded: boolean, _cosXp: number, _rankXp: number, _lvlGain: number) {
		this.updateRunStatusIndicator(
			uploaded ? Timer.RunStatusStates.SUCCESS : Timer.RunStatusStates.ERROR,
			Timer.RunStatusTypes.UPLOAD
		);
	}

	watchReplay() {
		if (!this.baseRun || !this.baseRun.filePath) {
			return;
		}

		GameInterfaceAPI.ConsoleCommand(`mom_tv_replay_watch ${this.baseRun.filePath}`);
		this.hideEndOfRun(false, true);
	}

	restartMap() {
		GameInterfaceAPI.ConsoleCommand('mom_restart_track');
		this.hideEndOfRun(true, true);
	}

	hideEndOfRun(hideEndOfRun = true, hideTabMenu = false) {
		if (hideEndOfRun) $.DispatchEvent('EndOfRun_Hide');

		if (hideTabMenu) $.DispatchEvent('HudTabMenu_ForceClose');
	}

	/**
	 * Reset and determine how to generate the end of run panel.
	 * The comparison run can be null, in which case we don't show splits or the graph.
	 * Fired when either when the local player's run ends, a replay run ends,
	 * you go back to a last EoR from leaderboards, or in the future when the player compares two runs.
	 */
	showNewEndOfRun(showReason: Timer.EndOfRunShowReason) {
		if (!this.baseRun) return;

		if (showReason === Timer.EndOfRunShowReason.PLAYER_FINISHED_RUN) {
			this.panels.runStatusIndicators.visible = true;
			this.panels.actionButtons.visible = true;
			this.updateRunStatusIndicator(Timer.RunStatusStates.PROGRESS, Timer.RunStatusTypes.SAVE);
			this.updateRunStatusIndicator(Timer.RunStatusStates.PROGRESS, Timer.RunStatusTypes.UPLOAD);
		} else {
			this.panels.runStatusIndicators.visible = false;
			this.panels.actionButtons.visible = false;

			if (showReason === Timer.EndOfRunShowReason.MANUALLY_SHOWN) {
				// If it's a manual show we don't need to redo anything, just return out
				return;
			}
		}

		// Remove the previous splits, if any
		this.panels.splits.RemoveAndDeleteChildren();

		// Remove any previous styling
		this.panels.cp.RemoveClass('endofrun--first');
		this.panels.cp.RemoveClass('endofrun--ahead');
		this.panels.cp.RemoveClass('endofrun--behind');

		this.panels.cp.SetDialogVariableFloat('run_time', this.baseRun.runTime);

		// If we have a comparison, make the full stats, otherwise just simple page without graph
		if (
			this.comparisonRun &&
			this.comparisonRun.trackId.type === this.baseRun.trackId.type &&
			this.comparisonRun.trackId.number === this.baseRun.trackId.number
		) {
			this.setComparisionStats();
		} else {
			this.setSingleRunStats();
		}
	}

	/**
	 * Generate the end of run panel for the current base run, with no comparison.
	 */
	setSingleRunStats() {
		const { runSplits, runTime } = this.baseRun;
		if (!runSplits) return;

		// Clear the diff string, we don't have one
		this.panels.cp.SetDialogVariable('run_diff_prefix', '');
		this.panels.cp.SetDialogVariableFloat('run_diff', 0);

		// Give the styling for a first/no comparison set run
		this.panels.cp.AddClass('endofrun--first');

		// Loop through each zone in the run and create a neutral Split panel with no diff/delta
		const segmentsCount = runSplits.segments.length;
		runSplits.segments.forEach((segment, i) => {
			segment.subsegments.forEach((subsegment, j) => {
				if (i === 0 && j === 0) return;

				const majorNum = i + 1;
				const minorNum = subsegment.minorNum;
				const segmentsCheckpointCount = segment.subsegments.length;
				const name = Timer.getSplitName(runSplits, majorNum, minorNum, segmentsCount, segmentsCheckpointCount);

				const panel = $.CreatePanel('Panel', this.panels.splits, `Split${name}`, { class: 'endofrun-split' });
				panel.LoadLayoutSnippet('split');
				this.updateSplitPanel(
					panel,
					Timer.generateSplit(runSplits, null, majorNum, minorNum, segmentsCount, segmentsCheckpointCount)
				);
			});
		});

		// Finish split
		const panel = $.CreatePanel('Panel', this.panels.splits, `Split${segmentsCount}`, { class: 'endofrun-split' });
		panel.LoadLayoutSnippet('split');
		this.updateSplitPanel(
			panel,
			Timer.generateFinishSplit(
				runSplits,
				null,
				runTime,
				0,
				segmentsCount,
				runSplits.segments.at(-1)!.subsegments.length
			)
		);

		// Scroll the rightmost split
		panel.ScrollParentToMakePanelFit(3, false);

		this.panels.cp.SetDialogVariable('comparison_name', '');

		this.panels.detailedStats.AddClass('endofrun__stats--hidden');
	}

	/**
	 * Generate the end of run panel comparisons from the two active runs.
	 */
	setComparisionStats() {
		if (!this.baseRun || !this.comparisonRun) return;

		const comparison = Timer.generateComparison(this.baseRun, this.comparisonRun);

		// Are we ahead? Probably don't need a class for if you're exactly identical
		const isAhead = comparison.diff < 0;

		// Set the diff
		this.panels.cp.SetDialogVariable('run_diff_prefix', isAhead ? '' : '+');
		this.panels.cp.SetDialogVariableFloat('run_diff', comparison.diff);

		// Set styling based on if we're ahead or behind
		this.panels.cp.SetHasClass('endofrun--ahead', isAhead);
		this.panels.cp.SetHasClass('endofrun--behind', !isAhead);

		// Create an empty Radiobutton with no styling for overall, so we have something to remove selection from when deselecting another split
		const overallSplitPanel = $.CreatePanel('RadioButton', this.panels.splits, 'Split0', {
			group: 'end-of-run-split-buttons'
		});

		// Create splits for every comparison
		comparison.segmentSplits.forEach((splits, i) => {
			splits.forEach((split, j) => {
				// Don't show anything for start split
				if (i === 0 && j === 0) return;

				// Create radiobutton rather than regular panel to wrap the split in
				const button = $.CreatePanel('RadioButton', this.panels.splits, 'Split' + this.getPanelID(split), {
					class: 'endofrun__split-button',
					group: 'end-of-run-split-buttons'
				});

				// Wrapper button updates selected stats and graph point
				button.SetPanelEvent('onactivate', () => {
					if (this.selectedSplit === split) {
						$.DispatchEvent('Activated', overallSplitPanel, PanelEventSource.MOUSE);
						this.setSelectedSplit(comparison.overallSplit, comparison);
					} else {
						this.setSelectedSplit(split, comparison);
					}
				});

				const panel = $.CreatePanel('Panel', button, '', { class: 'endofrun-split' });
				panel.LoadLayoutSnippet('split');
				this.updateSplitPanel(panel, split);

				// Scroll the rightmost split
				if (i === comparison.segmentSplits.length - 1 && j === splits.length - 1) {
					button.ScrollParentToMakePanelFit(3, false);
				}
			});
		});

		// Make the graph
		this.updateGraph(comparison, 'time');

		// Set the comparison name to appear in the stats bit
		$.GetContextPanel().SetDialogVariable('comparison_name', this.comparisonRun.playerName);

		// Default to overall
		this.setSelectedSplit(comparison.overallSplit, comparison);

		this.panels.detailedStats.RemoveClass('endofrun__stats--hidden');
	}

	updateSplitPanel(panel: Panel, split: Timer.Split) {
		panel.SetDialogVariable('name', split.name);
		panel.SetDialogVariableFloat('time', split.time);
		panel.SetHasClass('endofrun-split--no-comparison', !split.hasComparison);

		if (!split.hasComparison) return;

		panel.SetDialogVariable('diff_sign', split.diff! > 0 ? '+' : split.diff === 0 ? '' : '-');
		panel.SetDialogVariableFloat('diff', Math.abs(split.diff!));
		panel.SetHasClass('--ahead', split.diff! < 0);
		panel.SetHasClass('--behind', split.diff! > 0);
		panel.SetHasClass('--gain', split.delta! <= 0);
		panel.SetHasClass('--loss', split.delta! > 0);
	}

	/** Generate a graph for the given comparison */
	updateGraph(comparison: Timer.Comparison, statName: Timer.RunStatType | 'time') {
		// Grab the actual LineGraph class attached to the panel
		const lineGraph = this.panels.graph.handler;

		// Can't find a better way to wait until the panel actually has a height set. ReadyForDisplay doesn't wanna fire.
		// Please don't kill me.
		if (lineGraph.width === 0 || lineGraph.height === 0) {
			const setDimensionsAsSoonAsPossible = (i: number) => {
				if (i > 100) return;
				i++;
				$.Schedule(0.01, () => {
					lineGraph.calculateDimensions();
					if (lineGraph.width === 0 || lineGraph.height === 0) setDimensionsAsSoonAsPossible(i);
					else {
						this.updateGraph(comparison, statName);
						return;
					}
				});
			};
			setDimensionsAsSoonAsPossible(0);
		}

		// Start the comparison line
		const line: LineGraph.Line = {
			points: [],
			color: '#ffffffaa',
			thickness: 2,
			shadeBelowToOriginColor: '#ffffff33',
			shadeAboveToOriginColor: '#ffffff33'
		};

		// If we have multiple segments, we draw vertical bars for only segments, otherwise for each subsegment
		const splits = comparison.segmentSplits;
		const flatSplits = splits.flatMap((seg, i) => seg.map((split, j) => [split, seg.length, i, j] as const));
		const isLinear = splits.length <= 2; // Splits always had an array containing just finish split
		const numZones = isLinear ? splits[0].length + 1 : splits.length;

		// Tracks with just a start and end zone, nothing else.
		// Pointless displaying graph in that case, height of end split point would be completely arbitrary.
		this.panels.cp.SetHasClass('endofrun--no-cps', splits.length === 2 && splits[0].length === 1);

		const useStat = statName !== 'time';
		const isPositiveGood = useStat ? Timer.RunStatsProperties[statName].isPositiveGood : false;

		// Find max and min diff for the run
		const diffs = flatSplits.map(([split]) =>
			useStat ? (split.statsComparisons?.[statName]?.diff ?? 0) : split.diff!
		);

		// Both must contain 0
		let [max, min] = [Math.max(0, ...diffs), Math.min(0, ...diffs)];

		// Add some vertical spacing to the graph
		const spacing = (max - min) / 10;
		if (max > 0 && max !== splits.at(-1)![0].diff) max += spacing;
		if (min < 0 && min !== splits.at(-1)![0].diff) min -= spacing;

		const range = max - min;

		// Calculate an appropriate interval value for the Y axis.
		// scaleFactor gets us in the right range (0.1 < x < 1 => 0.1, 1 < x < 10 => 1, 10 < x < 100 => 10, etc)
		const scaleFactor = 10 ** Math.floor(Math.log10(range));

		max = Math.ceil(max / scaleFactor) * scaleFactor;
		min = Math.floor(min / scaleFactor) * scaleFactor;

		if (Number.isNaN(max)) max = 0;
		if (Number.isNaN(min)) min = 0;

		// Occasionally stats have no diff at all so range = 0. Set to arbitrary sensible values to avoid division by 0 in the graph.
		if (max === 0 && min === 0) {
			max = 1;
			min = -1;
		}

		// Now decide whether to increase the number of intervals. This is just based on what looks good to me.
		let yInterval: number;
		if (range / scaleFactor >= 5) yInterval = scaleFactor * 2;
		else if (range / scaleFactor >= 2.5) yInterval = scaleFactor;
		else yInterval = scaleFactor / 2;

		// Set the axis
		lineGraph.axis = [
			{
				min: 0,
				max: numZones - 1,
				name: $.Localize('#Common_Zone'),
				// Start using interval > 1 once we go above 30 zones (uncommon)
				interval: Math.ceil(numZones / 30),
				timeBased: false
			},
			{
				min: min,
				max: max,
				name: $.Localize(useStat ? statName : '#Common_Time'),
				interval: yInterval,
				timeBased: !useStat
			}
		];

		// Make our points
		line.points = flatSplits.map(([split, segLen, i, j]) => {
			const id = this.getPanelID(split);

			if (i === 0 && j === 0)
				return { id: `Point${id}`, x: 0, y: 0, selectionSize: 0, class: 'linegraph__point--hidden' };

			const stat = useStat ? split.statsComparisons![statName] : null;
			const diff = stat ? stat.diff! : split.diff!;
			const compareVal = stat && stat?.isPositiveGood ? -diff : diff;
			const diffStyle = compareVal < 0 ? 'diff --ahead' : compareVal > 0 ? 'diff --behind' : '';

			let tooltipString: string;
			if (!stat) {
				const deltaStyle =
					(diff < 0 ? 'diff --ahead' : split.diff! > 0 ? 'diff --behind' : 'diff') +
					(split.delta! < 0 ? ' --gain' : split.delta! > 0 ? ' --loss' : '');

				tooltipString =
					`${$.Localize('#Run_Comparison_TotalTime')}: <b>{g:time:total_time}</b>\n` +
					`${$.Localize('#Run_Comparison_ZoneTime')}: <b>{g:time:zone_time}</b>\n` +
					`${$.Localize('#Run_Comparison_Diff')}: <b class='${diffStyle}'>${this.getDiffSign(split.diff!)}{g:time:time_diff}</b>\n` +
					`${$.Localize('#Run_Comparison_Delta')}: <b class='${deltaStyle}'>${this.getDiffSign(split.delta!)}{g:time:time_delta}</b>`;
			} else {
				// Using string instead of float here, floats add a shit ton of floating point imprecision e.g. 90.00000000128381273
				tooltipString =
					'{s:name}: <b>{s:base_value}</b>\n' +
					`${$.Localize('#Run_Comparison')}: <b>{s:compare_value}</b>\n` +
					`${$.Localize('#Run_Comparison_Diff')}: <b class='${diffStyle}'>${this.getDiffSign(diff)}{s:diff}</b>`;
			}

			const zoneNum = isLinear ? (i === 1 ? splits[0].length : j) : i + j / segLen;

			return {
				id: `Point${id}`,
				x: zoneNum,
				y: diff,
				selectionSize: 25,
				events: {
					// Set the activate event to just press the radiobutton in the splits panel, simplifies the code.
					onactivate: () => $.DispatchEvent('Activated', $(`#Split${id}`), PanelEventSource.MOUSE),
					onmouseover: () => {
						if (!stat) {
							this.panels.cp.SetDialogVariableFloat('total_time', split.time);
							this.panels.cp.SetDialogVariableFloat('zone_time', split.segmentTime);
							this.panels.cp.SetDialogVariableFloat('time_diff', diff);
							this.panels.cp.SetDialogVariableFloat('time_delta', split.delta!);
						} else {
							this.panels.cp.SetDialogVariable('name', $.Localize(stat.name));
							this.panels.cp.SetDialogVariableInt('base_value', this.roundFloat(stat.baseValue, 2));
							this.panels.cp.SetDialogVariableInt(
								'compare_value',
								this.roundFloat(stat.comparisonValue, 2)
							);
							this.panels.cp.SetDialogVariableInt('diff', this.roundFloat(stat.diff, 2));
						}
						UiToolkitAPI.ShowTextTooltip(`Point${id}`, tooltipString);
					},
					onmouseout: () => UiToolkitAPI.HideTextTooltip()
				}
			};
		});

		// Add our line to the lines array
		lineGraph.lines = [line];

		// Draw it!
		lineGraph.draw();

		// Add the positive red and blue zones to the graph. I'd rather do this here than as
		// functionality in the LineGraph component, as I doubt we'd use it anywhere else.
		// The linegraph component will destroy the previous instances of these panels on draw call though.
		const grid = this.panels.graph.FindChildTraverse('Grid')!;

		// Find the y position for the zones
		const yScale = grid.actuallayoutheight / grid.actualuiscale_y;

		// Position of the 0 line using (max - 0) / (max - min)
		const positiveHeight = (max / (max - min)) * yScale;
		const negativeHeight = yScale - positiveHeight;

		$.CreatePanel('Panel', grid, '', {
			class: isPositiveGood ? 'endofrun-graph__negative' : 'endofrun-graph__positive',
			style: `
				width: 100%;
				height: ${positiveHeight}px`
		});

		$.CreatePanel('Panel', grid, '', {
			class: isPositiveGood ? 'endofrun-graph__positive' : 'endofrun-graph__negative',
			style: `
				width: 100%;
				height: ${negativeHeight}px;
				position: 0px ${positiveHeight}px 0px`
		});

		// The selected point on the current graph (if it exists) is going to be deleted, and for some reason Panorama screams at you
		// if you then try to reference it, rather than just returning null. So track that point explicitly instead.
		this.panels.selectedGraphPoint = null;
	}

	/** Set the selected graph point and stats for a given split */
	setSelectedSplit(split: Timer.Split, comparison: Timer.Comparison) {
		this.selectedSplit = split;

		this.panels.cp.SetDialogVariable('selected_zone', split.name);

		// Don't scroll for the overall split
		if (split.majorNum !== 0 || split.minorNum !== 0) {
			this.panels.splits
				.FindChildTraverse('Split' + this.getPanelID(split))!
				.ScrollParentToMakePanelFit(3, false);
		}

		this.setSelectedGraphPoint();

		// Remove the zone stats. We could hardcode these in XML and not be recreating the panels and just use dialog variables,
		// but this way if different gamemodes have different stats we don't have to change the XML at all, just the input data.
		this.panels.zoneStats.RemoveAndDeleteChildren();

		// Function to create row for each stat passed in
		const createRow = (
			statName: 'time' | Timer.RunStatType,
			statComparison: Timer.RunStatsComparison,
			index: number
		) => {
			const row = $.CreatePanel('RadioButton', this.panels.zoneStats, '', {
				class: `endofrun-stats__row ${index % 2 === 0 ? ' endofrun-stats__row--odd' : ''}`,
				selected: index === -1
			});

			row.SetPanelEvent('onactivate', () => {
				this.updateGraph(comparison, statName);
				this.setSelectedGraphPoint();
			});

			$.CreatePanel('Label', row, '', {
				text: $.Localize(
					statName === 'time'
						? '#Common_Time'
						: '#Run_Stat_Name_' + statName[0].toUpperCase() + statName.slice(1)
				),
				class: 'endofrun-stats__name'
			});

			$.CreatePanel('Label', row, '', {
				text: `${this.roundFloat(statComparison.baseValue, 2)}`,
				class: 'endofrun-stats__value'
			});

			$.CreatePanel('Label', row, '', {
				text: `${this.roundFloat(statComparison.comparisonValue, 2)}`,
				class: 'endofrun-stats__value'
			});

			$.CreatePanel('Label', row, '', {
				text: `${this.getDiffSign(statComparison.diff)}${this.roundFloat(statComparison.diff, 2)}`,
				class: 'endofrun-stats__value'
			});
		};

		createRow(
			'time',
			{
				name: 'time' as any, // Not really a keyof RunStats
				unit: 's',
				baseValue: split.segmentTime,
				comparisonValue: split.segmentTime - split.delta!,
				diff: split.delta!,
				isPositiveGood: false
			},
			0
		);

		if (split.statsComparisons)
			Object.entries(split.statsComparisons).forEach(([k, v], i) => createRow(k as Timer.RunStatType, v, i + 1));
	}

	/**
	 * Set the selected point of the graph to whatever split is currently selected.
	 */
	setSelectedGraphPoint() {
		const split = this.selectedSplit;

		if (!split) return;

		// Don't scroll for the overall split
		if (split.majorNum !== 0 || split.minorNum !== 0) {
			// Style graph node
			const selectedGraphPoint = this.panels.graph.FindChildTraverse<Button>('Point' + this.getPanelID(split));
			if (selectedGraphPoint) {
				selectedGraphPoint.AddClass('endofrun-graph__point--selected');
				this.panels.selectedGraphPoint?.RemoveClass('endofrun-graph__point--selected');
				this.panels.selectedGraphPoint = selectedGraphPoint;
			}
		} else {
			this.panels.selectedGraphPoint?.RemoveClass('endofrun-graph__point--selected');
			this.panels.selectedGraphPoint = null;
		}
	}

	getPanelID({ majorNum, minorNum }: Timer.Split): string {
		return `${majorNum}x${minorNum}`;
	}

	roundFloat(n: number, precision: number) {
		return +n.toFixed(precision);
	}

	getDiffSign(diff: number) {
		return diff > 0 ? '+' : '';
	}
}
