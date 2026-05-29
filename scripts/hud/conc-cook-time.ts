import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { getTextShadowFast } from 'common/hud-customizer';

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
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Conc_Cook_Time_Name'),
			resizeX: true,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.CONC),
			unhandledEvents: {
				event: 'OnCookUpdate',
				callbackFn: (time, percentage) => this.onCookUpdate(time, percentage)
			},
			dynamicStyles: {
				countDown: {
					name: $.Localize('#Customizer_Conc_CountDown'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.countDown = value),
					onChanged: () => this.onCookUpdate(0, 0)
				},
				unfill: {
					name: $.Localize('#Customizer_Conc_Unfill'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.unfill = value),
					onChanged: () => this.onCookUpdate(0, 0)
				},
				showLabel: {
					name: $.Localize('#Customizer_ShowLabel'),
					type: CustomizerPropertyType.CHECKBOX,
					children: { styleID: 'fontStyling', showWhen: true },
					callbackFunc: (_, value) => (this.isLabelEnabled = value),
					onChanged: () => this.onCookUpdate(0, 0)
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
					targetPanel: '.cooktime__label',
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.cooktime__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.cooktime__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9);
					}
				},
				borderStyling: {
					name: $.Localize('#Customizer_BorderStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'borderWidth' }, { styleID: 'borderColor' }, { styleID: 'borderRadius' }]
				},
				borderWidth: {
					name: $.Localize('#Customizer_BorderWidth'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.cooktime__meter',
					styleProperty: 'borderWidth',
					valueFn: (value) => `${value}px`
				},
				borderColor: {
					name: $.Localize('#Customizer_BorderColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.cooktime__meter',
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
					targetPanel: '.cooktime__meter',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				fillRadius: {
					name: $.Localize('#Customizer_Fill'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '#ConcCookMeter_Left',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 10 }
				},
				colors: {
					name: $.Localize('#Customizer_Colors'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'backgroundGradient' }, { styleID: 'fillGradient' }]
				},
				backgroundGradient: {
					name: $.Localize('#Customizer_Background'),
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
					name: $.Localize('#Customizer_Fill'),
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
}
