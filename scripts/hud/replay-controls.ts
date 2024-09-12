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
			GameInterfaceAPI.ConsoleCommand(`mom_tv_replay_goto ${value * 100}%`);
		});
	}

	toggleHiddenState() {
		this.panels.cp.ToggleHiddenState();
	}

	onHudUpdate() {
		const state = MomentumReplayAPI.GetReplayState();

		if (state === MomentumReplayAPI.ReplayState.NONE) return;

		const progress = MomentumReplayAPI.GetReplayProgress();

		// Deal with the slider
		const progressPercent = progress.curtick / progress.totalticks;
		// Don't interfere with the slider while the user is dragging it
		if (!this.panels.timeSlider.dragging) this.panels.timeSlider.SetValueNoEvents(progressPercent);

		// Deal with pause/play -- play == selected
		const bPlaying = state === MomentumReplayAPI.ReplayState.PLAYING;
		if (this.panels.pausePlayButton.checked !== bPlaying) this.panels.pausePlayButton.checked = bPlaying;

		this.panels.cp.SetDialogVariableInt('curr_tick', progress.curtick);
		this.panels.cp.SetDialogVariableInt('total_ticks', progress.totalticks);

		this.panels.cp.SetDialogVariableFloat('curr_time', progress.curtime);
		this.panels.cp.SetDialogVariableFloat('end_time', progress.endtime);
	}

	gotoTick() {
		GameInterfaceAPI.ConsoleCommand(`mom_tv_replay_goto ${this.panels.gotoTick.text}`);
	}
}
