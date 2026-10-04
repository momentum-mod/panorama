import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { HideHud } from 'common/state';
import { registerHUDCustomizerComponent, CustomizerPropertyType, getTextShadowFast } from 'common/hud-customizer';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
const HIDDEN_CLASS = 'yawspeed--hidden';

@PanelHandler()
class YawSpeedHandler implements OnPanelLoad {
	readonly cp = $.GetContextPanel<MomHudYawSpeed>();
	private yawSpeedLabel: Label | null = null;
	private convarListenerId: uuid | null = null;

	private isHideEnabled = false;
	private hideDelay = 2;
	private hideScheduleId: number | null = null;
	private isCustomizerOpen = false;
	private isLabelVisible = true;

	constructor() {
		this.cp.hiddenHUDBits = HideHud.TABMENU;

		registerHUDCustomizerComponent(this.cp, {
			name: $.Localize('#Customizer_YawSpeed_Name'),
			resizeX: true,
			resizeY: false,
			gamemode: [
				...GamemodeCategoryToGamemode.get(GamemodeCategory.SURF),
				...GamemodeCategoryToGamemode.get(GamemodeCategory.BHOP)
			],
			dynamicStyles: {
				hide: {
					name: $.Localize('#Customizer_YawSpeed_Hide'),
					type: CustomizerPropertyType.CHECKBOX,
					children: [{ styleID: 'hideDelay', showWhen: true }],
					callbackFunc: (_, value) => this.setHide(value)
				},
				hideDelay: {
					name: $.Localize('#Customizer_YawSpeed_HideDelay'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					settingProps: { min: 0, max: 60 },
					callbackFunc: (_, value) => (this.hideDelay = value)
				},
				showLabel: {
					name: $.Localize('#Customizer_YawSpeed_ShowLabel'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => this.setShowLabel(value)
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

		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => {
			this.isCustomizerOpen = true;
			this.show();
		});

		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => {
			this.isCustomizerOpen = false;
			if (this.isHideEnabled) {
				this.hide();
			}
		});

		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
			if (this.isHideEnabled) {
				this.hide();
			}
		});
	}

	onPanelLoad() {
		this.yawSpeedLabel = $<Label>('#YawSpeedLabel');
		if (this.convarListenerId !== null) {
			$.UnregisterConVarChangeListener(this.convarListenerId);
		}
		this.convarListenerId = $.RegisterConVarChangeListener('cl_yawspeed', () => this.onYawSpeedChanged());
		this.onYawSpeedChanged();
	}

	onYawSpeedChanged() {
		if (!this.yawSpeedLabel || !this.yawSpeedLabel.IsValid()) return;
		const currentYawSpeed = GameInterfaceAPI.GetSettingFloat('cl_yawspeed');
		if (this.isLabelVisible) {
			this.yawSpeedLabel.text = $.Localize('#Yaw_Label') + currentYawSpeed.toString();
		} else {
			this.yawSpeedLabel.text = currentYawSpeed.toString();
		}
		if (!this.isHideEnabled) {
			return;
		}
		this.show();
		this.hideScheduleId = $.Schedule(this.hideDelay, () => {
			this.hideScheduleId = null;
			this.hide();
		});
	}

	private setHide(enabled: boolean) {
		this.isHideEnabled = enabled;
		if (this.isHideEnabled) {
			if (!this.isCustomizerOpen) {
				this.hide();
			}
		} else {
			this.show();
		}
	}
	private setShowLabel(enabled: boolean) {
		this.isLabelVisible = enabled;
		this.onYawSpeedChanged();
	}

	private show() {
		if (this.hideScheduleId !== null) {
			$.CancelScheduled(this.hideScheduleId);
			this.hideScheduleId = null;
		}
		this.cp.RemoveClass(HIDDEN_CLASS);
	}

	private hide() {
		if (this.hideScheduleId !== null) {
			$.CancelScheduled(this.hideScheduleId);
			this.hideScheduleId = null;
		}
		if (!this.isCustomizerOpen && this.isHideEnabled) {
			this.cp.AddClass(HIDDEN_CLASS);
		}
	}
}
