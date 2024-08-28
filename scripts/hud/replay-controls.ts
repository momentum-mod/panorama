import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ReplayControlsHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudReplayControls>(),
		timeSlider: $<Slider>('#ReplayControlsTimeSlider'),
		pausePlayButton: $<Button>('#ReplayControlsPausePlay'),
		gotoTick: $<TextEntry>('#ReplayControlsGotoTick')
	};

	constructor() {
		$.RegisterForUnhandledEvent('HudProcessInput', () => this.onHudUpdate());
		$.RegisterEventHandler('SliderValueChanged', $.GetContextPanel(), (_, value) => {
			MomentumReplayAPI.SetProgress(value);
		});
	}

	toggleHiddenState() {
		this.panels.cp.ToggleHiddenState();
	}

	onHudUpdate() {
		// Deal with the slider
		const currentTick = MomentumReplayAPI.GetCurrentTick();
		const totalTicks = MomentumReplayAPI.GetTotalTicks();
		const flProgress = currentTick / totalTicks;
		// Don't interfere with the slider while the user is dragging it
		if (!this.panels.timeSlider.dragging) this.panels.timeSlider.SetValueNoEvents(flProgress);

		// Deal with pause/play -- play == selected
		const bPlaying = !MomentumReplayAPI.IsPaused();
		if (this.panels.pausePlayButton.checked !== bPlaying) this.panels.pausePlayButton.checked = bPlaying;

		this.panels.cp.SetDialogVariableInt('curr_tick', currentTick);
		this.panels.cp.SetDialogVariableInt('total_ticks', totalTicks);

		this.panels.cp.SetDialogVariableFloat('curr_time', MomentumReplayAPI.GetCurrentTime());
		this.panels.cp.SetDialogVariableFloat('total_time', MomentumReplayAPI.GetTotalTime());
	}

	gotoTick() {
		GameInterfaceAPI.ConsoleCommand(`mom_replay_goto ${this.panels.gotoTick.text}`);
	}
}
