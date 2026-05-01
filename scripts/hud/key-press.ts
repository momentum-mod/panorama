import { PanelHandler } from 'util/module-helpers';
import { Button } from 'common/buttons';
import { registerHUDCustomizerComponent, CustomizerPropertyType } from 'common/hud-customizer';
import { splitRgbFromAlpha } from 'util/colors';
import { Gamemode } from 'common/web/enums/gamemode.enum';

enum KeySettingsType {
	TEXT_DIR_PANEL,
	TEXT_DIR_ICON,
	TEXT_LABEL,
	TEXT_TURNBIND,
	ICONS_DIR,
	ICONS_JUMP_DUCK,
	ICONS_MODIFIER
}

type KeySettings = {
	input: Button;
	position: { x: number; y: number };
	type?: KeySettingsType;
	icon?: string;
	size?: number;
	rotate?: 0 | 90 | -90 | 180;
};

type ButtonState = 'default' | 'pressed' | 'disabled' | 'toggled' | 'forced';

type PanelInfoType = {
	panel: Panel | Image | Label;
	type: KeySettingsType;
	state: ButtonState;
};

// Properties prepended with _ are not editable through customizer, everything else gets overwritten on map load.
// Set defaults in /cfg/hud_default.kv3
const Config = {
	type: 'text',
	text: {
		_size: 25,
		_key_margin: 3,
		scale_factor: 1,

		dir: {
			borderWidth: 0,
			borderColor: 'rgba(0, 0, 0, 0)',
			borderRadius: 4,
			states: {
				default: { bg: 'rgba(0, 0, 0, 0)', iconColor: 'rgba(0, 0, 0, 1)', iconOpacity: 0.45 },
				pressed: { bg: 'rgba(0, 0, 0, 0)', iconColor: 'rgba(0, 0, 0, 1)', iconOpacity: 1 },
				disabled: { bg: 'rgba(0, 0, 0, 0)', iconColor: 'rgba(0, 0, 0, 1)', iconOpacity: 0.45 },
				toggled: { bg: 'rgba(0, 0, 0, 0)', iconColor: 'rgba(0, 0, 0, 1)', iconOpacity: 0.45 }, // Not Implemented
				forced: { bg: 'rgba(0, 0, 0, 0)', iconColor: 'rgba(0, 0, 0, 1)', iconOpacity: 0.45 }
			}
		},
		label: {
			margin: 12,
			fontFamily: 'Roboto',
			fontSize: 21,
			_fontWeight: 'bold',
			states: {
				default: { color: 'rgba(0, 0, 0, 0)' },
				pressed: { color: 'rgba(0, 0, 0, 0)' },
				disabled: { color: 'rgba(0, 0, 0, 0)' },
				toggled: { color: 'rgba(0, 0, 0, 0)' },
				forced: { color: 'rgba(0, 0, 0, 0)' }
			}
		},
		turnbinds: {
			width: 6,
			height: 25,
			borderWidth: 0,
			borderColor: 'rgba(0, 0, 0, 0)',
			borderRadius: 4,
			states: {
				default: { bg: 'rgba(0, 0, 0, 0)' },
				pressed: { bg: 'rgba(0, 0, 0, 0)' },
				disabled: { bg: 'rgba(0, 0, 0, 0)' },
				toggled: { bg: 'rgba(0, 0, 0, 0)' }, // Not Implemented
				forced: { bg: 'rgba(0, 0, 0, 0)' }
			}
		}
	},
	icons: {
		_size: 32,
		_modifier_size: 24,
		_jump_duck_size: 24,

		scale_factor: 1.5,
		replaceModifiers: false,
		dir: {
			states: {
				default: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				pressed: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				disabled: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				toggled: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 }, // Not Implemented
				forced: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 }
			}
		},
		jump_duck: {
			states: {
				default: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				pressed: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				disabled: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				toggled: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				forced: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 }
			}
		},
		modifiers: {
			states: {
				default: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				pressed: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				disabled: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				toggled: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 },
				forced: { bg: 'rgba(0, 0, 0, 0)', opacity: 1 }
			}
		}
	}
};

@PanelHandler()
class KeyPress {
	readonly panels = { keypress: $.GetContextPanel() };
	readonly keys: Map<Button, PanelInfoType[]> = new Map();

	constructor() {
		$.RegisterEventHandler('HudProcessInput', $.GetContextPanel(), () => this.onUpdate());

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			dynamicStyles: {
				type: {
					name: 'Type',
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'Text', value: 'text' },
						{ label: 'Icons', value: 'icons' }
					],
					children: [
						{ styleID: 'textSize', showWhen: 'text' },
						{ styleID: 'textDir', showWhen: 'text' },
						{ styleID: 'textLabel', showWhen: 'text' },
						{ styleID: 'textTurnbinds', showWhen: 'text' },
						{ styleID: 'iconsSize', showWhen: 'icons' },
						{ styleID: 'iconsReplaceModifiers', showWhen: 'icons' },
						{ styleID: 'iconsDir', showWhen: 'icons' },
						{ styleID: 'iconsModifiers', showWhen: 'icons' },
						{ styleID: 'iconsJumpDuck', showWhen: 'icons' }
					],
					callbackFunc: (_, value) => {
						Config.type = value;
						if (Config.type === 'text') this.createTextType();
						else this.createIconsType();
					}
				},
				/**
				 * KEYPRESS - TEXT
				 */
				textSize: {
					name: 'Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.text.scale_factor = value / 10;
						this.createTextType();
					}
				},

				// DIRECTIONAL KEYS
				textDir: {
					name: 'Directional Keys',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'textDirBorderStyling' }, { styleID: 'textColors' }]
				},
				textDirBorderStyling: {
					name: 'Border Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textDirPanelBorderWidth' },
						{ styleID: 'textDirPanelBorderColor' },
						{ styleID: 'textDirPanelBorderRadius' }
					]
				},
				textDirPanelBorderWidth: {
					name: 'Border Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.text.dir.borderWidth = value;
						this.updateStyles();
					}
				},
				textDirPanelBorderColor: {
					name: 'Border Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.dir.borderColor = value;
						this.updateStyles();
					}
				},
				textDirPanelBorderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.text.dir.borderRadius = value;
						this.updateStyles();
					}
				},
				textColors: {
					name: 'Colors',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'textDirPanel' }, { styleID: 'textDirIcon' }]
				},
				textDirPanel: {
					name: 'Background',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textDirPanelDefaultBg' },
						{ styleID: 'textDirPanelPressedBg' },
						{ styleID: 'textDirPanelDisabledBg' },
						{ styleID: 'textDirPanelForcedBg' }
					]
				},
				textDirPanelDefaultBg: {
					name: 'Default Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.dir.states.default.bg = value;
						this.updateStyles();
					}
				},
				textDirPanelPressedBg: {
					name: 'Pressed Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.dir.states.pressed.bg = value;
						this.updateStyles();
					}
				},
				textDirPanelDisabledBg: {
					name: 'Disabled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.dir.states.disabled.bg = value;
						this.updateStyles();
					}
				},
				textDirPanelForcedBg: {
					name: 'Forced Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.dir.states.forced.bg = value;
						this.updateStyles();
					}
				},
				textDirIcon: {
					name: 'Icons',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textDirIconDefaultColor' },
						{ styleID: 'textDirIconPressedColor' },
						{ styleID: 'textDirIconDisabledColor' },
						{ styleID: 'textDirIconForcedColor' }
					]
				},
				textDirIconDefaultColor: {
					name: 'Default Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.text.dir.states.default.iconColor = splitRGBA.rgb;
						Config.text.dir.states.default.iconOpacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				textDirIconPressedColor: {
					name: 'Pressed Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.text.dir.states.pressed.iconColor = splitRGBA.rgb;
						Config.text.dir.states.pressed.iconOpacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				textDirIconDisabledColor: {
					name: 'Disabled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.text.dir.states.disabled.iconColor = splitRGBA.rgb;
						Config.text.dir.states.disabled.iconOpacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				textDirIconForcedColor: {
					name: 'Forced Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.text.dir.states.forced.iconColor = splitRGBA.rgb;
						Config.text.dir.states.forced.iconOpacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},

				// LABELS
				textLabel: {
					name: 'Labels',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textLabelFont' },
						{ styleID: 'textLabelDefaultColor' },
						{ styleID: 'textLabelPressedColor' },
						{ styleID: 'textLabelDisabledColor' },
						{ styleID: 'textLabelToggledColor' },
						{ styleID: 'textLabelForcedColor' }
					]
				},
				textLabelFont: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => {
						Config.text.label.fontFamily = value;
						this.updateStyles();
					}
				},
				textLabelDefaultColor: {
					name: 'Default Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.label.states.default.color = value;
						this.updateStyles();
					}
				},
				textLabelPressedColor: {
					name: 'Pressed Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.label.states.pressed.color = value;
						this.updateStyles();
					}
				},
				textLabelDisabledColor: {
					name: 'Disabled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.label.states.disabled.color = value;
						this.updateStyles();
					}
				},
				textLabelToggledColor: {
					name: 'Toggled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.label.states.toggled.color = value;
						this.updateStyles();
					}
				},
				textLabelForcedColor: {
					name: 'Forced Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.label.states.forced.color = value;
						this.updateStyles();
					}
				},

				// TURNBINDS
				textTurnbinds: {
					name: 'Turn Keys',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textTurnbindsWidth' },
						{ styleID: 'textTurnbindsHeight' },
						{ styleID: 'textTurnbindsBorderStyling' },
						{ styleID: 'textTurnbindsColors' }
					]
				},
				textTurnbindsWidth: {
					name: 'Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.width = value;
						this.createTextType();
					}
				},
				textTurnbindsHeight: {
					name: 'Height',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.height = value;
						this.createTextType();
					}
				},
				textTurnbindsBorderStyling: {
					name: 'Border Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textTurnbindBorderWidth' },
						{ styleID: 'textTurnbindBorderColor' },
						{ styleID: 'textTurnbindBorderRadius' }
					]
				},
				textTurnbindBorderWidth: {
					name: 'Border Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.borderWidth = value;
						this.updateStyles();
					}
				},
				textTurnbindBorderColor: {
					name: 'Border Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.borderColor = value;
						this.updateStyles();
					}
				},
				textTurnbindBorderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.borderRadius = value;
						this.updateStyles();
					}
				},
				textTurnbindsColors: {
					name: 'Colors',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textTurnbindsDefaultBg' },
						{ styleID: 'textTurnbindsPressedBg' },
						{ styleID: 'textTurnbindsDisabledBg' },
						{ styleID: 'textTurnbindsForcedBg' }
					]
				},
				textTurnbindsDefaultBg: {
					name: 'Default Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.states.default.bg = value;
						this.updateStyles();
					}
				},
				textTurnbindsPressedBg: {
					name: 'Pressed Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.states.pressed.bg = value;
						this.updateStyles();
					}
				},
				textTurnbindsDisabledBg: {
					name: 'Disabled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.states.disabled.bg = value;
						this.updateStyles();
					}
				},
				textTurnbindsForcedBg: {
					name: 'Forced Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.text.turnbinds.states.forced.bg = value;
						this.updateStyles();
					}
				},

				/**
				 * KEYPRESS - ICONS
				 */
				iconsSize: {
					name: 'Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.icons.scale_factor = value / 10;
						this.createIconsType();
					}
				},
				iconsReplaceModifiers: {
					name: 'Jump/Duck As Modifiers',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						Config.icons.replaceModifiers = value;
						this.createIconsType();
					}
				},

				// DIRECTIONAL KEYS
				iconsDir: {
					name: 'Directional Keys',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'iconsDirDefaultColor' },
						{ styleID: 'iconsDirPressedColor' },
						{ styleID: 'iconsDirDisabledColor' },
						{ styleID: 'iconsDirForcedColor' }
					]
				},
				iconsDirDefaultColor: {
					name: 'Default Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.dir.states.default.bg = splitRGBA.rgb;
						Config.icons.dir.states.default.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsDirPressedColor: {
					name: 'Pressed Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.dir.states.pressed.bg = splitRGBA.rgb;
						Config.icons.dir.states.pressed.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsDirDisabledColor: {
					name: 'Disabled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.dir.states.disabled.bg = splitRGBA.rgb;
						Config.icons.dir.states.disabled.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsDirForcedColor: {
					name: 'Forced Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.dir.states.forced.bg = splitRGBA.rgb;
						Config.icons.dir.states.forced.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},

				// MODIFIER KEYS
				iconsModifiers: {
					name: 'Modifiers',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'iconsModifiersDefaultColor' },
						{ styleID: 'iconsModifiersPressedColor' },
						{ styleID: 'iconsModifiersDisabledColor' },
						{ styleID: 'iconsModifiersToggledColor' },
						{ styleID: 'iconsModifiersForcedColor' }
					]
				},
				iconsModifiersDefaultColor: {
					name: 'Default Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.modifiers.states.default.bg = splitRGBA.rgb;
						Config.icons.modifiers.states.default.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsModifiersPressedColor: {
					name: 'Pressed Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.modifiers.states.pressed.bg = splitRGBA.rgb;
						Config.icons.modifiers.states.pressed.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsModifiersDisabledColor: {
					name: 'Disabled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.modifiers.states.disabled.bg = splitRGBA.rgb;
						Config.icons.modifiers.states.disabled.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsModifiersToggledColor: {
					name: 'Toggled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.modifiers.states.toggled.bg = splitRGBA.rgb;
						Config.icons.modifiers.states.toggled.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsModifiersForcedColor: {
					name: 'Forced Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.modifiers.states.forced.bg = splitRGBA.rgb;
						Config.icons.modifiers.states.forced.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},

				// JUMP_DUCK KEYS
				iconsJumpDuck: {
					name: 'Jump/Duck Keys',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'iconsJumpDuckDefaultColor' },
						{ styleID: 'iconsJumpDuckPressedColor' },
						{ styleID: 'iconsJumpDuckDisabledColor' },
						{ styleID: 'iconsJumpDuckToggledColor' },
						{ styleID: 'iconsJumpDuckForcedColor' }
					]
				},
				iconsJumpDuckDefaultColor: {
					name: 'Default Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.jump_duck.states.default.bg = splitRGBA.rgb;
						Config.icons.jump_duck.states.default.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsJumpDuckPressedColor: {
					name: 'Pressed Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.jump_duck.states.pressed.bg = splitRGBA.rgb;
						Config.icons.jump_duck.states.pressed.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsJumpDuckDisabledColor: {
					name: 'Disabled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.jump_duck.states.disabled.bg = splitRGBA.rgb;
						Config.icons.jump_duck.states.disabled.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsJumpDuckToggledColor: {
					name: 'Toggled Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.jump_duck.states.toggled.bg = splitRGBA.rgb;
						Config.icons.jump_duck.states.toggled.opacity = splitRGBA.alpha;
						this.updateStyles();
					}
				},
				iconsJumpDuckForcedColor: {
					name: 'Forced Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const splitRGBA = splitRgbFromAlpha(value as rgbaColor);
						Config.icons.jump_duck.states.forced.bg = splitRGBA.rgb;
						Config.icons.jump_duck.states.forced.opacity = splitRGBA.alpha;
						this.updateStyles();

						// Hack to initialize to the proper type
						this.initHUD();
					}
				}
			}
		});
	}

	initHUD() {
		if (Config.type === 'text') this.createTextType();
		else this.createIconsType();
	}

	updateStyles() {
		this.keys.forEach((panels) => panels.forEach((panel) => this.applyStaticStyles(panel)));
	}

	// Styles applied regardless of panel state
	applyStaticStyles(panelInfo: PanelInfoType) {
		const panel = panelInfo.panel;

		switch (panelInfo.type) {
			case KeySettingsType.TEXT_DIR_PANEL:
				panel.style.border = `${Config.text.dir.borderWidth}px solid ${Config.text.dir.borderColor}`;
				panel.style.borderRadius = `${Config.text.dir.borderRadius}px`;
				break;
			case KeySettingsType.TEXT_LABEL:
				panel.style.fontFamily = Config.text.label.fontFamily;
				panel.style.fontWeight = Config.text.label._fontWeight as
					| 'bold'
					| 'light'
					| 'thin'
					| 'normal'
					| 'medium'
					| 'black';
				break;
			case KeySettingsType.TEXT_TURNBIND:
				panel.style.border = `${Config.text.turnbinds.borderWidth}px solid ${Config.text.turnbinds.borderColor}`;
				panel.style.borderRadius = `${Config.text.turnbinds.borderRadius}px`;
				break;
		}

		this.applyStateStyles(panelInfo);
	}

	// Styles depending on panel state
	applyStateStyles(panelInfo: PanelInfoType) {
		const { panel, type, state } = panelInfo;

		switch (type) {
			// KEYPRESS - TEXT
			case KeySettingsType.TEXT_DIR_PANEL:
				panel.style.backgroundColor = Config.text.dir.states[state].bg as color;
				break;
			case KeySettingsType.TEXT_DIR_ICON:
				panel.style.washColor = Config.text.dir.states[state].iconColor;
				panel.style.opacity = Config.text.dir.states[state].iconOpacity;
				break;
			case KeySettingsType.TEXT_LABEL: {
				const color = Config.text.label.states[state].color;
				panel.style.color = color;
				panel.style.textShadow = this.getAdjustedTextShadow(color as rgbaColor);
				break;
			}
			case KeySettingsType.TEXT_TURNBIND:
				panel.style.backgroundColor = Config.text.turnbinds.states[state].bg as color;
				break;

			// KEYPRESS - ICONS
			case KeySettingsType.ICONS_DIR:
				panel.style.washColor = Config.icons.dir.states[state].bg as color;
				panel.style.opacity = Config.icons.dir.states[state].opacity;
				break;
			case KeySettingsType.ICONS_MODIFIER:
				panel.style.washColor = Config.icons.modifiers.states[state].bg as color;
				panel.style.opacity = Config.icons.modifiers.states[state].opacity;
				break;
			case KeySettingsType.ICONS_JUMP_DUCK:
				panel.style.washColor = Config.icons.jump_duck.states[state].bg as color;
				panel.style.opacity = Config.icons.jump_duck.states[state].opacity;
		}
	}

	createTextType() {
		this.panels.keypress.RemoveAndDeleteChildren();
		this.keys.clear();

		const createMainKeys = () => {
			const DIRECTIONAL_KEYS: KeySettings[] = [
				{
					input: Button.FORWARD,
					icon: 'right-arrow',
					rotate: -90,
					position: {
						x: Config.text.turnbinds.width + Config.text._size + Config.text._key_margin * 2,
						y: 0
					},
					size: Config.text._size,
					type: KeySettingsType.TEXT_DIR_PANEL
				},
				{
					input: Button.BACK,
					icon: 'right-arrow',
					rotate: 90,
					position: {
						x: Config.text.turnbinds.width + Config.text._size + Config.text._key_margin * 2,
						y: Config.text._size + Config.text._key_margin
					},
					size: Config.text._size,
					type: KeySettingsType.TEXT_DIR_PANEL
				},
				{
					input: Button.MOVELEFT,
					icon: 'right-arrow',
					rotate: 180,
					position: {
						x: Config.text.turnbinds.width + Config.text._key_margin,
						y: Config.text._size + Config.text._key_margin
					},
					size: Config.text._size,
					type: KeySettingsType.TEXT_DIR_PANEL
				},
				{
					input: Button.MOVERIGHT,
					icon: 'right-arrow',
					rotate: 0,
					position: {
						x: Config.text.turnbinds.width + Config.text._size * 2 + Config.text._key_margin * 3,
						y: Config.text._size + Config.text._key_margin
					},
					size: Config.text._size,
					type: KeySettingsType.TEXT_DIR_PANEL
				}
			];

			const TURNBIND_KEYS = [
				{
					input: Button.LEFT,
					position: {
						x: 0,
						y: 1.5 * Config.text._size + Config.text._key_margin - Config.text.turnbinds.height / 2
					},
					size: Config.text.turnbinds.height,
					type: KeySettingsType.TEXT_TURNBIND
				},
				{
					input: Button.RIGHT,
					icon: 'right-arrow',
					position: {
						x: Config.text.turnbinds.width + Config.text._size * 3 + Config.text._key_margin * 4,
						y: 1.5 * Config.text._size + Config.text._key_margin - Config.text.turnbinds.height / 2
					},
					size: Config.text.turnbinds.height,
					type: KeySettingsType.TEXT_TURNBIND
				}
			];

			for (const key of DIRECTIONAL_KEYS) {
				const size = (key.size ?? Config.text._size) * Config.text.scale_factor;
				const panel = $.CreatePanel('Panel', this.panels.keypress, '', {
					style: `width: ${size}px; height: ${size}px; x: ${key.position.x * Config.text.scale_factor}px; y: ${key.position.y * Config.text.scale_factor}px;`
				});

				const icon = $.CreatePanel('Image', panel, '', {
					src: `file://{images}/keypress/${key.icon}.svg`,
					style: `width: 100%; height: 100%; transform: rotateZ(${key.rotate}deg);`,
					textureheight: size
				});

				this.keys.set(key.input, [
					{ panel: panel, type: key.type, state: 'default' },
					{ panel: icon, type: KeySettingsType.TEXT_DIR_ICON, state: 'default' }
				]);
			}

			for (const key of TURNBIND_KEYS) {
				const width = Config.text.turnbinds.width * Config.text.scale_factor;
				const height = (key.size ?? Config.text.turnbinds.height) * Config.text.scale_factor;
				const panel = $.CreatePanel('Panel', this.panels.keypress, '', {
					style: `
                    width: ${width}px;
                    height: ${height}px;
                    x: ${key.position.x * Config.text.scale_factor}px;
                    y: ${key.position.y * Config.text.scale_factor}px;
                    `
				});

				this.keys.set(key.input, [{ panel: panel, type: key.type, state: 'default' }]);
			}
		};

		// TODO: Make this selectable when per-gamemode configs are available
		const createLabels = () => {
			const labelContainer = $.CreatePanel('Panel', this.panels.keypress, '', {
				style: `
                width: ${(Config.text._size * 3 + Config.text._key_margin * 2) * Config.text.scale_factor}px;
                flow-children: down;
                text-align: center;
                y: ${(Config.text._size * 2 + Config.text._key_margin) * Config.text.scale_factor + Config.text.label.margin}px;
                x: ${(Config.text.turnbinds.width + Config.text._key_margin) * Config.text.scale_factor}px;`
			});

			const labels = this.getGamemodeLabels();

			for (const label of labels) {
				const labelPanel = $.CreatePanel('Label', labelContainer, '', {
					style: `
                    horizontal-align: center;
                    font-size: ${Config.text.label.fontSize * Config.text.scale_factor}px;`,
					text: label.text
				});

				this.keys.set(label.input, [{ panel: labelPanel, type: KeySettingsType.TEXT_LABEL, state: 'default' }]);
			}
		};

		const createAttackButtons = () => {
			const gamemode = GameModeAPI.GetCurrentGameMode();
			const attackButtonGamemodes = [
				Gamemode.RJ,
				Gamemode.SJ,
				Gamemode.CONC,
				Gamemode.DEFRAG_CPM,
				Gamemode.DEFRAG_VQ3,
				Gamemode.DEFRAG_VTG
			];
			if (!attackButtonGamemodes.includes(gamemode)) return;

			const A1 = $.CreatePanel('Label', this.panels.keypress, '', {
				text: 'A1',
				// X is wrong when Config.text.size changes, it's not customizable anyway
				style: `
                    x: ${Config.text.turnbinds.width * Config.text.scale_factor - 6}px;
                    y: ${-11 * Config.text.scale_factor}px;
                    font-size: ${Config.text.label.fontSize * Config.text.scale_factor}px;
                `
			});

			const A2 = $.CreatePanel('Label', this.panels.keypress, '', {
				text: 'A2',
				style: `
                    x: ${(Config.text.turnbinds.width + Config.text._size * 2 + Config.text._key_margin * 3 + 7) * Config.text.scale_factor}px;
                    y: ${-11 * Config.text.scale_factor}px;
                    font-size: ${Config.text.label.fontSize * Config.text.scale_factor}px;
                `
			});

			this.keys.set(Button.ATTACK, [{ panel: A1, type: KeySettingsType.TEXT_LABEL, state: 'default' }]);
			this.keys.set(Button.ATTACK2, [{ panel: A2, type: KeySettingsType.TEXT_LABEL, state: 'default' }]);
		};

		createMainKeys();
		createLabels();
		createAttackButtons();
		this.updateStyles();
	}

	createIconsType() {
		this.panels.keypress.RemoveAndDeleteChildren();
		this.keys.clear();

		const KEYS: KeySettings[] = [
			{
				input: Button.FORWARD,
				icon: 'chevron-down',
				rotate: 180,
				position: { x: 48, y: 16 },
				size: Config.icons._size,
				type: KeySettingsType.ICONS_DIR
			},
			{
				input: Config.icons.replaceModifiers ? Button.JUMP : Button.SPEED,
				icon: 'chevron-down',
				rotate: 180,
				position: { x: 52, y: 0 },
				size: Config.icons._modifier_size,
				type: KeySettingsType.ICONS_MODIFIER
			},
			{
				input: Button.BACK,
				icon: 'chevron-down',
				rotate: 0,
				position: { x: 48, y: 48 },
				size: Config.icons._size,
				type: KeySettingsType.ICONS_DIR
			},
			{
				input: Config.icons.replaceModifiers ? Button.DUCK : Button.WALK,
				icon: 'chevron-down',
				rotate: 0,
				position: { x: 52, y: 72 },
				size: Config.icons._modifier_size,
				type: KeySettingsType.ICONS_MODIFIER
			},
			{
				input: Button.MOVELEFT,
				icon: 'chevron-down',
				rotate: 90,
				position: { x: 16, y: 32 },
				size: Config.icons._size,
				type: KeySettingsType.ICONS_DIR
			},
			{
				input: Button.LEFT,
				icon: 'chevron-down',
				rotate: 90,
				position: { x: 0, y: 36 },
				size: Config.icons._modifier_size,
				type: KeySettingsType.ICONS_MODIFIER
			},
			{
				input: Button.MOVERIGHT,
				icon: 'chevron-down',
				rotate: -90,
				position: { x: 80, y: 32 },
				size: Config.icons._size,
				type: KeySettingsType.ICONS_DIR
			},
			{
				input: Button.RIGHT,
				icon: 'chevron-down',
				rotate: -90,
				position: { x: 104, y: 36 },
				size: Config.icons._modifier_size,
				type: KeySettingsType.ICONS_MODIFIER
			}
		];

		if (!Config.icons.replaceModifiers)
			KEYS.push(
				{
					input: Button.JUMP,
					icon: 'jump',
					rotate: 0,
					position: { x: 40, y: 92 },
					size: Config.icons._jump_duck_size,
					type: KeySettingsType.ICONS_JUMP_DUCK
				},
				{
					input: Button.DUCK,
					icon: 'jump',
					rotate: 180,
					position: { x: 68, y: 92 },
					size: Config.icons._jump_duck_size,
					type: KeySettingsType.ICONS_JUMP_DUCK
				}
			);

		for (const key of KEYS) {
			const size = (key.size ?? Config.icons._size) * Config.icons.scale_factor;
			const panel = $.CreatePanel('Image', this.panels.keypress, '', {
				src: `file://{images}/keypress/${key.icon}.svg`,
				style: `
					width: ${size}px;
					height: ${size}px;
					x: ${key.position.x * Config.icons.scale_factor}px;
					y: ${key.position.y * Config.icons.scale_factor}px;
					transform: rotateZ(${key.rotate}deg);`,
				textureheight: size
			});

			this.keys.set(key.input, [{ panel: panel, type: key.type, state: 'default' }]);
		}

		this.updateStyles();
	}

	onUpdate() {
		const { physicalButtons, disabledButtons, toggledButtons, forcedButtons } = MomentumInputAPI.GetButtons();

		const getState = (button: Button): ButtonState => {
			if ((disabledButtons & button) !== 0) return 'disabled';
			if ((physicalButtons & button) !== 0) return 'pressed';
			if ((toggledButtons & button) !== 0) return 'toggled';
			if ((forcedButtons & button) !== 0) return 'forced';
			return 'default';
		};

		this.keys.forEach((panels, button) => {
			const state = getState(button);
			panels.forEach((panel) => {
				if (panel.state !== state) {
					panel.state = state;
					this.applyStateStyles(panel);
				}
			});
		});
	}

	getGamemodeLabels() {
		const gamemode = GameModeAPI.GetCurrentGameMode();
		const labels = {
			jump: $.Localize('#Keypress_Jump'),
			duck: $.Localize('#Keypress_Duck'),
			walk: $.Localize('#Keypress_Walk'),
			sprint: $.Localize('#Keypress_Sprint')
		};

		switch (gamemode) {
			case Gamemode.RJ:
			case Gamemode.SJ:
			case Gamemode.CONC:
			case Gamemode.DEFRAG_CPM:
			case Gamemode.DEFRAG_VQ3:
			case Gamemode.DEFRAG_VTG:
				return [
					{ text: labels.jump, input: Button.JUMP },
					{ text: labels.duck, input: Button.DUCK }
				];
			case Gamemode.AHOP:
				return [
					{ text: labels.jump, input: Button.JUMP },
					{ text: labels.duck, input: Button.DUCK },
					{ text: labels.walk, input: Button.WALK },
					{ text: labels.sprint, input: Button.SPEED }
				];

			default:
				return [
					{ text: labels.jump, input: Button.JUMP },
					{ text: labels.duck, input: Button.DUCK },
					{ text: labels.walk, input: Button.SPEED }
				];
		}
	}

	getAdjustedTextShadow(color: rgbaColor) {
		const splitRGBA = splitRgbFromAlpha(color);
		return `0 3px 6px rgba(0, 0, 0, ${splitRGBA.alpha * 0.5})`;
	}
}
