import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class HudSpectateHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel(),
		statusIcon: $<Image>('#StatusIcon')!,
		prevPlayer: $<Button>('#PrevPlayer')!,
		nextPlayer: $<Button>('#NextPlayer')!,
		replayControls: $<MomHudReplayControls>('#ReplayControls')!,
		toggleReplayControls: $<Button>('#ToggleReplayControls')!
	};

	onPanelLoad() {
		// TODO: We don't have a way to distinguish between speccing and watching replay yet,
		// needs rio code. Replay controls will be permanently visible until this.
		this.setReplayMode(true);

		// $.RegisterForUnhandledEvent('MomentumSpectatorTargetChanged', (type: RunEntityType) =>
		// 	this.onSpectatorChanged(type)
		// );
	}

	setReplayMode(enable: boolean) {
		this.panels.cp.SetDialogVariable(
			'status',
			$.Localize(enable ? '#Spectate_Status_WatchingReplay' : '#Spectate_Status_Spectating')
		);

		this.panels.statusIcon.SetImage(`file://{images}/${enable ? 'movie-open-outline' : 'eye'}.svg`);

		this.panels.prevPlayer.visible = !enable;
		this.panels.nextPlayer.visible = !enable;
		this.panels.toggleReplayControls.visible = enable;

		this.panels.replayControls.hidden = !enable;
	}

	toggleReplayControls() {
		this.panels.replayControls.hidden = !this.panels.replayControls.hidden;
	}

	// TODO: Old handler for spectator changed event
	/*onSpectatorChanged(type: RunEntityType) {
		if (type !== RunEntityType.PLAYER) {
			const isReplay = type === RunEntityType.REPLAY;

			// TODO: this needs to be done more dynamically, you can switch off replay to real players and back
			//this.panels.prevPlayer.visible = !isReplay;
			//this.panels.nextPlayer.visible = !isReplay;
			this.panels.indicatorSpectating.visible = !isReplay;

			this.panels.toggleReplayControls.visible = isReplay;
			this.panels.indicatorWatchingReplay.visible = isReplay;
		}
	}*/
}
