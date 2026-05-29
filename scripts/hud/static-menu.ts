import { PanelHandler } from 'util/module-helpers';

import { registerHUDCustomizerComponent, CustomizerPropertyType } from 'common/hud-customizer';

const Config = {
	backgroundColor: '',

	borderWidth: 0,
	borderColor: '',
	borderRadius: 0,

	keybind: {
		font: '',
		fontSize: 0,
		fontColor: '',
		backgroundColor: '',

		borderWidth: 0,
		borderColor: '',
		borderRadius: 0
	},
	description: {
		font: '',
		fontSize: 0,
		fontColor: ''
	}
};

type StaticMenuPanel = {
	keybind: GenericPanel;
	description: GenericPanel;
};

@PanelHandler()
class HudMapInfoHandler {
	readonly panels = {
		cp: $.GetContextPanel(),
		menu: $<Panel>('#StaticHudMenu')
	};

	initEvent: number;
	staticMenuPanels: StaticMenuPanel[] = [];

	constructor() {
		$.RegisterEventHandler('StaticHudMenu_EntrySelected', $.GetContextPanel(), (panel: Panel) => {
			panel.TriggerClass('static-hud-menu__entry--highlight');
		});

		this.initEvent = $.RegisterEventHandler('HudThink', this.panels.cp, () => this.initializeStyles());

		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Static_Menu_Name'),
			resizeX: false,
			resizeY: false,
			canDisable: false,
			dynamicStyles: {
				fontStyling: {
					name: $.Localize('#Customizer_FontStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'keybindFontStyling' }, { styleID: 'descriptionFontStyling' }]
				},
				keybindFontStyling: {
					name: $.Localize('#Customizer_Keybind'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'keybindFont' },
						{ styleID: 'keybindFontSize' },
						{ styleID: 'keybindFontColor' }
					]
				},
				keybindFont: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => (Config.keybind.font = value),
					onChanged: () => this.updateStyles()
				},
				keybindFontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.keybind.fontSize = value),
					onChanged: () => this.updateStyles()
				},
				keybindFontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.keybind.fontColor = value),
					onChanged: () => this.updateStyles()
				},
				descriptionFontStyling: {
					name: $.Localize('#Customizer_Static_Menu_DescriptionFontStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'descriptionFont' },
						{ styleID: 'descriptionFontSize' },
						{ styleID: 'descriptionFontColor' }
					]
				},
				descriptionFont: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => (Config.description.font = value),
					onChanged: () => this.updateStyles()
				},
				descriptionFontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.description.fontSize = value),
					onChanged: () => this.updateStyles()
				},
				descriptionFontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.description.fontColor = value),
					onChanged: () => this.updateStyles()
				},
				colors: {
					name: $.Localize('#Customizer_Colors'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'backgroundColor' }, { styleID: 'keybindBackgroundColor' }]
				},
				backgroundColor: {
					name: $.Localize('#Customizer_BackgroundColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.backgroundColor = value),
					onChanged: () => this.updateStyles()
				},
				keybindBackgroundColor: {
					name: $.Localize('#Customizer_Static_Menu_KeybindBackgroundColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.keybind.backgroundColor = value),
					onChanged: () => this.updateStyles()
				},
				borderStyling: {
					name: $.Localize('#Customizer_BorderStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'mainBorderStyling' }, { styleID: 'keybindBorderStyling' }]
				},
				mainBorderStyling: {
					name: $.Localize('#Customizer_Main'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'borderWidth' }, { styleID: 'borderColor' }, { styleID: 'borderRadius' }]
				},
				borderWidth: {
					name: $.Localize('#Customizer_Width'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.borderWidth = value),
					onChanged: () => this.updateStyles()
				},
				borderColor: {
					name: $.Localize('#Customizer_Color'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.borderColor = value),
					onChanged: () => this.updateStyles()
				},
				borderRadius: {
					name: $.Localize('#Customizer_Static_Menu_BorderRadius'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.borderRadius = value),
					onChanged: () => this.updateStyles()
				},
				keybindBorderStyling: {
					name: $.Localize('#Customizer_Keybind'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'keybindBorderWidth' },
						{ styleID: 'keybindBorderColor' },
						{ styleID: 'keybindBorderRadius' }
					]
				},
				keybindBorderWidth: {
					name: $.Localize('#Customizer_Width'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.keybind.borderWidth = value),
					onChanged: () => this.updateStyles()
				},
				keybindBorderColor: {
					name: $.Localize('#Customizer_Color'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Config.keybind.borderColor = value),
					onChanged: () => this.updateStyles()
				},
				keybindBorderRadius: {
					name: $.Localize('#Customizer_Static_Menu_KeybindBorderRadius'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (Config.keybind.borderRadius = value),
					onChanged: () => this.updateStyles()
				}
			}
		});
	}

	initializeStyles() {
		if (this.panels.cp.GetChildCount() < 10) return;
		$.UnregisterEventHandler('HudThink', this.panels.cp, this.initEvent);

		const children = this.panels.cp.Children();
		for (const child of children) {
			const panels: StaticMenuPanel = {
				keybind: child.FindChild('Keybind'),
				description: child.FindChild('Description')
			};
			this.staticMenuPanels.push(panels);
		}
		this.updateStyles();
	}

	updateStyles() {
		this.panels.cp.style.backgroundColor = Config.backgroundColor as color;
		this.panels.cp.style.borderRadius = `${Config.borderRadius}px`;
		this.panels.cp.style.border = `${Config.borderWidth}px solid ${Config.borderColor}`;

		for (const panels of this.staticMenuPanels) {
			panels.keybind.style.fontFamily = `"${Config.keybind.font}"`;
			panels.description.style.fontFamily = `"${Config.description.font}"`;

			panels.keybind.style.fontSize = `${Config.keybind.fontSize}px`;
			panels.description.style.fontSize = `${Config.description.fontSize}px`;

			panels.keybind.style.color = Config.keybind.fontColor;
			panels.description.style.color = Config.description.fontColor;

			panels.keybind.style.backgroundColor = Config.keybind.backgroundColor as color;

			panels.keybind.style.borderRadius = `${Config.keybind.borderRadius}px`;
			panels.keybind.style.border = `${Config.keybind.borderWidth}px solid ${Config.keybind.borderColor}`;
		}
	}
}
