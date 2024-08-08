const ReplayState = {
	NONE: 0,
	PLAYING: 1,
	PAUSED: 2
};

class ReplayControls {
	static panels = {
		timeSlider: $('#ReplayControlsTimeSlider'),
		pausePlayButton: $('#ReplayControlsPausePlay'),
		gotoTick: $('#ReplayControlsGotoTick')
	};

	static toggleHiddenState() {
		$.GetContextPanel().ToggleHiddenState();
	}

	static onProcessInput() {
		const state = MomentumReplayAPI.GetReplayState();

		if (state === ReplayState.NONE) return;

		const progress = MomentumReplayAPI.GetReplayProgress();

		const progressPercent = progress.curtick / progress.totalticks;
		// Don't interfere with the slider while the user is dragging it
		if (!this.panels.timeSlider.dragging) this.panels.timeSlider.SetValueNoEvents(progressPercent);

		// Deal with pause/play -- play == selected
		const bPlaying = state === ReplayState.PLAYING;
		if (this.panels.pausePlayButton.checked !== bPlaying) this.panels.pausePlayButton.checked = bPlaying;

		$.GetContextPanel().SetDialogVariableInt('curr_tick', progress.curtick);
		$.GetContextPanel().SetDialogVariableInt('total_ticks', progress.totalticks);

		$.GetContextPanel().SetDialogVariableFloat('curr_time', progress.curtime);
		$.GetContextPanel().SetDialogVariableFloat('end_time', progress.endtime);
	}

	static gotoTick() {
		GameInterfaceAPI.ConsoleCommand(`mom_tv_replay_goto ${this.panels.gotoTick.text}`);
	}

	static onSliderValueChanged(_panel, flProgress) {
		GameInterfaceAPI.ConsoleCommand(`mom_tv_replay_goto ${flProgress * 100}%`);
	}

	static {
		$.RegisterEventHandler('HudProcessInput', $.GetContextPanel(), this.onProcessInput.bind(this));
		$.RegisterEventHandler('SliderValueChanged', $.GetContextPanel(), this.onSliderValueChanged.bind(this));
	}
}
