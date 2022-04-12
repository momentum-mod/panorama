'use strict';

class EndOfRun {
	/**
	 * @property {object} panels - Collection of cached panels.
	 */
	static panels = {
		/** @type {Panel} @static */
		cp: $.GetContextPanel(),
		/** @type {Label} @static */
		time: $('#RunTime'),
		/** @type {Label} @static */
		diff: $('#RunDiff'),
		/** @type {Panel} @static */
		splits: $('#Splits'),
		/** @type {Panel} @static */
		detailedStats: $('#DetailedStats'),
		/** @type {LineGraph} @static */
		graph: $('#SplitsGraph'),
		/** @type {Panel} @static */
		zoneStats: $('#ZoneStats'),
		/** @type {Panel} @static */
		runStatusIndicators: $('#RunStatusIndicators'),
		/** @type {Image} @static */
		saveStatus: $('#SaveStatus'),
		/** @type {Image} @static */
		uploadStatus: $('#UploadStatus'),
		/** @type {Panel} @static */
		actionButtons: $('#EndOfRunActionButtons'),
		/** @type {Panel} @static */
		selectedGraphPoint: null
	};

	/**
	 * @property {Split} The currently selected split
	 */
	static selectedSplit;

	static {
		$.RegisterForUnhandledEvent('EndOfRun_CompareRuns', (baseRun, compareRun) => this.showNewEndOfRun(baseRun, compareRun));
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', this.initOnMapLoad.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Show', this.onShowEndOfRun.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunUpload', this.updateRunUploadStatus.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunSave', this.updateRunSavedStatus.bind(this));
	}

	/**
	 * Fired when either when the local player's run ends, a replay run ends,
	 * you go back to a last EoR from leaderboards, or in the future when the player compares two runs.
	 * @param {EndOfRunShowReason} showReason - Why the end of run panel is being shown. See EndOfRunShowReason for reasons.
	 */
	static onShowEndOfRun(showReason) {
		if (showReason === EndOfRunShowReason.PLAYER_FINISHED_RUN) {
			this.panels.runStatusIndicators.visible = true;
			this.panels.actionButtons.visible = true;
			this.updateRunStatusIndicator(RUN_STATUS_STATES.PROGRESS, RUN_STATUS_TYPES.SAVE);
			this.updateRunStatusIndicator(RUN_STATUS_STATES.PROGRESS, RUN_STATUS_TYPES.UPLOAD);
		}
		else {
			this.panels.runStatusIndicators.visible = false;
			this.panels.actionButtons.visible = false;
		}
	}

	/**
	 * Hides the end of run panel, when a new map is loaded.
	 * @param {boolean} isOfficial
	 */
	static initOnMapLoad(isOfficial) {
		this.panels.uploadStatus.SetHasClass('hide', !isOfficial);

		this.hideEndOfRun(true, false);
	}

	/**
	 * Update a status indicator
	 * @param {RUN_STATUS_STATES} status
	 * @param {RUN_STATUS_TYPES} type
	 */
	static updateRunStatusIndicator(status, type) {
		const statusPanel = type === RUN_STATUS_TYPES.UPLOAD ? this.panels.uploadStatus : this.panels.saveStatus;

		statusPanel.SetHasClass('spin-clockwise', status === RUN_STATUS_STATES.PROGRESS);
		statusPanel.SetHasClass('endofrun__run-status-indicator--progress', status === RUN_STATUS_STATES.PROGRESS);
		statusPanel.SetHasClass('endofrun__run-status-indicator--success', status === RUN_STATUS_STATES.SUCCESS);
		statusPanel.SetHasClass('endofrun__run-status-indicator--error', status === RUN_STATUS_STATES.ERROR);

		let icon, text, style;

		switch (status) {
			case RUN_STATUS_STATES.PROGRESS:
				icon = `file://{images}/${RUN_STATUS_ICONS.PROGRESS}.svg`;
				break;
			case RUN_STATUS_STATES.SUCCESS:
				icon = `file://{images}/${type === RUN_STATUS_TYPES.UPLOAD ? RUN_STATUS_ICONS.UPLOAD : RUN_STATUS_ICONS.SAVE}.svg`;
				text = type === RUN_STATUS_TYPES.UPLOAD ? 'Your run has been uploaded to the submission server!' : 'Your run has been saved locally!';
				style = 'positive';
				break;
			case RUN_STATUS_STATES.ERROR:
			default:
				icon = `file://{images}/${RUN_STATUS_ICONS.ERROR}.svg`;
				text =
					type === RUN_STATUS_TYPES.UPLOAD
						? 'Error: Your run failed to upload! You may be offline, or the submission server may be down.'
						: 'Error: Your run failed to save to disk!';
				style = 'error';
		}

		statusPanel.SetImage(icon);

		if (text) {
			statusPanel.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTitleImageTextTooltipStyled(statusPanel.id, '', icon, text, `tooltip--notitle--${style}`));
		} else {
			statusPanel.ClearPanelEvent('onmouseover');
		}
	}

	static updateRunSavedStatus(saved) {
		this.updateRunStatusIndicator(saved ? RUN_STATUS_STATES.SUCCESS : RUN_STATUS_STATES.ERROR, RUN_STATUS_TYPES.SAVE);
	}

	static updateRunUploadStatus(uploaded, _cosXp, _rankXp, _lvlGain) {
		this.updateRunStatusIndicator(uploaded ? RUN_STATUS_STATES.SUCCESS : RUN_STATUS_STATES.ERROR, RUN_STATUS_TYPES.UPLOAD);
	}

	static watchReplay() {
		GameInterfaceAPI.ConsoleCommand('mom_replay_play_loaded');
		this.hideEndOfRun(false, true);
	}

	static restartMap() {
		GameInterfaceAPI.ConsoleCommand('mom_restart');
		this.hideEndOfRun(true, true);
	}

	/**
	 *
	 * @param {boolean} hideEndOfRun
	 * @param {boolean} hideLeaderboards
	 */
	static hideEndOfRun(hideEndOfRun = true, hideLeaderboards = false) {
		if (hideEndOfRun) $.DispatchEvent('EndOfRun_Hide');

		if (hideLeaderboards) $.DispatchEvent('HudLeaderboards_ForceClose');
	}

	/**
	 * Reset and determine how to generate the end of run panel.
	 * The comparision run can be null, in which case we don't show splits or the graph.
	 * @param {Object} runObj 				- The run to show end of run for
	 * @param {Object} comparisonRunObj		- The comparison run
	 */
	static showNewEndOfRun(runObj, comparisonRunObj) {
		if (!runObj) return;

		const run = new Run(runObj);

		// Remove the previous splits, if any
		this.panels.splits.RemoveAndDeleteChildren();

		// Remove any previous styling
		this.panels.cp.RemoveClass('endofrun--first');
		this.panels.cp.RemoveClass('endofrun--ahead');
		this.panels.cp.RemoveClass('endofrun--behind');

		this.panels.cp.SetDialogVariableFloat('run_time', runObj.runTime);

		// If we have a comparison, make the full stats, otherwise just simple page without graph
		if (comparisonRunObj) {
			this.setComparisionStats(run, new Run(comparisonRunObj));
		} else {
			this.setSingleRunStats(run);
		}
	}
	/**
	 * Generate the end of run panel for a run with no comparison.
	 * @param {Run} run	- The run to show end of run for
	 */
	static setSingleRunStats(run) {
		// Clear the diff string, we don't have one
		this.panels.cp.SetDialogVariable('run_diff_prefix', '');
		this.panels.cp.SetDialogVariableFloat('run_diff', 0);

		// Give the styling for a first/no comparsion set run
		this.panels.cp.AddClass('endofrun--first');

		// Loop through each zone in the run and create a neutral Split panel with no diff/delta
		run.stats.zones.forEach((zone, i) => {
			const splitWrapper = $.CreatePanel('Panel', this.panels.splits, `Split${zone.name}`, {
				class: 'endofrun__split'
			});

			Object.assign($.CreatePanel('Split', splitWrapper, '', { class: 'split--eor' }), {
				name: zone.name,
				time: zone.accumulateTime,
				isFirst: true
			});

			if (i === run.numZones - 1) splitWrapper.ScrollParentToMakePanelFit(3, false);
		});

		this.panels.cp.SetDialogVariable('comparison_name', '');

		this.panels.detailedStats.AddClass('endofrun__stats--hidden');
	}

	/**
	 * Generate the end of run panel comparisions from two runs.
	 * @param {Run} run 			- The run to show end of run for
	 * @param {Run} comparisonRun	- The comparison run
	 */
	static setComparisionStats(run, comparisonRun) {
		// Generate a comparison
		if (run.numZones !== comparisonRun.numZones) {
			$.Warning('Comparison: Base run and comparison run have different number of zones!');
			return;
		}

		const comparison = new Comparison(run, comparisonRun);

		// Are we ahead? Probably don't need a class for if you're exactly identical
		const isAhead = comparison.diff < 0;

		// Set the diff
		this.panels.cp.SetDialogVariable('run_diff_prefix', isAhead ? '' : '+');
		this.panels.cp.SetDialogVariableFloat('run_diff', comparison.diff);

		// Set styling based on if we're ahead or behind
		this.panels.cp.SetHasClass('endofrun--ahead', isAhead);
		this.panels.cp.SetHasClass('endofrun--behind', !isAhead);

		// Create an empty Radiobutton with no styling for overall, so we have something to remove selection from when deselecting another split
		const overallSplitPanel = $.CreatePanel('RadioButton', this.panels.splits, 'Split0', { group: 'end-of-run-split-buttons' });

		// Create splits for every comparison
		comparison.splits.forEach((split, i) => {
			// Create radiobutton rather than regular panel to wrap the split in
			const button = $.CreatePanel('RadioButton', this.panels.splits, `Split${split.name}`, {
				class: 'endofrun__split-button',
				group: 'end-of-run-split-buttons'
			});

			// Wrapper button updates selected stats and graph point
			button.SetPanelEvent('onactivate', () => {
				if (this.selectedSplit === split) {
					$.DispatchEvent('Activated', overallSplitPanel, 'mouse');
					this.setSelectedSplit(comparison.overallSplit, comparison);
				} else this.setSelectedSplit(split, comparison);
			});

			Object.assign($.CreatePanel('Split', button, '', { class: 'split--eor' }), {
				name: split.name,
				time: split.accumulateTime,
				isFirst: false,
				diff: split.diff,
				delta: split.delta
			});

			// Scroll the rightmost split
			if (i === comparison.splits.length - 1) button.ScrollParentToMakePanelFit(3, false);
		});

		// Make the graph
		this.updateGraph(comparison, null);

		// Set the comparison name to appear in the stats bit
		$.GetContextPanel().SetDialogVariable('comparison_name', comparisonRun.playerName);

		// Default to overall
		this.setSelectedSplit(comparison.overallSplit, comparison);

		this.panels.detailedStats.RemoveClass('endofrun__stats--hidden');
	}

	/**
	 * Generate a graph for the given comparison
	 * @param {Comparison} comparison
	 */
	static updateGraph(comparison, statIndex = null) {
		// Grab the actual LineGraph class attached to the panel
		const lineGraph = this.panels.graph.jsClass;

		// Can't find a better way to wait until the panel actually has a height set. ReadyForDisplay doesn't wanna fire.
		// Please don't kill me.
		if (lineGraph.width === 0 || lineGraph.height === 0) {
			const setDimensionsAsSoonAsPossible = (i) => {
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
		let line = {
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

		let max = 0;
		let min = 0;

		// Point for each zone
		const comparisonSplits = comparison.splits;

		const numZones = comparisonSplits.length;

		const useStat = statIndex !== null;
		const isPositiveGood = (s) => useStat && (s.unit === 'units/sec' || s.name.includes('Strafe Sync'));

		// Find max and min diff for the run
		comparisonSplits.forEach((split) => {
			max = Math.max(max, useStat ? split.statsComparisons[statIndex].diff : split.diff);
			min = Math.min(min, useStat ? split.statsComparisons[statIndex].diff : split.diff);
		});

		// Add some vertical spacing to the graph
		const spacing = (max - min) / 10;
		if (max > 0 && max != comparisonSplits.at(-1).diff) max += spacing;
		if (min < 0 && min != comparisonSplits.at(-1).diff) min -= spacing;

		const range = max - min;

		// Calculate an appropriate interval value for the Y axis.
		// scaleFactor gets us in the right range (0.1 < x < 1 => 0.1, 1 < x < 10 => 1, 10 < x < 100 => 10, etc)
		const scaleFactor = 10 ** Math.floor(Math.log10(range));

		max = Math.ceil(max / scaleFactor) * scaleFactor;
		min = Math.floor(min / scaleFactor) * scaleFactor;

		if (isNaN(max)) max = 0;
		if (isNaN(min)) min = 0;

		// Occasionally stats have no diff at all so range = 0. Set to arbitrary sensible values to avoid division by 0 in the graph.
		if (max === 0 && min === 0) {
			max = 1;
			min = -1;
		}

		// Now decide whether to increase the number of intervals. This is just based on what looks good to me.
		let yInterval;
		if (range / scaleFactor >= 2) yInterval = scaleFactor;
		else if (range / scaleFactor >= 1) yInterval = scaleFactor / 2;
		else yInterval = scaleFactor / 4;

		// Set the axis
		lineGraph.axis = [
			{
				min: 0,
				max: numZones,
				name: 'Zone',
				// Limit max zones we draw an axis for to 30
				// todo: find interval equiv to this: lineCount: Math.min(numZones, 30),
				interval: 1
			},
			{
				min: min,
				max: max,
				name: useStat ? comparisonSplits[0].statsComparisons[statIndex].name : 'Time',
				interval: yInterval
			}
		];

		// Make our points
		comparisonSplits.forEach((split, i) => {
			const splitName = split.name;
			const data = useStat ? { ...split.statsComparisons[statIndex], time: 0, delta: 0 } : split;
			const isTimeComparison = !useStat || data.unit === 's';

			const round = (n) => n.toFixed(2);
			const diffSign = (diff) => (diff > 0 ? '+' : diff == 0 ? '±' : '');

			let tooltipString;
			const compareVal = isPositiveGood(data) ? -data.diff : data.diff;
			const diffStyle = compareVal < 0 ? 'split--ahead ' : compareVal > 0 ? 'split--behind ' : '';
			if (isTimeComparison) {
				const deltaStyle =
					(data.diff < 0 ? 'split--ahead ' : data.diff > 0 ? 'split--behind ' : '') + (data.delta < 0 ? 'split--gain' : data.delta > 0 ? 'split--loss' : '');

				tooltipString =
					`Total Time: <b>{g:time:total_time}</b>\n` +
					`Zone Time: <b>{g:time:zone_time}</b>\n` +
					`Diff: <b class='${diffStyle}'>${diffSign(data.diff)}{g:time:time_diff}</b>\n` +
					`Delta: <b class='${deltaStyle}'>${diffSign(data.delta)}{g:time:time_delta}</b>`;
			} else {
				// Using string instead of float here, floats add a shitton of floating point imprecision e.g. 90.00000000128381273
				tooltipString = `{s:name}: <b>{s:base_value}</b>\n` + `Comparison: <b>{s:compare_value}</b>\n` + `Diff: <b class='${diffStyle}'>${diffSign(data.diff)}{s:diff}</b>`;
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
							this.panels.cp.SetDialogVariableFloat('total_time', data.accumulateTime);
							this.panels.cp.SetDialogVariableFloat('zone_time', data.time);
							this.panels.cp.SetDialogVariableFloat('time_diff', data.diff);
							this.panels.cp.SetDialogVariableFloat('time_delta', data.delta);
						} else {
							this.panels.cp.SetDialogVariable('name', data.name);
							this.panels.cp.SetDialogVariable('base_value', round(data.baseValue));
							this.panels.cp.SetDialogVariable('compare_value', round(data.comparisonValue));
							this.panels.cp.SetDialogVariable('diff', round(data.diff));
						}
						UiToolkitAPI.ShowTextTooltip(id, tooltipString);
					},
					onmouseout: (_) => UiToolkitAPI.HideTextTooltip()
				}
			});
		});

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
		const stat = comparisonSplits[0].statsComparisons[statIndex];

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

	/**
	 * Set the selected graph point and stats for a given split
	 * @param {Split} split
	 * @param {Comparison} comparison
	 */
	static setSelectedSplit(split, comparison) {
		this.selectedSplit = split;

		this.panels.cp.SetDialogVariable('selected_zone', split.name);

		// Don't scroll for the overall split
		if (split.name !== 'Overall') {
			this.panels.splits.FindChildTraverse(`Split${split.name}`).ScrollParentToMakePanelFit(3, false);
		}

		this.setSelectedGraphPoint();

		// Remove the zone stats. We could hardcode these in XML and not be recreating the panels and just use dialog variables,
		// but this way if different gamemodes have different stats we don't have to change the XML at all, just the input data.
		this.panels.zoneStats.RemoveAndDeleteChildren();

		// Function to create row for each stat passed in
		const createRow = (statComparison, index) => {
			const round = (n) => parseFloat(n.toFixed(2));

			const row = $.CreatePanel('RadioButton', this.panels.zoneStats, '', {
				class: `endofrun-stats__row ${(index + 1) % 2 == 0 ? ' endofrun-stats__row--odd' : ''}`, // +1 to account for Times row
				selected: index === null
			});

			row.SetPanelEvent('onactivate', () => {
				this.updateGraph(comparison, index);
				this.setSelectedGraphPoint();
			});

			$.CreatePanel('Label', row, '', {
				text: statComparison.name,
				class: 'endofrun-stats__name'
			});

			$.CreatePanel('Label', row, '', {
				text: `${round(statComparison.baseValue)}`,
				class: 'endofrun-stats__value'
			});

			$.CreatePanel('Label', row, '', {
				text: `${round(statComparison.comparisonValue)}`,
				class: 'endofrun-stats__value'
			});

			$.CreatePanel('Label', row, '', {
				text: `${round(statComparison.diff)}`,
				class: 'endofrun-stats__value'
			});
		};

		// Time data is stored directly in the Split, bit different from  RunStatsComparison. So just construct one in the format
		// of a RunStatComparison so createRow can handle it. index as null, so updateGraph will use the Split time rather than a stat.
		createRow({ name: 'Time', unit: 's', baseValue: split.time, comparisonValue: split.time + split.diff, diff: split.diff }, null);

		split.statsComparisons.forEach((statComparison, i) => createRow(statComparison, i));
	}

	/**
	 * Set the selected point of the graph to whatever split is currently selected.
	 */
	static setSelectedGraphPoint() {
		const split = this.selectedSplit;

		if (!split) return;

		// Don't scroll for the overall split
		if (split.name !== 'Overall') {
			// Style graph node
			const selectedGraphPoint = this.panels.graph.FindChildTraverse(`Point${split.name}`);
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
}
