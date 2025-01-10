import { PanelHandler } from 'util/module-helpers';
import * as Timer from 'common/timer';
import * as LineGraph from 'components/graphs/line-graph';
import { ComparisonSplit } from 'common/timer';

@PanelHandler()
class EndOfRunHandler {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		time: $<Label>('#RunTime'),
		diff: $<Label>('#RunDiff'),
		splits: $<Panel>('#Splits'),
		detailedStats: $<Panel>('#DetailedStats'),
		graph: $<LineGraph>('#SplitsGraph'),
		zoneStats: $<Panel>('#ZoneStats'),
		runStatusIndicators: $<Panel>('#RunStatusIndicators'),
		saveStatus: $<Image>('#SaveStatus'),
		uploadStatus: $<Image>('#UploadStatus'),
		actionButtons: $<Panel>('#EndOfRunActionButtons'),
		selectedGraphPoint: null as Button | null
	};

	baseRun: Timer.RunMetadata;
	// Possibly undefined, if we're not comparing to a run. Note that the baseRun *can* be undefined, before
	// EndOfRun_Show is called, but that should never happen be allowed to happen.
	comparisonRun?: Timer.RunMetadata;

	comparison: Timer.Comparison;
	selectedSplit: Timer.ComparisonSplit;

	constructor() {
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunUpload', (uploaded, cosXP, rankXP, lvlGain) =>
			this.updateRunUploadStatus(uploaded, cosXP, rankXP, lvlGain)
		);
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunSave', (saved, run) => this.updateRunSavedStatus(saved, run));
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

		let icon: string, text: string, style: string;

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

	updateRunSavedStatus(saved: boolean, run: Timer.RunMetadata) {
		const observedStatus = MomentumTimerAPI.GetObservedTimerStatus();
		if (observedStatus.trackId.type !== run.trackId.type || observedStatus.trackId.number !== run.trackId.number) {
			return;
		}

		this.baseRun = run;
		this.comparisonRun = RunComparisonsAPI.GetComparisonRun();

		this.showNewEndOfRun(Timer.EndOfRunShowReason.PLAYER_FINISHED_RUN);

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
		GameInterfaceAPI.ConsoleCommand('mom_replay_play_loaded');
		this.hideEndOfRun(false, true);
	}

	restartMap() {
		GameInterfaceAPI.ConsoleCommand('mom_restart');
		this.hideEndOfRun(true, true);
	}

	/**
	 *
	 * @param {boolean} hideEndOfRun
	 * @param {boolean} hideTabMenu
	 */
	hideEndOfRun(hideEndOfRun = true, hideTabMenu = false) {
		if (hideEndOfRun) $.DispatchEvent('EndOfRun_Hide');

		if (hideTabMenu) $.DispatchEvent('HudTabMenu_ForceClose');
	}

	/**
	 * Reset and determine how to generate the end of run panel.
	 * The comparison run can be null, in which case we don't show splits or the graph.
	 * Fired when either when the local player's run ends, a replay run ends,
	 * you go back to a last EoR from leaderboards, or in the future when the player compares two runs.
	 * @param {Timer.EndOfRunShowReason} showReason - Why the end of run panel is being shown. See EorShowReason for reasons.
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
		const run = this.baseRun;

		// Clear the diff string, we don't have one
		this.panels.cp.SetDialogVariable('run_diff_prefix', '');
		this.panels.cp.SetDialogVariableFloat('run_diff', 0);

		// Give the styling for a first/no comparison set run
		this.panels.cp.AddClass('endofrun--first');

		// Loop through each zone in the run and create a neutral Split panel with no diff/delta
		run.runSplits.segments.forEach((segment, i) => {
			if (i === 0) {
				return;
			}

			// TODO: Subsegments!
			const name = Timer.getSegmentName(i, 0);

			const splitWrapper = $.CreatePanel('Panel', this.panels.splits, `Split${name}`, {
				class: 'endofrun__split'
			});

			Object.assign($.CreatePanel('Split', splitWrapper, '', { class: 'split--eor' }), {
				name: name,
				time: segment.subsegments[0].timeReached,
				isFirst: true
			});
		});

		// Finish split
		const numSegments = run.runSplits.segments.length;
		const splitWrapper = $.CreatePanel('Panel', this.panels.splits, `Split${numSegments}`, {
			class: 'endofrun__split'
		});

		Object.assign($.CreatePanel('Split', splitWrapper, '', { class: 'split--eor' }), {
			name: numSegments,
			time: run.runTime,
			isFirst: true
		});

		// Scroll the rightmost split
		splitWrapper.ScrollParentToMakePanelFit(3, false);

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
		// TODO: Subsegments!
		comparison.segmentSplits.forEach((split, i) => {
			const subsplit = split[0];

			// Create radiobutton rather than regular panel to wrap the split in
			const button = $.CreatePanel('RadioButton', this.panels.splits, `Split${subsplit.name}`, {
				class: 'endofrun__split-button',
				group: 'end-of-run-split-buttons'
			});

			// Wrapper button updates selected stats and graph point
			button.SetPanelEvent('onactivate', () => {
				if (this.selectedSplit === subsplit) {
					$.DispatchEvent('Activated', overallSplitPanel, 'mouse');
					this.setSelectedSplit(comparison.overallSplit, comparison);
				} else {
					this.setSelectedSplit(subsplit, comparison);
				}
			});

			Object.assign($.CreatePanel('Split', button, '', { class: 'split--eor' }), {
				name: subsplit.name,
				time: subsplit.accumulateTime,
				isFirst: false,
				diff: subsplit.diff,
				delta: subsplit.delta
			});

			// Scroll the rightmost split
			if (i === comparison.segmentSplits.length - 1) {
				button.ScrollParentToMakePanelFit(3, false);
			}
		});

		// Make the graph
		this.updateGraph(comparison, null);

		// Set the comparison name to appear in the stats bit
		$.GetContextPanel().SetDialogVariable('comparison_name', this.comparisonRun.playerName);

		// Default to overall
		this.setSelectedSplit(comparison.overallSplit, comparison);

		this.panels.detailedStats.RemoveClass('endofrun__stats--hidden');
	}

	/** Generate a graph for the given comparison */
	updateGraph(comparison: Timer.Comparison, statIndex: number = null) {
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
						this.updateGraph(comparison, statIndex);
						return;
					}
				});
			};
			setDimensionsAsSoonAsPossible(0);
		}

		// Start the comparison line
		const line: LineGraph.Line = {
			// First point is just 0 on the "0" stage
			points: [
				{
					x: 0,
					y: 0,
					class: 'linegraph__point--hidden',
					selectionSize: 0
				}
			],
			color: '#ffffffaa',
			thickness: 2,
			shadeBelowToOriginColor: '#ffffff33',
			shadeAboveToOriginColor: '#ffffff33'
		};

		let max = Number.MIN_VALUE;
		let min = Number.MAX_VALUE;

		// Point for each zone
		const comparisonSplits = comparison.segmentSplits;

		const numZones = comparisonSplits.length;

		const useStat = statIndex !== null;
		// TODO: Below is so ugly. We can probably turn RunStatsUnits into something like
		// RunStatsProperties: Record<keyof RunStats, {unit: string, isPositiveGood: boolean}>
		const isPositiveGood = (s: ComparisonSplit | Timer.RunStatsComparison) => {
			return useStat && ((s as Timer.RunStatsComparison).unit.includes('ups') || s.name.includes('strafes'));
		};

		// Find max and min diff for the run
		for (const split of comparisonSplits) {
			const subsplit = split[0];

			max = Math.max(max, useStat ? subsplit.statsComparisons[statIndex].diff : subsplit.diff);
			min = Math.min(min, useStat ? subsplit.statsComparisons[statIndex].diff : subsplit.diff);
		}

		// Add some vertical spacing to the graph
		const spacing = (max - min) / 10;
		if (max > 0 && max !== comparisonSplits.at(-1)[0].diff) max += spacing;
		if (min < 0 && min !== comparisonSplits.at(-1)[0].diff) min -= spacing;

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
				min: 1,
				max: numZones,
				name: $.Localize('#Common_Zone'),
				// Limit max zones we draw an axis for to 30
				// todo: find interval equiv to this: lineCount: Math.min(numZones, 30),
				interval: 1,
				timeBased: false
			},
			{
				min: min,
				max: max,
				name: $.Localize(
					useStat ? comparisonSplits[0][0].statsComparisons[statIndex].name : '#Run_Stat_Name_Time'
				),
				interval: yInterval,
				timeBased: !useStat
			}
		];

		// Make our points
		// TODO: Subsegment splits
		for (const [i, split] of comparisonSplits.entries()) {
			const subsplit = split[0];
			const splitName = subsplit.name;
			const data = useStat ? { ...subsplit.statsComparisons[statIndex], time: 0, delta: 0 } : subsplit;
			const isTimeComparison = !useStat || ('unit' in data && data.unit === $.Localize('#Run_Stat_Unit_Second'));

			let tooltipString;
			const compareVal = isPositiveGood(data) ? -data.diff : data.diff;
			const diffStyle = compareVal < 0 ? 'split--ahead ' : compareVal > 0 ? 'split--behind ' : '';
			if (!useStat) {
				const deltaStyle =
					(data.diff < 0 ? 'split--ahead ' : data.diff > 0 ? 'split--behind ' : '') +
					(data.delta < 0 ? 'split--gain' : data.delta > 0 ? 'split--loss' : '');

				//prettier-ignore
				tooltipString =
					`${$.Localize('#Run_Comparison_TotalTime')}: <b>{g:time:total_time}</b>\n` +
					`${$.Localize('#Run_Comparison_ZoneTime')}: <b>{g:time:zone_time}</b>\n` +
					`${$.Localize('#Run_Comparison_Diff')}: <b class='${diffStyle}'>${this.getDiffSign(data.diff)}{g:time:time_diff}</b>\n` +
					`${$.Localize('#Run_Comparison_Delta')}: <b class='${deltaStyle}'>${this.getDiffSign(data.delta)}{g:time:time_delta}</b>`;
			} else {
				// Using string instead of float here, floats add a shit ton of floating point imprecision e.g. 90.00000000128381273
				// prettier-ignore
				tooltipString =
					'{s:name}: <b>{s:base_value}</b>\n' +
					`${$.Localize('#Run_Comparison')}: <b>{s:compare_value}</b>\n` +
					`${$.Localize('#Run_Comparison_Diff')}: <b class='${diffStyle}'>${this.getDiffSign(
						data.diff
					)}{s:diff}</b>`;
			}

			line.points.push({
				// 0th stage was just the hidden point at [0, 0] added to the array on initialisation above
				id: `Point${splitName}`,
				x: i + 1,
				y: data.diff,
				selectionSize: 25,
				events: {
					// Set the activate event to just press the radiobutton in the splits panel, simplifies the code.
					onactivate: (_) => $.DispatchEvent('Activated', $(`#Split${splitName}`), 'mouse'),
					onmouseover: (id) => {
						if (isTimeComparison) {
							const splitCompare = data as ComparisonSplit;
							this.panels.cp.SetDialogVariableFloat('total_time', splitCompare.accumulateTime);
							this.panels.cp.SetDialogVariableFloat('zone_time', data.time);
							this.panels.cp.SetDialogVariableFloat('time_diff', data.diff);
							this.panels.cp.SetDialogVariableFloat('time_delta', data.delta);
						} else {
							const statCompare = data as Timer.RunStatsComparison;
							this.panels.cp.SetDialogVariable('name', $.Localize(data.name));
							this.panels.cp.SetDialogVariableInt(
								'base_value',
								this.roundFloat(statCompare.baseValue, 2)
							);
							this.panels.cp.SetDialogVariableInt(
								'compare_value',
								this.roundFloat(statCompare.comparisonValue, 2)
							);
							this.panels.cp.SetDialogVariableInt('diff', this.roundFloat(statCompare.diff, 2));
						}
						UiToolkitAPI.ShowTextTooltip(id, tooltipString);
					},
					onmouseout: (_) => UiToolkitAPI.HideTextTooltip()
				}
			});
		}

		// Add our line to the lines array
		lineGraph.lines = [line];

		// Draw it!
		lineGraph.draw();

		// Add the positive red and blue zones to the graph. I'd rather do this here than as
		// functionality in the LineGraph component, as I doubt we'd use it anywhere else.
		// The linegraph component will destroy the previous instances of these panels on draw call though.
		const grid = this.panels.graph.FindChildTraverse('Grid');

		// Find the y position for the zones
		const yScale = grid.actuallayoutheight / grid.actualuiscale_y;

		// Position of the 0 line using (max - 0) / (max - min)
		const positiveHeight = (max / (max - min)) * yScale;
		const negativeHeight = yScale - positiveHeight;

		// Whether the invert the positive and negative zones. We don't currently have a great way of determining this,
		// the best we can do is use the units - lets add this to the stats data in the future.
		// For now, strafe sync and any speed are usually good, so invert those.
		const stat = comparisonSplits[0][0].statsComparisons[statIndex];

		$.CreatePanel('Panel', grid, '', {
			class: isPositiveGood(stat) ? 'endofrun-graph__negative' : 'endofrun-graph__positive',
			style: `
				width: 100%;
				height: ${positiveHeight}px`
		});

		$.CreatePanel('Panel', grid, '', {
			class: isPositiveGood(stat) ? 'endofrun-graph__positive' : 'endofrun-graph__negative',
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
	setSelectedSplit(split: ComparisonSplit, comparison: Timer.Comparison) {
		this.selectedSplit = split;

		this.panels.cp.SetDialogVariable('selected_zone', $.Localize(split.name));

		// Don't scroll for the overall split
		if (split.name !== 'Run_Comparison_Split_Overall') {
			this.panels.splits.FindChildTraverse(`Split${split.name}`).ScrollParentToMakePanelFit(3, false);
		}

		this.setSelectedGraphPoint();

		// Remove the zone stats. We could hardcode these in XML and not be recreating the panels and just use dialog variables,
		// but this way if different gamemodes have different stats we don't have to change the XML at all, just the input data.
		this.panels.zoneStats.RemoveAndDeleteChildren();

		// Function to create row for each stat passed in
		const createRow = (statComparison: Timer.RunStatsComparison, index: number) => {
			const row = $.CreatePanel('RadioButton', this.panels.zoneStats, '', {
				class: `endofrun-stats__row ${(index + 1) % 2 === 0 ? ' endofrun-stats__row--odd' : ''}`, // +1 to account for Times row
				selected: index === null
			});

			row.SetPanelEvent('onactivate', () => {
				this.updateGraph(comparison, index);
				this.setSelectedGraphPoint();
			});

			$.CreatePanel('Label', row, '', {
				text: $.Localize(statComparison.name),
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
				text: `${this.roundFloat(statComparison.diff, 2)}`,
				class: 'endofrun-stats__value'
			});
		};

		// Time data is stored directly in the Split, bit different from  RunStatsComparison. So just construct one in the format
		// of a RunStatComparison so createRow can handle it. index as null, so updateGraph will use the Split time rather than a stat.
		createRow(
			{
				name: '#Run_Stat_Name_Time',
				unit: '#Run_Stat_Unit_Second',
				baseValue: split.time,
				comparisonValue: split.time + split.diff,
				diff: split.diff
			},
			null
		);

		split.statsComparisons?.forEach((statComparison, i) => createRow(statComparison, i));
	}

	/**
	 * Set the selected point of the graph to whatever split is currently selected.
	 */
	setSelectedGraphPoint() {
		const split = this.selectedSplit;

		if (!split) return;

		// Don't scroll for the overall split
		if (split.name !== 'Run_Comparison_Split_Overall') {
			// Style graph node
			const selectedGraphPoint = this.panels.graph.FindChildTraverse<Button>(`Point${split.name}`);
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

	roundFloat(n: number, precision: number) {
		return +n.toFixed(precision);
	}

	getDiffSign(diff: number) {
		return diff > 0 ? '+' : '';
	}
}
