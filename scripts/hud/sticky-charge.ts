import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';
import { Gamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

export enum StickyChargeUnit {
	NONE = 0,
	UPS = 1,
	PERCENT = 2
}

@PanelHandler()
class StickyChargeHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudStickyCharge>(),
		container: $<Panel>('#StickyChargeContainer'),
		chargeMeter: $<ProgressBar>('#StickyChargeMeter'),
		chargeSpeed: $<Label>('#StickyChargeSpeed')
	};

	stickyChargeUnit: StickyChargeUnit;
	isEnabled = true;
	disabledGradient = ['rgba(134, 65, 65, 1)', 'rgba(170, 65, 65, 1)'];
	backgroundColor = 'rgba(34.6, 49.9, 57.4, 1)';

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: [Gamemode.SJ],
			events: [
				{
					event: 'OnChargeUpdate',
					callback: (enabled, speed, percentage) => this.onChargeUpdate(enabled, speed, percentage)
				}
			]
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: true,
			resizeY: false,
			gamemode: Gamemode.SJ,
			//TODO: Add generic font settings
			//TODO: Add box shadow customization
			//TODO: Add vertical resizing ( after CustomizerPropertyType.SLIDER is implemented )
			dynamicStyles: {
				chargeMeterUnits: {
					name: 'Charge Meter Units',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.stickyChargeUnit = value;
						this.onChargeUpdate(this.isEnabled, 900, 0);
					}
				},
				borderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.stickycharge__meter',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				fillRadius: {
					name: 'Fill Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '#StickyChargeMeter_Left',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						this.backgroundColor = value;
						this.onChargeUpdate(this.isEnabled, 900, 0);
					}
				},
				fillGradient: {
					name: 'Fill Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					targetPanel: '#StickyChargeMeter_Left',
					styleProperty: 'backgroundColor',
					valueFn: (value) => {
						return `gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color;
					}
				},
				disabledGradient: {
					name: 'Disabled Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						this.disabledGradient = value;
						this.onChargeUpdate(this.isEnabled, 900, 0);
					}
				}
			}
		});
	}

	onChargeUpdate(enabled: boolean, speed: float, percentage: float) {
		this.isEnabled = enabled;
		this.panels.chargeMeter.enabled = this.isEnabled;

		const stickyBarRight = this.panels.chargeMeter.GetLastChild();

		if (!this.panels.chargeMeter.enabled) {
			stickyBarRight.style.backgroundColor =
				`gradient(linear, 0% 0%, 100% 0%, from (${this.disabledGradient[0]}), to(${this.disabledGradient[1]}))` as color;
		} else {
			this.panels.chargeMeter.style.backgroundColor = this.backgroundColor as color;
			stickyBarRight.style.backgroundColor = this.backgroundColor as color;
		}

		let speedText: string;
		switch (this.stickyChargeUnit) {
			case StickyChargeUnit.UPS:
				speedText = `${Math.floor(speed)}u/s`;
				break;
			case StickyChargeUnit.PERCENT:
				speedText = `${Math.floor(percentage * 100)}%`;
				break;
			default:
				speedText = '';
		}

		this.panels.chargeSpeed.text = speedText;
		this.panels.chargeMeter.value = percentage;
	}
}
