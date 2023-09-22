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
		// Deal with the slider
		const currentTick = MomentumReplayAPI.GetCurrentTick();
		const totalTicks = MomentumReplayAPI.GetTotalTicks();
		const flProgress = currentTick / totalTicks;
		// Don't interfere with the slider while the user is dragging it
		if (!this.panels.timeSlider.dragging) this.panels.timeSlider.SetValueNoEvents(flProgress);

		// Deal with pause/play -- play == selected
		const bPlaying = !MomentumReplayAPI.IsPaused();
		if (this.panels.pausePlayButton.checked !== bPlaying) this.panels.pausePlayButton.checked = bPlaying;

		$.GetContextPanel().SetDialogVariableInt('curr_tick', currentTick);
		$.GetContextPanel().SetDialogVariableInt('total_ticks', totalTicks);

		$.GetContextPanel().SetDialogVariableFloat('curr_time', MomentumReplayAPI.GetCurrentTime());
		$.GetContextPanel().SetDialogVariableFloat('total_time', MomentumReplayAPI.GetTotalTime());
	}

	static gotoTick() {
		GameInterfaceAPI.ConsoleCommand('mom_replay_goto ${this.panels.gotoTick.text}');
	}

	static onSliderValueChanged(_panel, flProgress) {
		MomentumReplayAPI.SetProgress(flProgress);
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onProcessInput.bind(this));
		$.RegisterEventHandler('SliderValueChanged', $.GetContextPanel(), this.onSliderValueChanged.bind(this));
	}
}
