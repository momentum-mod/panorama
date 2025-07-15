import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class HudSpectateHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<MomHudSpectate>(),
		statusIcon: $<Image>('#StatusIcon')!,
		prevPlayer: $<Button>('#PrevPlayer')!,
		nextPlayer: $<Button>('#NextPlayer')!,
		replayControls: $<MomHudReplayControls>('#ReplayControls')!,
		toggleReplayControls: $<Button>('#ToggleReplayControls')!
	};

	constructor() {
		$.RegisterForUnhandledEvent('ObserverTargetChanged', () => this.update());
		$.RegisterForUnhandledEvent('MomentumSpectatorModeChanged', (newMode) => this.onSpectatorModeChange(newMode));
	}

	onPanelLoad() {
		this.update();
	}

	update() {
		const { name, isReplay } = this.panels.cp;

		this.panels.cp.SetDialogVariable('spec_target', name);

		this.panels.cp.SetDialogVariable(
			'status',
			$.Localize(isReplay ? '#Spectate_Status_WatchingReplay' : '#Spectate_Status_Spectating')
		);

		this.panels.statusIcon.SetImage(`file://{images}/${isReplay ? 'movie-open-outline' : 'eye'}.svg`);

		this.panels.prevPlayer.visible = !isReplay;
		this.panels.nextPlayer.visible = !isReplay;
		this.panels.toggleReplayControls.visible = isReplay;

		this.panels.replayControls.hidden = !isReplay;
	}

	toggleReplayControls() {
		this.panels.replayControls.hidden = !this.panels.replayControls.hidden;
	}

	onSpectatorModeChange(newMode: SpectateMode) {
		let modeText = '';
		switch (newMode) {
			case SpectateMode.IN_EYE:
				modeText = $.Localize('#OBS_IN_EYE');
				break;
			case SpectateMode.CHASE:
				modeText = $.Localize('#OBS_CHASE_LOCKED');
				break;
			case SpectateMode.ROAMING:
				modeText = $.Localize('#OBS_ROAMING');
				break;
		}

		this.panels.cp.SetDialogVariable('curr_spec_mode', modeText);
	}
}
