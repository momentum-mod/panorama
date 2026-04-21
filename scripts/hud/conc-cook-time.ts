import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';
import { Gamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { splitRgbFromAlpha } from 'util/colors';

@PanelHandler()
class ConcCookHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudConcCookTime>(),
		cookMeter: $<ProgressBar>('#ConcCookMeter'),
		cookLabel: $<Label>('#ConcCookTime')
	};

	units = $.Localize('#Run_Stat_Unit_Second');
	isLabelEnabled: boolean;
	countDown = false;
	unfill = true;

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: [Gamemode.CONC],
			events: [
				{
					event: 'OnCookUpdate',
					callback: (time, percentage) => this.onCookUpdate(time, percentage)
				}
			]
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: true,
			resizeY: false,
			gamemode: Gamemode.CONC,
			dynamicStyles: {
				countDown: {
					name: 'Count Down',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.countDown = value;
						this.onCookUpdate(0, 0);
					}
				},
				unfill: {
					name: 'Unfill',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.unfill = value;
						this.onCookUpdate(0, 0);
					}
				},
				showLabel: {
					name: 'Show Label',
					type: CustomizerPropertyType.CHECKBOX,
					children: { styleID: 'fontStyling', showWhen: true },
					callbackFunc: (_, value) => {
						this.isLabelEnabled = value;
						this.onCookUpdate(0, 0);
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
					targetPanel: '.cooktime__label',
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.cooktime__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.cooktime__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						panel.style.textShadowFast = this.getAdjustedTextShadow(value as rgbaColor);
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
					targetPanel: '.cooktime__meter',
					styleProperty: 'borderWidth',
					valueFn: (value) => `${value}px`
				},
				borderColor: {
					name: 'Border Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.cooktime__meter',
					styleProperty: 'borderColor'
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
					targetPanel: '.cooktime__meter',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				fillRadius: {
					name: 'Fill',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '#ConcCookMeter_Left',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
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
					targetPanel: '.cooktime__meter',
					callbackFunc: (panel, value) => {
						const progressBarRight = panel.GetLastChild();
						panel.style.backgroundColor =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color;
						progressBarRight.style.backgroundColor =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color;
					}
				},
				fillGradient: {
					name: 'Fill',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					targetPanel: '#ConcCookMeter_Left',
					styleProperty: 'backgroundColor',
					valueFn: (value) => {
						return `gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color;
					}
				}
			}
		});
	}

	onCookUpdate(time: float, percentage: float) {
		const direction = this.unfill ? 1 - percentage : percentage;

		this.panels.cookMeter.value = direction;

		if (!this.isLabelEnabled) {
			this.panels.cookLabel.text = '';
			return;
		}

		const displayTime = this.countDown ? GameInterfaceAPI.GetSettingFloat('mom_conc_handheld_fuse') - time : time;
		this.panels.cookLabel.text = `${displayTime.toFixed(2)}${this.units}`;
	}

	getAdjustedTextShadow(color: rgbaColor) {
		const splitRGBA = splitRgbFromAlpha(color);
		return `0px 1px rgba(0, 0, 0, ${splitRGBA.alpha * 0.9})`;
	}
}
