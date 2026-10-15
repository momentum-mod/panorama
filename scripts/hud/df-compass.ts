import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import * as MomMath from 'util/math';
import { rgbaStringToRgb } from 'util/colors';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { DFHudComponent } from 'common/df-hud';

@PanelHandler()
class DFCompassHandler extends DFHudComponent {
	compassArrow = $('#CompassArrow');
	compassArrowIcon = $<Image>('#CompassArrowIcon');
	tickContainer = $('#CompassTicks');
	pitchStat = $<Label>('#PitchStat');
	yawStat = $<Label>('#YawStat');

	compassMode: int32;
	compassArrowSize: float;
	compassTickSize: float;
	compassOffset: float;
	compassPitchTarget: number[];
	compassStatMode: int32;
	compassColor: rgbaColor;
	compassHlColor: rgbaColor;

	/** The arrow and highlights only apply above the cgaz minimum speed */
	cgazMinSpeed: float;

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

		$.RegisterForUnhandledEvent('OnDefragHUDCompassChange', () => this.onCompassConfigChange());
		$.RegisterForUnhandledEvent('OnDefragHUDCgazChange', () => this.onCgazConfigChange());
	}

	onLoad() {
		this.projection = DefragAPI.GetHUDProjection();
		this.onCgazConfigChange();
		this.onCompassConfigChange();
	}

	onCgazConfigChange() {
		this.cgazMinSpeed = GameInterfaceAPI.GetSettingFloat('mom_hud_df_cgaz_min_speed');
	}

	onCompassConfigChange() {
		const compassConfig = $.GetContextPanel<MomHudDFCompass>().GetCompassCFG();
		this.compassMode = compassConfig.compassMode;
		this.compassArrowSize = compassConfig.compassArrowSize;
		this.compassTickSize = compassConfig.compassTickSize;
		this.compassOffset = compassConfig.compassOffset;
		this.compassPitchTarget = String(compassConfig.pitchTarget).split(' ').map(Number);
		this.compassStatMode = compassConfig.statMode;
		this.compassColor = compassConfig.color;
		this.compassHlColor = compassConfig.highlightColor;

		this.tickContainer.style.height = this.compassTickSize + 'px';
		this.tickContainer.style.transform = `translatey( ${this.compassOffset - 0.5 * this.compassTickSize}px )`;

		const compassTicks = this.tickContainer?.Children();
		if (compassTicks?.length < 4) {
			// only up to 180 degrees are ever shown, so only 4 ticks are
			// needed to represent all potentially visible 45-degree marks
			for (let i = compassTicks?.length; i < 4; ++i) {
				const newTick = $.CreatePanel('Panel', this.tickContainer, `CompassTick${i}`, {
					class: 'dfcompass__tick'
				});
				newTick.AddClass(i % 2 ? 'dfcompass__tick--half' : 'dfcompass__tick--full');
			}
		}

		const width = 2 * this.compassArrowSize;
		const height = 2 * width;
		this.setupArrow(
			this.compassArrow,
			this.compassArrowIcon,
			height,
			width,
			this.compassOffset,
			'bottom',
			this.compassColor
		);
	}

	onUpdate() {
		const state = DefragAPI.GetHUDFrameState();
		if (!state.valid) return;

		this.updateView(state);

		const speed = state.speed;
		const velAngle = state.velAngle;
		const viewAngle = MomMath.deg2rad(state.viewYaw);

		let velocityAngle = MomMath.remapAngle(viewAngle - velAngle);
		if (this.compassMode) {
			const ticks = this.tickContainer.Children();

			const bShouldHighlight =
				Math.abs(MomMath.remapAngle(8 * velAngle) * 0.125) < 0.01 && speed >= this.cgazMinSpeed;
			const color = bShouldHighlight ? this.compassHlColor : this.compassColor;

			for (const [i, tick] of ticks.entries()) {
				const tickAngle = this.NaNCheck(MomMath.wrapToHalfPi(viewAngle + i * 0.25 * Math.PI), 0);
				const tickPx = this.NaNCheck(this.mapToScreen(tickAngle), 0);
				tick.style.position = `${tickPx}px 0px 0px`;
				tick.style.backgroundColor = color;
			}

			if (Math.abs(velocityAngle) < this.halfHFov) {
				this.compassArrowIcon.RemoveClass('dfhud__arrow--down');
				this.compassArrowIcon.AddClass('dfhud__arrow--up');
			} else {
				this.compassArrowIcon.RemoveClass('dfhud__arrow--up');
				this.compassArrowIcon.AddClass('dfhud__arrow--down');
				velocityAngle = MomMath.remapAngle(velocityAngle - Math.PI);
			}
			const leftEdge = this.mapToScreen(velocityAngle) - this.compassArrowSize;
			this.compassArrow.style.position = `${this.NaNCheck(leftEdge, 0)}px 0px 0px`;
			this.compassArrowIcon.style.washColor = rgbaStringToRgb(color);
		}
		this.compassArrow.visible = this.compassMode % 2 && speed >= this.cgazMinSpeed;
		this.tickContainer.visible = this.compassMode > 1;

		// compass stats
		if (this.compassStatMode) {
			this.yawStat.text = state.viewYaw.toFixed(0);
			this.yawStat.style.color =
				Math.abs(MomMath.remapAngle(8 * velAngle) * 0.125) < 0.01 && speed >= this.cgazMinSpeed
					? this.compassHlColor
					: this.compassColor;

			const viewPitch = state.viewPitch;
			this.pitchStat.text = viewPitch.toFixed(1);
			let bShouldHighlight = false;
			for (const target of this.compassPitchTarget) {
				if (Math.abs(viewPitch - target) <= 0.15) bShouldHighlight = true;
			}
			this.pitchStat.style.color = bShouldHighlight ? this.compassHlColor : this.compassColor;
		}
		this.pitchStat.visible = this.compassStatMode % 2 !== 0;
		this.yawStat.visible = this.compassStatMode > 1;
	}
}
