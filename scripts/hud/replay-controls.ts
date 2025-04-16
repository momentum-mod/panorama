import { PanelHandler } from 'util/module-helpers';
import { RunSubsegment } from '../common/timer';

enum ReplayState {
	NONE = 0,
	PLAYING = 1,
	PAUSED = 2
}

interface SliderSegment {
	startTime: number;
	endTime: number;
	panel: Panel;
	progressPanel: Panel;
}

interface CreateSliderSegmentArgs {
	index: number;
	numSegments: number;
	segmentStartTime: number;
	segmentEndTime: number;
	segmentTotalTime: number;
	runTime: number;
	hasPrerun: boolean;
	hasLabels: boolean;
	subsegments?: RunSubsegment[];
}

// Most segments we'll ever try to generate. If num segs is greater than this, to avoid
// visual bugs we bail and draw a single big segment.
const MAX_DISTINCT_SEGMENTS = 48;

@PanelHandler()
class ReplayControlsHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudReplayControls>(),
		pausePlayButton: $<Button>('#PausePlay')!,
		gotoTick: $<TextEntry>('#GotoTick')!,
		sliderContainer: $<Panel>('#TimeSliderContainer')!,
		realSlider: $<Slider>('#TimeSliderReal')!,
		fakeSliderContainer: $<Panel>('#TimeSliderFakeContainer')!
	};

	sliderSegments?: SliderSegment[];

	constructor() {
		$.RegisterForUnhandledEvent('OnControlledReplaySet', () => this.onReplaySelect());
		$.RegisterEventHandler('HudProcessInput', $.GetContextPanel(), () => this.onUpdate());
		$.RegisterEventHandler('SliderValueChanged', $.GetContextPanel(), (_, value) => MomentumReplayAPI.GoTo(value));
	}

	onReplaySelect() {
		this.panels.fakeSliderContainer.RemoveAndDeleteChildren();

		const splits = MomentumReplayAPI.GetReplayRunSplits();
		if (!splits || !splits.segments || splits.segments.length === 0) return;

		const segments = splits.segments;
		const { starttime, endtime } = MomentumReplayAPI.GetReplayProgress();
		const runTime = endtime - starttime;

		const isSingleSegment = segments.length === 1;
		const numSegments = isSingleSegment ? segments[0].subsegments.length + 1 : segments.length;
		const hasLabels = numSegments > 1;
		const hasPrerun = starttime < 0;

		const segmentArgs = {
			numSegments,
			segmentStartTime: starttime,
			segmentEndTime: endtime,
			segmentTotalTime: runTime,
			runTime,
			hasPrerun,
			hasLabels
		};

		if (numSegments > MAX_DISTINCT_SEGMENTS) {
			// Bail out early if we have an extremely high number of segments, looks terrible
			// and very uncommon
			this.panels.sliderContainer.SetHasClass('replayslider--no-labels', true);

			this.sliderSegments = [
				this.createSliderSegment({
					...segmentArgs,
					index: 0,
					numSegments: 1,
					hasLabels: false,
					hasPrerun: false
				})
			];

			return;
		}

		this.panels.sliderContainer.SetHasClass('replayslider--no-labels', !hasLabels);

		this.sliderSegments = isSingleSegment
			? segments[0].subsegments.map((subsegment, i) => {
					const startTime = subsegment.timeReached;
					const endTime =
						i === segments[0].subsegments.length - 1 ? endtime : segments[0].subsegments[i + 1].timeReached;

					return this.createSliderSegment({
						...segmentArgs,
						index: i,
						segmentStartTime: startTime,
						segmentEndTime: endTime,
						segmentTotalTime: endTime - startTime
					});
				})
			: segments.map((segment, i) => {
					const startTime = segment.subsegments[0].timeReached;
					const endTime = i === segments.length - 1 ? endtime : segments[i + 1].subsegments[0].timeReached;

					return this.createSliderSegment({
						...segmentArgs,
						index: i,
						segmentStartTime: startTime,
						segmentEndTime: endTime,
						segmentTotalTime: endTime - startTime,
						subsegments: segment.subsegments
					});
				});

		if (hasPrerun) {
			this.createPrerunSegment(starttime * -1, endtime);
		}
	}

	createSliderSegment({
		index,
		numSegments,
		segmentStartTime,
		segmentEndTime,
		segmentTotalTime,
		hasPrerun,
		hasLabels,
		subsegments
	}: CreateSliderSegmentArgs): SliderSegment {
		const outer = $.CreatePanel('Panel', this.panels.fakeSliderContainer, '', {
			style: `width: fill-parent-flow(${segmentTotalTime});`
		});
		outer.LoadLayoutSnippet('replay-segment');

		const inner = outer.GetFirstChild()!;
		if (!hasPrerun && index === 0) {
			inner.AddClass('replaysegment__inner--left');
		} else if (index === numSegments - 1) {
			inner.AddClass('replaysegment__inner--right');
		}

		// Don't create labels for very small segments, can get truncated.
		outer.SetDialogVariable('num', hasLabels && segmentTotalTime / segmentEndTime > 0.02 ? `${index + 1}` : '');

		const progressPanel = inner.FindChild<Panel>('Progress')!;

		const ssLen = subsegments?.length ?? 1;
		const subsegmentContainer = inner.FindChild('Subsegments')!;
		let first = true;
		for (let i = 0; i < ssLen; i++) {
			const a = i === 0 ? segmentStartTime : (subsegments?.[i - 1]?.timeReached ?? 0);
			const b = i === ssLen - 1 ? segmentEndTime : (subsegments?.[i]?.timeReached ?? 0);
			const w = b - a;
			if (w <= 0) continue;
			$.CreatePanel('Panel', subsegmentContainer, '', {
				class: 'replaysubsegment ' + (first ? 'replaysubsegment--first' : ''),
				style: `width: fill-parent-flow(${w});`
			});
			first = false;
		}

		return { startTime: segmentStartTime, endTime: segmentEndTime, panel: outer, progressPanel };
	}

	createPrerunSegment(length: number, runtime: number) {
		if (!this.sliderSegments) return;

		const outer = $.CreatePanel('Panel', this.panels.fakeSliderContainer, '', {
			style: `width: fill-parent-flow(${length});`
		});
		outer.LoadLayoutSnippet('replay-segment-prerun');

		this.panels.fakeSliderContainer.MoveChildBefore(outer, this.sliderSegments[0].panel);

		const inner = outer.GetFirstChild()!;

		// Conditional give an extra class for very small segments, otherwise looks weird. Essential that this
		// panel exists though, so the fill-parent-flow aligns right.
		if (length / runtime < 0.05) {
			inner.AddClass('replaysegment__inner--tiny-prerun');
		}

		this.sliderSegments.unshift({
			startTime: length * -1,
			endTime: 0,
			panel: outer,
			progressPanel: inner.GetFirstChild()!
		});
	}

	onUpdate() {
		const state = MomentumReplayAPI.GetReplayState();

		if (state === ReplayState.NONE) return;

		const progress = MomentumReplayAPI.GetReplayProgress();

		// Deal with pause/play -- play == selected
		const bPlaying = state === ReplayState.PLAYING;
		if (this.panels.pausePlayButton.checked !== bPlaying) {
			this.panels.pausePlayButton.checked = bPlaying;
		}

		this.panels.cp.SetDialogVariableInt('curr_tick', progress.curtick);
		this.panels.cp.SetDialogVariableInt('total_ticks', progress.totalticks);

		this.panels.cp.SetDialogVariableFloat('curr_time', progress.curtime);
		this.panels.cp.SetDialogVariableFloat('end_time', progress.endtime);

		this.updateSliderSegments(progress);
	}

	updateSliderSegments({ curtime, curtick, totalticks }: MomentumReplayAPI.ReplayProgress) {
		// Deal with the slider
		// Don't interfere with the slider while the user is dragging it
		if (!this.panels.realSlider.dragging) {
			const progressPercent = curtick / totalticks;
			this.panels.realSlider.SetValueNoEvents(progressPercent);
		}

		if (!this.sliderSegments) return;

		let foundActive = false;
		this.sliderSegments.forEach(({ startTime, endTime, panel, progressPanel }) => {
			// For iters on later segments after current one
			if (foundActive) {
				panel.SetHasClass('replayslider__segment--active', false);
				progressPanel.style.width = '0%';
			} else if (startTime <= curtime && curtime < endTime) {
				foundActive = true;
				panel.SetHasClass('replayslider__segment--active', true);
				const progressPercent = (curtime - startTime) / (endTime - startTime);
				// Without toFixed JS sometimes stringify with exponential notation (js lol)
				progressPanel.style.width = `${(progressPercent * 100).toFixed(10)}%`;
			} else {
				panel.SetHasClass('replayslider__segment--active', false);
				progressPanel.style.width = '100%';
			}
		});
	}

	showGoToTickDialog() {
		UiToolkitAPI.ShowCustomLayoutContextMenu(
			'GoToTickButton',
			'',
			'file://{resources}/layout/modals/context-menus/replay-goto-tick.xml'
		);
	}
}
