import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';
import { Gamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

@PanelHandler()
class ConcCookHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudConcCookTime>(),
		cookMeter: $<ProgressBar>('#ConcCookMeter'),
		cookLabel: $<Label>('#ConcCookTime')
	};

	units = $.Localize('#Run_Stat_Unit_Second');
	isLabelEnabled: boolean;

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
			//TODO: Add entpanels
			//TODO: Add box shadow setting
			dynamicStyles: {
				showLabel: {
					name: 'Show Label',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.isLabelEnabled = value;
						this.onCookUpdate(0, 0);
					}
				},
				borderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.cooktime__meter',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				fillRadius: {
					name: 'Fill Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '#ConcCookMeter_Left',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.cooktime__meter',
					callbackFunc: (panel, value) => {
						const progressBarRight = panel.GetLastChild();
						panel.style.backgroundColor = value as color;
						progressBarRight.style.backgroundColor = value as color;
					}
				},
				fillGradient: {
					name: 'Fill Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					targetPanel: '#ConcCookMeter_Left',
					styleProperty: 'backgroundColor',
					valueFn: (value) => {
						return `gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color;
					}
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.cooktime__label',
					styleProperty: 'color'
				}
			}
		});
	}

	onCookUpdate(time: float, percentage: float) {
		this.panels.cookMeter.value = percentage;
		this.panels.cookLabel.text = this.isLabelEnabled ? `${time.toFixed(2)}${this.units}` : '';
	}
}
