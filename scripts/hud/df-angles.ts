import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import { DFHudComponent, getDFHudHighlights } from 'common/df-hud';

/** Numeric view pitch and yaw, highlighted along with the pitch lines and compass ticks */
@PanelHandler()
class DFAnglesHandler extends DFHudComponent {
	pitchStat = $<Label>('#PitchStat');
	yawStat = $<Label>('#YawStat');

	anglesPitchEnable: boolean;
	anglesYawEnable: boolean;
	anglesColor: rgbaColor;
	anglesHlColor: rgbaColor;

	constructor() {
		super();

		this.registerComponent(
			'#Customizer_Df_Angles_Name',
			GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			{
				pitchEnable: this.checkboxStyle(
					'#Customizer_Df_Angles_Pitch',
					(value) => (this.anglesPitchEnable = value)
				),
				yawEnable: this.checkboxStyle('#Customizer_Df_Angles_Yaw', (value) => (this.anglesYawEnable = value)),
				colors: this.groupStyle('#Customizer_Colors', ['color', 'highlightColor']),
				color: this.colorStyle('#Customizer_Color', (value) => (this.anglesColor = value)),
				highlightColor: this.colorStyle(
					'#Customizer_Df_HighlightColor',
					(value) => (this.anglesHlColor = value)
				)
			},
			{ moveX: true, moveY: true, description: '#Customizer_Df_Angles_Name_Tooltip' }
		);
	}

	applyConfig() {
		this.pitchStat.visible = this.anglesPitchEnable;
		this.yawStat.visible = this.anglesYawEnable;
	}

	onUpdate() {
		const state = this.getFrameState();
		if (!state.valid) return;

		// the pitch and compass components decide when their numbers light up
		const highlights = getDFHudHighlights();

		if (this.anglesYawEnable) {
			this.yawStat.text = state.viewYaw.toFixed(0);
			this.yawStat.style.color = highlights.yaw?.(state) ? this.anglesHlColor : this.anglesColor;
		}

		if (this.anglesPitchEnable) {
			this.pitchStat.text = state.viewPitch.toFixed(1);
			this.pitchStat.style.color = highlights.pitch?.(state) ? this.anglesHlColor : this.anglesColor;
		}
	}
}
