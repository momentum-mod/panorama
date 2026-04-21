import { PanelHandler } from 'util/module-helpers';
import { registerHUDCustomizerComponent, CustomizerPropertyType } from 'common/hud-customizer';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { splitRgbFromAlpha } from 'util/colors';

const Config = {
	countDown: false,
	unfill: false,
	isLabelEnabled: false,
	font: {
		family: 'Roboto',
		size: 20,
		color: 'rgba(255, 255, 255, 1)'
	},
	border: {
		width: 0,
		color: 'rgba(0, 0, 0, 1)',
		backgroundRadius: 11,
		fillRadius: 11
	},
	color: {
		background: 'gradient(linear, 0% 0%, 100% 0%, from (rgba(35, 50, 57, 1)), to(rgba(35, 50, 57, 1)))',
		fill: 'gradient(linear, 0% 0%, 100% 0%, from (rgba(24, 150, 211, 1)), to(rgba(113, 240, 255, 1)))'
	}
};

@PanelHandler()
class ConcEntitiesHandler {
	cp = $.GetContextPanel<MomHudConcEntities>();
	container = $('#ConcEntPanelsContainer');

	constructor() {
		$.RegisterEventHandler('OnConcEntityPanelThink', this.container, () => this.onEntPanelThink());

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			moveX: false,
			moveY: false,
			gamemode: Gamemode.CONC,
			dynamicStyles: {
				countDown: {
					name: 'Count Down',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						Config.countDown = value;
					}
				},
				unfill: {
					name: 'Unfill',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						Config.unfill = value;
					}
				},
				showLabel: {
					name: 'Show Label',
					type: CustomizerPropertyType.CHECKBOX,
					children: { styleID: 'fontStyling', showWhen: true },
					callbackFunc: (_, value) => {
						Config.isLabelEnabled = value;
					}
				},
				fontStyling: {
					name: 'Font Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => {
						Config.font.family = value;
					}
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.font.size = value;
					}
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.font.color = value;
					}
				},
				borderStyling: {
					name: 'Border Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'borderWidth' }, { styleID: 'borderColor' }, { styleID: 'borderRadius' }]
				},
				borderWidth: {
					name: 'Border Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.border.width = value;
					}
				},
				borderColor: {
					name: 'Border Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.border.color = value;
					}
				},
				borderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'backgroundRadius' }, { styleID: 'fillRadius' }]
				},
				backgroundRadius: {
					name: 'Background',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.border.backgroundRadius = value;
					},
					settingProps: { min: 0, max: 11 }
				},
				fillRadius: {
					name: 'Fill',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.border.fillRadius = value;
					},
					settingProps: { min: 0, max: 11 }
				},
				colors: {
					name: 'Colors',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'backgroundGradient' }, { styleID: 'fillGradient' }]
				},
				backgroundGradient: {
					name: 'Background',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						Config.color.background =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color;
					}
				},
				fillGradient: {
					name: 'Fill',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						Config.color.fill =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color;
					}
				}
			}
		});
	}

	onEntPanelThink() {
		this.container
			.Children()
			.filter((entpanel): entpanel is MomConcEntityPanel => entpanel.HasClass('conc-ent'))
			.forEach((entpanel) => {
				const meterEnabled = this.cp.concEntPanelProgressBarEnabled;
				const meter = entpanel.FindChildTraverse<ProgressBar>('ConcTimeMeter');
				const meterBackground = meter.GetLastChild();
				const meterFill = meter.GetFirstChild();

				meter.visible = meterEnabled;

				if (meterEnabled) {
					meter.style.backgroundColor = Config.color.background as color;
					meter.style.border = `${Config.border.width}px solid ${Config.border.color}`;
					meter.style.borderRadius = `${Config.border.backgroundRadius}px`;

					meterBackground.style.backgroundColor = Config.color.background as color;

					meterFill.style.backgroundColor = Config.color.fill as color;
					meterFill.style.borderRadius = `${Config.border.fillRadius}px`;

					meter.value = Config.unfill ? entpanel.concPrimedPercent : 1 - entpanel.concPrimedPercent;
				}

				const label = entpanel.FindChildTraverse<Label>('ConcTimeLabel');
				label.visible = Config.isLabelEnabled;
				if (Config.isLabelEnabled) {
					label.style.fontFamily = Config.font.family;
					label.style.fontSize = `${Config.font.size}px`;
					label.style.color = Config.font.color;
					label.style.textShadow = this.getAdjustedTextShadow(Config.font.color as rgbaColor);

					label.text = Config.countDown
						? `${entpanel.concPrimedTime.toFixed(2)}s`
						: `${(GameInterfaceAPI.GetSettingFloat('mom_conc_thrown_fuse') - entpanel.concPrimedTime).toFixed(2)}s`;
				}
				entpanel.style.opacity = entpanel.concDistanceFadeAlpha;
			});
	}

	getAdjustedTextShadow(color: rgbaColor) {
		const splitRGBA = splitRgbFromAlpha(color);
		return `rgba(0, 0, 0, ${splitRGBA.alpha * 0.5}) 0px 1px 2px 2.5`;
	}
}
