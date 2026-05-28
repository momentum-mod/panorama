import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { rgbaStringToTuple } from 'util/colors';

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
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Sticky_Charge_Name'),
			resizeX: true,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.SJ),
			unhandledEvents: {
				event: 'OnChargeUpdate',
				callbackFn: (enabled, speed, percentage) => this.onChargeUpdate(enabled, speed, percentage)
			},
			dynamicStyles: {
				chargeMeterUnits: {
					name: $.Localize('#Customizer_Sticky_Charge_ChargeMeterUnits'),
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'None', value: StickyChargeUnit.NONE.toString() },
						{ label: 'Units', value: StickyChargeUnit.UPS.toString() },
						{ label: 'Percentage', value: StickyChargeUnit.PERCENT.toString() }
					],
					children: [
						{
							styleID: 'fontStyling',
							showWhen: [StickyChargeUnit.UPS.toString(), StickyChargeUnit.PERCENT.toString()]
						}
					],
					callbackFunc: (_, value) => (this.stickyChargeUnit = +value),
					onChanged: () => this.onChargeUpdate(this.isEnabled, 900, 0)
				},
				borderStyles: {
					name: $.Localize('#Customizer_Sticky_Charge_BorderStyles'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'borderWidth' }, { styleID: 'borderColor' }, { styleID: 'borderRadius' }]
				},
				borderWidth: {
					name: $.Localize('#Customizer_BorderWidth'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.stickycharge__meter',
					styleProperty: 'borderWidth',
					valueFn: (value) => `${value}px`
				},
				borderColor: {
					name: $.Localize('#Customizer_BorderColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.stickycharge__meter',
					styleProperty: 'borderColor'
				},
				borderRadius: {
					name: $.Localize('#Customizer_BorderRadius'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'backgroundRadius' }, { styleID: 'fillRadius' }]
				},
				backgroundRadius: {
					name: $.Localize('#Customizer_Background'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.stickycharge__meter',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				fillRadius: {
					name: $.Localize('#Customizer_Fill'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.ProgressBarLeft',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				fontStyling: {
					name: $.Localize('#Customizer_FontStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
				},
				font: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.stickycharge__label',
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.stickycharge__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.stickycharge__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						const alpha = (rgbaStringToTuple(value as rgbaColor)[3] / 255) * 0.9;
						panel.style.textShadow = `rgba(0, 0, 0, ${alpha}) 0px 1px 2px 2.5`;
					}
				},
				colors: {
					name: $.Localize('#Customizer_Colors'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'backgroundGradient' },
						{ styleID: 'fillGradient' },
						{ styleID: 'disabledGradient' }
					]
				},
				backgroundGradient: {
					name: $.Localize('#Customizer_Background'),
					type: CustomizerPropertyType.GRADIENT_PICKER,
					targetPanel: '#StickyChargeMeter_Right',
					callbackFunc: (_, value) =>
						(this.backgroundColor =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color),
					onChanged: () => this.onChargeUpdate(this.isEnabled, 900, 0)
				},
				fillGradient: {
					name: $.Localize('#Customizer_Fill'),
					type: CustomizerPropertyType.GRADIENT_PICKER,
					targetPanel: '#StickyChargeMeter_Left',
					styleProperty: 'backgroundColor',
					valueFn: (value) => {
						return `gradient(linear, 0% 0%, 100% 0%, from (${value[0]}), to(${value[1]}))` as color;
					}
				},
				disabledGradient: {
					name: $.Localize('#Customizer_Disabled'),
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => (this.disabledGradient = value),
					onChanged: () => this.onChargeUpdate(this.isEnabled, 900, 0)
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
