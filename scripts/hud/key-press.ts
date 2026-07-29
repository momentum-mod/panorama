import { PanelHandler } from 'util/module-helpers';
import { Button } from 'common/buttons';
import { registerHUDCustomizerComponent, CustomizerPropertyType, getTextShadowFast } from 'common/hud-customizer';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { rgbaStringToTuple } from 'util/colors';

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
			enabled: {
				jump: true,
				duck: true,
				walk: true,
				sprint: true
			},
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
	panels = {
		keypress: $.GetContextPanel(),
		labelContainer: undefined
	};
	readonly keys: Map<Button, PanelInfoType[]> = new Map();

	constructor() {
		$.RegisterEventHandler('HudProcessInput', $.GetContextPanel(), () => this.onUpdate());

		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Key_Press_Name'),
			resizeX: false,
			resizeY: false,
			dynamicStyles: {
				type: {
					name: $.Localize('#Customizer_Type'),
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
					callbackFunc: (_, value) => (Config.type = value),
					onChanged: () => {
						if (Config.type === 'text') this.createTextType();
						else this.createIconsType();
					}
				},
				/**
				 * KEYPRESS - TEXT
				 */
				textSize: {
					name: $.Localize('#Customizer_Size'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.text.scale_factor = value / 10),
					onChanged: () => this.createTextType()
				},

				// DIRECTIONAL KEYS
				textDir: {
					name: $.Localize('#Customizer_Key_Press_DirectionalKeys'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'textDirBorderStyling' }, { styleID: 'textColors' }]
				},
				textDirBorderStyling: {
					name: $.Localize('#Customizer_BorderStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textDirPanelBorderWidth' },
						{ styleID: 'textDirPanelBorderColor' },
						{ styleID: 'textDirPanelBorderRadius' }
					]
				},
				textDirPanelBorderWidth: {
					name: $.Localize('#Customizer_BorderWidth'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.text.dir.borderWidth = value),
					onChanged: () => this.updateStyles()
				},
				textDirPanelBorderColor: {
					name: $.Localize('#Customizer_BorderColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.dir.borderColor = value),
					onChanged: () => this.updateStyles()
				},
				textDirPanelBorderRadius: {
					name: $.Localize('#Customizer_BorderRadius'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.text.dir.borderRadius = value),
					onChanged: () => this.updateStyles()
				},
				textColors: {
					name: $.Localize('#Customizer_Colors'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'textDirPanel' }, { styleID: 'textDirIcon' }]
				},
				textDirPanel: {
					name: $.Localize('#Customizer_Background'),
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
					name: $.Localize('#Customizer_Key_Press_DefaultColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.dir.states.default.bg = value),
					onChanged: () => this.updateStyles()
				},
				textDirPanelPressedBg: {
					name: $.Localize('#Customizer_Key_Press_PressedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.dir.states.pressed.bg = value),
					onChanged: () => this.updateStyles()
				},
				textDirPanelDisabledBg: {
					name: $.Localize('#Customizer_Key_Press_DisabledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.dir.states.disabled.bg = value),
					onChanged: () => this.updateStyles()
				},
				textDirPanelForcedBg: {
					name: $.Localize('#Customizer_Key_Press_ForcedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.dir.states.forced.bg = value),
					onChanged: () => this.updateStyles()
				},
				textDirIcon: {
					name: $.Localize('#Customizer_Key_Press_TextDirIcon'),
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
					name: $.Localize('#Customizer_Key_Press_DefaultColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.text.dir.states.default.iconColor = `rgb(${r}, ${g}, ${b})`;
						Config.text.dir.states.default.iconOpacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				textDirIconPressedColor: {
					name: $.Localize('#Customizer_Key_Press_PressedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.text.dir.states.pressed.iconColor = `rgb(${r}, ${g}, ${b})`;
						Config.text.dir.states.pressed.iconOpacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				textDirIconDisabledColor: {
					name: $.Localize('#Customizer_Key_Press_DisabledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.text.dir.states.disabled.iconColor = `rgb(${r}, ${g}, ${b})`;
						Config.text.dir.states.disabled.iconOpacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				textDirIconForcedColor: {
					name: $.Localize('#Customizer_Key_Press_ForcedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.text.dir.states.forced.iconColor = `rgb(${r}, ${g}, ${b})`;
						Config.text.dir.states.forced.iconOpacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},

				// LABELS
				textLabel: {
					name: $.Localize('#Customizer_Key_Press_TextLabel'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textLabelShow' },
						{ styleID: 'textLabelFont' },
						{ styleID: 'textLabelDefaultColor' },
						{ styleID: 'textLabelPressedColor' },
						{ styleID: 'textLabelDisabledColor' },
						{ styleID: 'textLabelToggledColor' },
						{ styleID: 'textLabelForcedColor' }
					]
				},
				textLabelShow: {
					name: $.Localize('#Customizer_ShowLabels'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textLabelShowJump' },
						{ styleID: 'textLabelShowDuck' },
						{ styleID: 'textLabelShowWalk' },
						{ styleID: 'textLabelShowSprint' }
					]
				},
				textLabelShowJump: {
					name: $.Localize('#Customizer_Key_Press_TextLabelShowJump'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (Config.text.label.enabled.jump = value),
					onChanged: () => this.createTextType()
				},
				textLabelShowDuck: {
					name: $.Localize('#Customizer_Key_Press_TextLabelShowDuck'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (Config.text.label.enabled.duck = value),
					onChanged: () => this.createTextType()
				},
				textLabelShowWalk: {
					name: $.Localize('#Customizer_Key_Press_TextLabelShowWalk'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (Config.text.label.enabled.walk = value),
					onChanged: () => this.createTextType()
				},
				textLabelShowSprint: {
					name: $.Localize('#Customizer_Key_Press_TextLabelShowSprint'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (Config.text.label.enabled.sprint = value),
					onChanged: () => this.createTextType()
				},
				textLabelFont: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => (Config.text.label.fontFamily = value),
					onChanged: () => this.updateStyles()
				},
				textLabelDefaultColor: {
					name: $.Localize('#Customizer_Key_Press_DefaultColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.label.states.default.color = value),
					onChanged: () => this.updateStyles()
				},
				textLabelPressedColor: {
					name: $.Localize('#Customizer_Key_Press_PressedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.label.states.pressed.color = value),
					onChanged: () => this.updateStyles()
				},
				textLabelDisabledColor: {
					name: $.Localize('#Customizer_Key_Press_DisabledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.label.states.disabled.color = value),
					onChanged: () => this.updateStyles()
				},
				textLabelToggledColor: {
					name: $.Localize('#Customizer_Key_Press_ToggledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.label.states.toggled.color = value),
					onChanged: () => this.updateStyles()
				},
				textLabelForcedColor: {
					name: $.Localize('#Customizer_Key_Press_ForcedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.label.states.forced.color = value),
					onChanged: () => this.updateStyles()
				},

				// TURNBINDS
				textTurnbinds: {
					name: $.Localize('#Customizer_Key_Press_TextTurnbinds'),
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
					name: $.Localize('#Customizer_Width'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.text.turnbinds.width = value),
					onChanged: () => this.createTextType()
				},
				textTurnbindsHeight: {
					name: $.Localize('#Customizer_Height'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.text.turnbinds.height = value),
					onChanged: () => this.createTextType()
				},
				textTurnbindsBorderStyling: {
					name: $.Localize('#Customizer_BorderStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'textTurnbindBorderWidth' },
						{ styleID: 'textTurnbindBorderColor' },
						{ styleID: 'textTurnbindBorderRadius' }
					]
				},
				textTurnbindBorderWidth: {
					name: $.Localize('#Customizer_BorderWidth'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.text.turnbinds.borderWidth = value),
					onChanged: () => this.updateStyles()
				},
				textTurnbindBorderColor: {
					name: $.Localize('#Customizer_BorderColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.turnbinds.borderColor = value),
					onChanged: () => this.updateStyles()
				},
				textTurnbindBorderRadius: {
					name: $.Localize('#Customizer_BorderRadius'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.text.turnbinds.borderRadius = value),
					onChanged: () => this.updateStyles()
				},
				textTurnbindsColors: {
					name: $.Localize('#Customizer_Colors'),
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
					name: $.Localize('#Customizer_Key_Press_DefaultColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.turnbinds.states.default.bg = value),
					onChanged: () => this.updateStyles()
				},
				textTurnbindsPressedBg: {
					name: $.Localize('#Customizer_Key_Press_PressedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.turnbinds.states.pressed.bg = value),
					onChanged: () => this.updateStyles()
				},
				textTurnbindsDisabledBg: {
					name: $.Localize('#Customizer_Key_Press_DisabledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.turnbinds.states.disabled.bg = value),
					onChanged: () => this.updateStyles()
				},
				textTurnbindsForcedBg: {
					name: $.Localize('#Customizer_Key_Press_ForcedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.text.turnbinds.states.forced.bg = value),
					onChanged: () => this.updateStyles()
				},

				/**
				 * KEYPRESS - ICONS
				 */
				iconsSize: {
					name: $.Localize('#Customizer_Size'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.icons.scale_factor = value / 10),
					onChanged: () => this.createIconsType()
				},
				iconsReplaceModifiers: {
					name: $.Localize('#Customizer_Key_Press_IconsReplaceModifiers'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (Config.icons.replaceModifiers = value),
					onChanged: () => this.createIconsType()
				},

				// DIRECTIONAL KEYS
				iconsDir: {
					name: $.Localize('#Customizer_Key_Press_DirectionalKeys'),
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
					name: $.Localize('#Customizer_Key_Press_DefaultColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.dir.states.default.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.dir.states.default.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsDirPressedColor: {
					name: $.Localize('#Customizer_Key_Press_PressedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.dir.states.pressed.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.dir.states.pressed.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsDirDisabledColor: {
					name: $.Localize('#Customizer_Key_Press_DisabledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.dir.states.disabled.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.dir.states.disabled.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsDirForcedColor: {
					name: $.Localize('#Customizer_Key_Press_ForcedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.dir.states.forced.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.dir.states.forced.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},

				// MODIFIER KEYS
				iconsModifiers: {
					name: $.Localize('#Customizer_Key_Press_IconsModifiers'),
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
					name: $.Localize('#Customizer_Key_Press_DefaultColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.modifiers.states.default.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.modifiers.states.default.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsModifiersPressedColor: {
					name: $.Localize('#Customizer_Key_Press_PressedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.modifiers.states.pressed.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.modifiers.states.pressed.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsModifiersDisabledColor: {
					name: $.Localize('#Customizer_Key_Press_DisabledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.modifiers.states.disabled.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.modifiers.states.disabled.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsModifiersToggledColor: {
					name: $.Localize('#Customizer_Key_Press_ToggledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.modifiers.states.toggled.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.modifiers.states.toggled.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsModifiersForcedColor: {
					name: $.Localize('#Customizer_Key_Press_ForcedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.modifiers.states.forced.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.modifiers.states.forced.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},

				// JUMP_DUCK KEYS
				iconsJumpDuck: {
					name: $.Localize('#Customizer_Key_Press_IconsJumpDuck'),
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
					name: $.Localize('#Customizer_Key_Press_DefaultColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.jump_duck.states.default.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.jump_duck.states.default.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsJumpDuckPressedColor: {
					name: $.Localize('#Customizer_Key_Press_PressedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.jump_duck.states.pressed.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.jump_duck.states.pressed.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsJumpDuckDisabledColor: {
					name: $.Localize('#Customizer_Key_Press_DisabledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.jump_duck.states.disabled.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.jump_duck.states.disabled.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsJumpDuckToggledColor: {
					name: $.Localize('#Customizer_Key_Press_ToggledColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.jump_duck.states.toggled.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.jump_duck.states.toggled.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				},
				iconsJumpDuckForcedColor: {
					name: $.Localize('#Customizer_Key_Press_ForcedColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);
						Config.icons.jump_duck.states.forced.bg = `rgb(${r}, ${g}, ${b})`;
						Config.icons.jump_duck.states.forced.opacity = alpha / 255;
					},
					onChanged: () => this.updateStyles()
				}
			},
			postInit: () => {
				if (Config.type === 'text') this.createTextType();
				else this.createIconsType();

				this.updateStyles();
			}
		});
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
				panel.style.fontFamily = `"${Config.text.label.fontFamily}"`;
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
				panel.style.textShadow = getTextShadowFast(color as rgbaColor, 0.5);
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
		const enabled = Config.text.label.enabled;

		// In all gamemodes except AHOP, walk is triggered by the sprint button. Sprint is mapped to the walk button but it does nothing
		const isInverted = gamemode !== Gamemode.AHOP;
		const walkInput = isInverted ? Button.SPEED : Button.WALK;
		const sprintInput = isInverted ? Button.WALK : Button.SPEED;

		const entries = [
			{ text: labels.jump, input: Button.JUMP, configKey: 'jump' },
			{ text: labels.duck, input: Button.DUCK, configKey: 'duck' },
			{ text: labels.walk, input: walkInput, configKey: 'walk' },
			{ text: labels.sprint, input: sprintInput, configKey: 'sprint' }
		];

		return entries.filter(({ configKey }) => enabled[configKey]);
	}
}
