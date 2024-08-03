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

	static onSpectatorChanged(type: Run.RunEntityType) {
		if (type !== Globals.Run.RunEntityType.PLAYER) {
			const isReplay = type === Globals.Run.RunEntityType.REPLAY;

			// TODO: this needs to be done more dynamically, you can switch off replay to real players and back
			//this.panels.prevPlayer.visible = !isReplay;
			//this.panels.nextPlayer.visible = !isReplay;
			this.panels.indicatorSpectating.visible = !isReplay;

			this.panels.toggleReplayControls.visible = isReplay;
			this.panels.indicatorWatchingReplay.visible = isReplay;
		}
	}

	static {
		$.RegisterForUnhandledEvent('MomentumSpectatorTargetChanged', (type: Run.RunEntityType) =>
			this.onSpectatorChanged(type)
		);
	}
}
