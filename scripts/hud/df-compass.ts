import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import { DFHudComponent, getDFHudHighlights } from 'common/df-hud';

/** Ticks on the 45 degree yaw lines, highlighted while the velocity is on one */
@PanelHandler()
class DFCompassHandler extends DFHudComponent {
	tickContainer = $('#CompassTicks');
	ticks: GenericPanel[] = [];

	compassTickSize: number;
	compassTicksBottom: boolean;
	compassColor: rgbaColor;
	compassHlColor: rgbaColor;

	/** Highlights only apply when moving faster than this */
	compassMinSpeed: number;

	constructor() {
		super();

		// only up to 180 degrees are ever shown, so only 4 ticks are
		// needed to represent all potentially visible 45-degree marks
		for (let i = 0; i < 4; ++i) {
			const newTick = $.CreatePanel('Panel', this.tickContainer, `CompassTick${i}`, {
				class: 'dfcompass__tick'
			});
			newTick.AddClass(i % 2 ? 'dfcompass__tick--half' : 'dfcompass__tick--full');
			this.ticks.push(newTick);
		}

		this.registerComponent(
			'#Customizer_Df_Compass_Name',
			GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			{
				minSpeed: this.numberStyle(
					'#Customizer_Df_MinSpeed',
					0,
					10000,
					(value) => (this.compassMinSpeed = value)
				),
				tickSize: this.numberStyle(
					'#Customizer_Df_Compass_TickSize',
					1,
					50,
					(value) => (this.compassTickSize = value)
				),
				ticksBottom: this.checkboxStyle(
					'#Customizer_Df_Compass_TicksBottom',
					(value) => (this.compassTicksBottom = value)
				),
				colors: this.groupStyle('#Customizer_Colors', ['color', 'highlightColor']),
				color: this.colorStyle('#Customizer_Color', (value) => (this.compassColor = value)),
				highlightColor: this.colorStyle(
					'#Customizer_Df_HighlightColor',
					(value) => (this.compassHlColor = value)
				)
			},
			{ resizeY: true, heightStyle: { styleID: 'tickSize' }, description: '#Customizer_Df_Compass_Name_Tooltip' }
		);

		const panel = $.GetContextPanel();
		getDFHudHighlights().yaw = (state) => panel.enabled && this.isHighlighted(state);
	}

	applyConfig() {
		this.setStripHeight(this.compassTickSize);
		this.tickContainer.style.height = '100%';
		this.tickContainer.style.verticalAlign = 'top';

		// half ticks hang from the top of the strip, or stand on its bottom
		for (const tick of this.ticks) tick.style.verticalAlign = this.compassTicksBottom ? 'bottom' : 'top';
	}

	onUpdate() {
		const state = this.getFrameState();
		if (!state.valid) return;

		this.updateView(state);

		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const color = this.isHighlighted(state) ? this.compassHlColor : this.compassColor;

		for (const [i, tick] of this.ticks.entries()) {
			const tickAngle = this.NaNCheck(MomMath.wrapToHalfPi(viewAngle + i * 0.25 * Math.PI), 0);
			const tickPx = this.NaNCheck(this.mapToScreen(tickAngle), 0);
			tick.style.position = `${tickPx}px 0px 0px`;
			tick.style.backgroundColor = color;
		}
	}

	/** Whether the velocity is on a 45 degree line */
	isHighlighted(state: DefragAPI.HUDFrameState): boolean {
		return Math.abs(MomMath.remapAngle(8 * state.velAngle) * 0.125) < 0.01 && state.speed >= this.compassMinSpeed;
	}
}
