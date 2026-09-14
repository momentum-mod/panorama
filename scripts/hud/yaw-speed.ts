import { PanelHandler } from 'util/module-helpers';
import { HideHud } from 'common/state';
import { registerHUDCustomizerComponent, CustomizerPropertyType, getTextShadowFast } from 'common/hud-customizer';

const HIDE_DELAY = 1.5;
const HIDDEN_CLASS = 'yawspeed--hidden';

@PanelHandler()
class YawSpeedHandler {
	readonly cp = $.GetContextPanel<MomHudYawSpeed>();

	private hideScheduleId: number | null = null;
	private isCustomizerOpen = false;

	constructor() {
		this.cp.hiddenHUDBits = HideHud.TABMENU;
		const initialYawSpeed = GameInterfaceAPI.GetSettingFloat('cl_yawspeed');
		this.cp.SetDialogVariable('yawspeed', Math.round(initialYawSpeed).toString());

		registerHUDCustomizerComponent(this.cp, {
			name: $.Localize('#Customizer_YawSpeed_Name'),
			resizeX: true,
			resizeY: false,
			canDisable: true,
			dynamicStyles: {
				fontStyling: {
					name: $.Localize('#Customizer_FontStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
				},
				font: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.yawspeed__label',
					styleProperty: 'fontFamily',
					valueFn: (value) => `"${value}"`
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.yawspeed__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.yawspeed__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) =>
						(panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9))
				}
			}
		});

		$.RegisterConVarChangeListener('cl_yawspeed', () => this.onYawSpeedChanged());

		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => {
			this.isCustomizerOpen = true;
			this.cp.RemoveClass(HIDDEN_CLASS);
		});

		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => {
			this.isCustomizerOpen = false;
			this.hide();
		});

		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
			this.hide();
		});
	}

	onYawSpeedChanged() {
		try {
			const currentYawSpeed = GameInterfaceAPI.GetSettingFloat('cl_yawspeed');
			this.cp.SetDialogVariable('yawspeed', Math.round(currentYawSpeed).toString());
			if (this.hideScheduleId !== null) {
				$.CancelScheduled(this.hideScheduleId);
				this.hideScheduleId = null;
			}
			this.cp.RemoveClass(HIDDEN_CLASS);
			this.hideScheduleId = $.Schedule(HIDE_DELAY, () => {
				this.hideScheduleId = null;
				this.hide();
			});
		} catch {}
	}

	private hide() {
		if (this.hideScheduleId !== null) {
			$.CancelScheduled(this.hideScheduleId);
			this.hideScheduleId = null;
		}

		if (this.isCustomizerOpen && this.cp?.enabled) return;

		this.cp.AddClass(HIDDEN_CLASS);
	}
}
