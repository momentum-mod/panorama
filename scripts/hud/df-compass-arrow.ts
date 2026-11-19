import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import { rgbaStringToRgb } from 'util/colors';
import { DFHudComponent } from 'common/df-hud';

/**
 * Arrow under the velocity direction, pointing down when the velocity is behind the view. Highlighted while the
 * velocity is on a 45 degree yaw line, like the compass ticks.
 */
@PanelHandler()
class DFCompassArrowHandler extends DFHudComponent {
	arrow = $('#CompassArrow');
	arrowIcon = $<Image>('#CompassArrowIcon');

	arrowSize: number;
	arrowColor: rgbaColor;
	arrowHlColor: rgbaColor;

	/** The arrow only shows when moving faster than this */
	arrowMinSpeed: number;

	constructor() {
		super();

		this.registerComponent(
			'#Customizer_Df_CompassArrow_Name',
			GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			{
				minSpeed: this.numberStyle(
					'#Customizer_Df_MinSpeed',
					0,
					10000,
					(value) => (this.arrowMinSpeed = value)
				),
				arrowSize: this.numberStyle('#Customizer_Size', 1, 25, (value) => (this.arrowSize = value)),
				colors: this.groupStyle('#Customizer_Colors', ['color', 'highlightColor']),
				color: this.colorStyle('#Customizer_Color', (value) => (this.arrowColor = value)),
				highlightColor: this.colorStyle('#Customizer_Df_HighlightColor', (value) => (this.arrowHlColor = value))
			},
			// the arrow is as tall as it is wide, so it resizes from the corners and keeps its shape
			{
				resizeY: true,
				resizeCorners: true,
				heightStyle: { styleID: 'arrowSize', scale: 2 },
				description: '#Customizer_Df_CompassArrow_Name_Tooltip'
			}
		);
	}

	applyConfig() {
		const width = 2 * this.arrowSize;
		this.setStripHeight(width);
		this.setupArrow(this.arrow, this.arrowIcon, width, width, 'center', this.arrowColor);
	}

	onUpdate() {
		const state = this.getFrameState();
		if (!state.valid) return;

		const speed = state.speed;
		const bShow = speed >= this.arrowMinSpeed;
		this.arrow.visible = bShow;
		if (!bShow) return;

		this.updateView(state);

		const velAngle = state.velAngle;
		let velocityAngle = MomMath.remapAngle(MomMath.deg2rad(state.viewYaw) - velAngle);
		const bBehind = !(Math.abs(velocityAngle) < this.halfHFov);
		this.arrowIcon.SetHasClass('dfhud__arrow--up', !bBehind);
		this.arrowIcon.SetHasClass('dfhud__arrow--down', bBehind);
		if (bBehind) velocityAngle = MomMath.remapAngle(velocityAngle - Math.PI);

		const bHighlight = Math.abs(MomMath.remapAngle(8 * velAngle) * 0.125) < 0.01;
		const leftEdge = this.mapToScreen(velocityAngle) - this.arrowSize;
		this.arrow.style.position = `${this.NaNCheck(leftEdge, 0)}px 0px 0px`;
		this.arrowIcon.style.washColor = rgbaStringToRgb(bHighlight ? this.arrowHlColor : this.arrowColor);
	}
}
