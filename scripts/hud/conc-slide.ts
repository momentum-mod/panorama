import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import { CustomizerPropertyType, getTextShadowFast, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { RgbaTuple, rgbaStringToTuple, rgbaTupleLerp } from 'util/colors';

/** Matches ConcSlideFlags_t in mom_shareddefs.h */
enum ConcSlideFlags {
	NONE = 0,
	ACTIVE = 1 << 0,
	STANDING = 1 << 1,
	ON_GROUND = 1 << 2
}

enum MeterShape {
	CIRCLE = 'circle',
	BAR = 'bar'
}

/** Opacity multiplier for the greyed out meter while standing mid-slide */
const STANDING_OPACITY = 0.4;

/** Length of one fake slide in the customizer preview, in seconds */
const PREVIEW_CYCLE = 1.6;

type SlideState = {
	timeLeft: number;
	duration: number;
	zeroTime: number;
	flags: number;
};

@PanelHandler()
class ConcSlideHandler {
	readonly panels = {
		container: $<Panel>('#ConcSlideContainer'),
		circle: $<Panel>('#ConcSlideCircle'),
		circleBackground: $<Image>('#ConcSlideCircleBackground'),
		circleFill: $<Image>('#ConcSlideCircleFill'),
		circleMarker: $<Panel>('#ConcSlideCircleMarker'),
		circleLabel: $<Label>('#ConcSlideCircleLabel'),
		bar: $<Panel>('#ConcSlideBar'),
		barBackground: $<Panel>('#ConcSlideBarBackground'),
		barFill: $<Panel>('#ConcSlideBarFill'),
		barMarker: $<Panel>('#ConcSlideBarMarker'),
		barLabel: $<Label>('#ConcSlideBarLabel')
	};

	// Defaults are set in hud_default.kv3
	shape: MeterShape;
	size: number;
	barWidth: number;
	barHeight: number;
	showLabel: boolean;
	showMarker: boolean;
	fadeDelay: number;
	fadeTime: number;
	backgroundColor: RgbaTuple;
	slideColor: RgbaTuple;
	neutralColor: RgbaTuple;
	frictionColor: RgbaTuple;

	/** Read from the slide cvars once per map on LevelInitPostEntity, in seconds */
	duration = 0;
	zeroTime = 0;

	visible = false;
	preview = false;
	lastMarkerFraction = -1;

	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Conc_Slide_Name'),
			resizeX: false,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.CONC),
			unhandledEvents: [
				{
					event: 'LevelInitPostEntity',
					callbackFn: () => {
						this.duration = GameInterfaceAPI.GetSettingFloat('mom_conc_slide_duration');
						this.zeroTime =
							this.duration * GameInterfaceAPI.GetSettingFloat('mom_conc_slide_zero_fraction');
					}
				},
				{
					event: 'OnConcSlideUpdate',
					callbackFn: (timeLeft, flags) =>
						this.onSlideUpdate({ timeLeft, duration: this.duration, zeroTime: this.zeroTime, flags })
				},
				{
					event: 'HudCustomizer_Opened',
					callbackFn: () => {
						this.preview = true;
						this.onSlideUpdate(this.getPreviewState());
					}
				},
				{
					event: 'HudCustomizer_Closed',
					callbackFn: () => {
						this.preview = false;
						this.hide(true);
					}
				}
			],
			dynamicStyles: {
				shape: {
					name: $.Localize('#Customizer_Conc_Slide_Shape'),
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: $.Localize('#Customizer_Conc_Slide_Shape_Circle'), value: MeterShape.CIRCLE },
						{ label: $.Localize('#Customizer_Conc_Slide_Shape_Bar'), value: MeterShape.BAR }
					],
					children: [
						{ styleID: 'size', showWhen: MeterShape.CIRCLE },
						{ styleID: 'barWidth', showWhen: MeterShape.BAR },
						{ styleID: 'barHeight', showWhen: MeterShape.BAR },
						{ styleID: 'barRadius', showWhen: MeterShape.BAR }
					],
					callbackFunc: (_, value) =>
						(this.shape = value === MeterShape.BAR ? MeterShape.BAR : MeterShape.CIRCLE),
					onChanged: () => this.applyLayout()
				},
				size: {
					name: $.Localize('#Customizer_Size'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					settingProps: { min: 10, max: 1000 },
					callbackFunc: (_, value) => (this.size = value),
					onChanged: () => this.applyLayout()
				},
				barWidth: {
					name: $.Localize('#Customizer_Width'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					settingProps: { min: 10, max: 1920 },
					callbackFunc: (_, value) => (this.barWidth = value),
					onChanged: () => this.applyLayout()
				},
				barHeight: {
					name: $.Localize('#Customizer_Height'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					settingProps: { min: 1, max: 200 },
					callbackFunc: (_, value) => (this.barHeight = value),
					onChanged: () => this.applyLayout()
				},
				barRadius: {
					name: $.Localize('#Customizer_BorderRadius'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['#ConcSlideBarBackground', '#ConcSlideBarFill'],
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 100 }
				},
				showLabel: {
					name: $.Localize('#Customizer_Conc_Slide_ShowTimeLeft'),
					type: CustomizerPropertyType.CHECKBOX,
					children: { styleID: 'fontStyling', showWhen: true },
					callbackFunc: (_, value) => (this.showLabel = value),
					onChanged: () => this.applyLayout()
				},
				showMarker: {
					name: $.Localize('#Customizer_Conc_Slide_ShowMarker'),
					type: CustomizerPropertyType.CHECKBOX,
					children: { styleID: 'markerColor', showWhen: true },
					callbackFunc: (_, value) => (this.showMarker = value),
					onChanged: () => this.applyLayout()
				},
				fadeDelay: {
					name: $.Localize('#Customizer_Conc_Slide_FadeDelay'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					settingProps: { min: 0, max: 5000 },
					callbackFunc: (_, value) => (this.fadeDelay = value)
				},
				fadeTime: {
					name: $.Localize('#Customizer_Conc_Slide_FadeTime'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					settingProps: { min: 0, max: 5000 },
					callbackFunc: (_, value) => (this.fadeTime = value)
				},
				fontStyling: {
					name: $.Localize('#Customizer_FontStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }]
				},
				font: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.concslide__label',
					styleProperty: 'fontFamily',
					valueFn: (value) => `"${value}"`
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.concslide__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				colors: {
					name: $.Localize('#Customizer_Colors'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'backgroundColor' },
						{ styleID: 'slideColor' },
						{ styleID: 'neutralColor' },
						{ styleID: 'frictionColor' }
					]
				},
				backgroundColor: {
					name: $.Localize('#Customizer_Background'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						this.backgroundColor = rgbaStringToTuple(value);
						this.applyBackgroundColor();
					}
				},
				slideColor: {
					name: $.Localize('#Customizer_Conc_Slide_SlideColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (this.slideColor = rgbaStringToTuple(value))
				},
				neutralColor: {
					name: $.Localize('#Customizer_Conc_Slide_NeutralColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (this.neutralColor = rgbaStringToTuple(value))
				},
				frictionColor: {
					name: $.Localize('#Customizer_Conc_Slide_FrictionColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (this.frictionColor = rgbaStringToTuple(value))
				},
				markerColor: {
					name: $.Localize('#Customizer_Conc_Slide_MarkerColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.concslide__marker',
					styleProperty: 'backgroundColor'
				}
			},
			postInit: () => this.applyLayout()
		});
	}

	onSlideUpdate(state: SlideState) {
		if (this.preview) state = this.getPreviewState();

		const active = (state.flags & ConcSlideFlags.ACTIVE) !== 0 && state.duration > 0;
		const onGround = (state.flags & ConcSlideFlags.ON_GROUND) !== 0;

		// Only shown on the ground. In the air the timer still runs, so the fill is correct again on landing.
		if (!active || !onGround) {
			this.hide(false);
			return;
		}

		this.show();
		this.updateMeter(state);
	}

	updateMeter({ timeLeft, duration, zeroTime, flags }: SlideState) {
		const remaining = Math.min(Math.max(timeLeft / duration, 0), 1);
		const elapsed = duration - timeLeft;

		// Zero friction part fades slide -> neutral, rising friction part fades neutral -> friction
		let color: RgbaTuple;
		if (elapsed <= zeroTime && zeroTime > 0) {
			color = rgbaTupleLerp(this.slideColor, this.neutralColor, elapsed / zeroTime);
		} else {
			const rampTime = duration - zeroTime;
			color = rgbaTupleLerp(
				this.neutralColor,
				this.frictionColor,
				rampTime > 0 ? (elapsed - zeroTime) / rampTime : 1
			);
		}

		// Standing mid-slide: friction is back to normal but the timer runs on, so grey it out
		if (flags & ConcSlideFlags.STANDING) {
			const [r, g, b, a] = color;
			const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
			color = [grey, grey, grey, Math.round(a * STANDING_OPACITY)];
		}

		const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})` as rgbColor;
		const rgba = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})` as rgbaColor;

		const markerFraction = duration > 0 ? 1 - zeroTime / duration : 0;

		if (this.shape === MeterShape.CIRCLE) {
			const fill = +(remaining * 360).toFixed(2) - 360;
			this.panels.circleFill.style.clip = `radial(50% 50%, 0deg, ${fill}deg)`;
			this.panels.circleFill.style.washColor = rgb;
			this.panels.circleFill.style.opacity = color[3] / 255;

			if (this.showMarker && markerFraction !== this.lastMarkerFraction) {
				this.panels.circleMarker.style.transform = `rotateZ(${(markerFraction * 360).toFixed(2)}deg)`;
				this.lastMarkerFraction = markerFraction;
			}
		} else {
			this.panels.barFill.style.width = `${(remaining * 100).toFixed(2)}%`;
			this.panels.barFill.style.backgroundColor = rgba;

			if (this.showMarker && markerFraction !== this.lastMarkerFraction) {
				this.panels.barMarker.style.marginLeft = `${(markerFraction * this.barWidth - 1).toFixed(1)}px`;
				this.lastMarkerFraction = markerFraction;
			}
		}

		if (this.showLabel) {
			const label = this.shape === MeterShape.CIRCLE ? this.panels.circleLabel : this.panels.barLabel;
			label.text = Math.max(timeLeft, 0).toFixed(2);
			label.style.color = rgba;
			label.style.textShadowFast = getTextShadowFast(rgba, 0.9);
		}
	}

	show() {
		if (this.visible) return;
		this.visible = true;

		const container = this.panels.container;
		container.style.transitionDelay = '0s';
		container.style.transitionDuration = '0s';
		container.RemoveClass('concslide--hide');
	}

	hide(instant: boolean) {
		if (!this.visible && !instant) return;
		this.visible = false;

		const container = this.panels.container;
		container.style.transitionDelay = instant ? '0s' : `${this.fadeDelay / 1000}s`;
		container.style.transitionDuration = instant ? '0s' : `${this.fadeTime / 1000}s`;
		container.AddClass('concslide--hide');
	}

	applyLayout() {
		const circle = this.shape === MeterShape.CIRCLE;
		const {
			container,
			circle: circlePanel,
			circleBackground,
			circleFill,
			circleMarker,
			circleLabel,
			bar,
			barBackground,
			barMarker,
			barLabel
		} = this.panels;

		circlePanel.SetHasClass('hide', !circle);
		bar.SetHasClass('hide', circle);

		if (circle) {
			circleBackground.SetSvgTextureSize(this.size, this.size);
			circleFill.SetSvgTextureSize(this.size, this.size);
			container.style.width = `${this.size}px`;
			container.style.height = `${this.size}px`;
		} else {
			barBackground.style.width = `${this.barWidth}px`;
			barBackground.style.height = `${this.barHeight}px`;
			container.style.width = `${this.barWidth}px`;
			container.style.height = 'fit-children';
		}

		circleMarker.SetHasClass('hide', !this.showMarker);
		barMarker.SetHasClass('hide', !this.showMarker);
		circleLabel.SetHasClass('hide', !this.showLabel);
		barLabel.SetHasClass('hide', !this.showLabel);
		this.lastMarkerFraction = -1;

		if (this.preview) this.onSlideUpdate(this.getPreviewState());
	}

	applyBackgroundColor() {
		const [r, g, b, a] = this.backgroundColor;
		this.panels.circleBackground.style.washColor = `rgb(${r}, ${g}, ${b})`;
		this.panels.circleBackground.style.opacity = a / 255;
		this.panels.barBackground.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
	}

	/** Loops a 1 s slide with a 0.5 s zero friction part while the customizer is open */
	getPreviewState(): SlideState {
		const duration = 1;
		const t = (MomentumMovementAPI.GetCurrentTime() % PREVIEW_CYCLE) / PREVIEW_CYCLE;
		return {
			timeLeft: duration * (1 - t),
			duration,
			zeroTime: duration * 0.5,
			flags: ConcSlideFlags.ACTIVE | ConcSlideFlags.ON_GROUND
		};
	}
}
