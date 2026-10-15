import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import * as MomMath from 'util/math';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { DFHudComponent } from 'common/df-hud';

@PanelHandler()
class DFPitchHandler extends DFHudComponent {
	pitchLineContainer = $('#PitchLines');

	pitchEnable: boolean;
	pitchTargets: number[];
	pitchWidth: float;
	pitchOffset: float;
	pitchColor: rgbaColor;
	pitchHlColor: rgbaColor;

	constructor() {
		super();

		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			onLoad: () => this.onLoad(),
			handledEvents: [
				{
					event: 'HudProcessInput',
					panel: $.GetContextPanel(),
					callback: () => this.onUpdate()
				}
			]
		});

		$.RegisterForUnhandledEvent('OnDefragHUDCompassChange', () => this.onPitchConfigChange());
	}

	onLoad() {
		this.projection = DefragAPI.GetHUDProjection();
		this.onPitchConfigChange();
	}

	onPitchConfigChange() {
		const pitchConfig = $.GetContextPanel<MomHudDFPitch>().GetPitchCFG();
		this.pitchEnable = pitchConfig.pitchEnable;
		this.pitchTargets = String(pitchConfig.pitchTarget).split(' ').map(Number);
		this.pitchWidth = pitchConfig.pitchWidth;
		this.pitchOffset = pitchConfig.pitchOffset;
		this.pitchColor = pitchConfig.color;
		this.pitchHlColor = pitchConfig.highlightColor;

		this.pitchLineContainer.style.width = this.pitchWidth + 'px';
		this.pitchLineContainer.style.transform = `translatex( ${this.pitchOffset}px )`;

		const pitchLines = this.pitchLineContainer?.Children();
		if (this.pitchTargets.length > pitchLines?.length) {
			for (let i = pitchLines?.length; i < this.pitchTargets.length; ++i) {
				$.CreatePanel('Panel', this.pitchLineContainer, `PitchTarget${i}`, {
					class: 'dfpitch__line'
				});
			}
		}
		if (this.pitchTargets.length < pitchLines?.length) {
			for (let i = this.pitchTargets.length; i < pitchLines?.length; ++i) {
				pitchLines[i].DeleteAsync(0);
			}
		}
	}

	onUpdate() {
		const state = DefragAPI.GetHUDFrameState();
		if (!state.valid) return;

		this.updateView(state);

		if (this.pitchEnable) {
			const pitchLines = this.pitchLineContainer.Children();
			const viewPitch = state.viewPitch;
			for (let i = 0; i < pitchLines?.length; ++i) {
				const pitchDelta = this.pitchTargets[i] - viewPitch;
				const pitchDeltaPx = MomMath.mapAngleToScreenDist(
					(pitchDelta * Math.PI) / 180,
					this.halfVFov,
					this.screenY,
					this.scale,
					this.projection
				);
				pitchLines[i].style.position = `0px ${this.NaNCheck(pitchDeltaPx, 0)}px 0px`;
				pitchLines[i].style.backgroundColor = Math.abs(pitchDelta) > 0.15 ? this.pitchColor : this.pitchHlColor;
			}
		}
	}
}
