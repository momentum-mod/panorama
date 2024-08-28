import { PanelHandler } from 'util/module-helpers';
import { RunEntityType } from 'common/timer';

@PanelHandler()
class HudSpectateHandler {
	readonly panels = {
		indicatorSpectating: $('#IndicatorSpectating'),
		indicatorWatchingReplay: $('#IndicatorWatchingReplay'),
		//targetName: $('#TargetName'),
		//prevPlayer: $('#PrevPlayer'),
		//nextPlayer: $('#NextPlayer'),
		replayControls: $('#ReplayControls'),
		toggleReplayControls: $('#ToggleReplayControls')
	};

	constructor() {
		$.RegisterForUnhandledEvent('MomentumSpectatorTargetChanged', (type: RunEntityType) =>
			this.onSpectatorChanged(type)
		);
	}

	onSpectatorChanged(type: RunEntityType) {
		if (type !== RunEntityType.PLAYER) {
			const isReplay = type === RunEntityType.REPLAY;

			// TODO: this needs to be done more dynamically, you can switch off replay to real players and back
			//this.panels.prevPlayer.visible = !isReplay;
			//this.panels.nextPlayer.visible = !isReplay;
			this.panels.indicatorSpectating.visible = !isReplay;

			this.panels.toggleReplayControls.visible = isReplay;
			this.panels.indicatorWatchingReplay.visible = isReplay;
		}
	}
}
