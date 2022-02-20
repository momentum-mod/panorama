'use strict';

// This is mirrored from C++ code! Do not change whimsically!
const RUN_ENT_TYPE = {
	RUN_ENT_PLAYER: 0,
	RUN_ENT_GHOST: 1,
	RUN_ENT_REPLAY: 2,
	RUN_ENT_ONLINE: 3,
};

class HudSpectate {
	static panels = {
		indicatorSpectating: $('#IndicatorSpectating'),
		indicatorWatchingReplay: $('#IndicatorWatchingReplay'),
		//targetName: $('#TargetName'),
		//prevPlayer: $('#PrevPlayer'),
		//nextPlayer: $('#NextPlayer'),
		replayControls: $('#ReplayControls'),
		toggleReplayControls: $('#ToggleReplayControls')
	}

	static onSpectatorChanged( type ) {
		if (type >= RUN_ENT_TYPE.RUN_ENT_GHOST) {
			const bReplay = type === RUN_ENT_TYPE.RUN_ENT_REPLAY;

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
