class HudSpectate {
	static panels = {
		indicatorSpectating: $('#IndicatorSpectating'),
		indicatorWatchingReplay: $('#IndicatorWatchingReplay'),
		//targetName: $('#TargetName'),
		//prevPlayer: $('#PrevPlayer'),
		//nextPlayer: $('#NextPlayer'),
		replayControls: $('#ReplayControls'),
		toggleReplayControls: $('#ToggleReplayControls')
	};

	static onSpectatorChanged(type) {
		if (type >= RunEntType.GHOST) {
			const bReplay = type === RunEntType.REPLAY;

			// TODO: this needs to be done more dynamically, you can switch off replay to real players and back
			//this.panels.prevPlayer.visible = !bReplay;
			//this.panels.nextPlayer.visible = !bReplay;
			this.panels.indicatorSpectating.visible = !bReplay;

			this.panels.toggleReplayControls.visible = bReplay;
			this.panels.indicatorWatchingReplay.visible = bReplay;
		}
	}

	static {
		$.RegisterForUnhandledEvent('MomentumSpectatorTargetChanged', this.onSpectatorChanged.bind(this));
	}
}
