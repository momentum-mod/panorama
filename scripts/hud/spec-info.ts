import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { getTextShadowFast } from 'common/hud-customizer';

type specConfigType = {
	fontFamily: string;
	fontColor: string;
	fontSize: int32;
	horizontalAlign: 'center' | 'left' | 'right';
	labelOptions: labelOptions;
};

enum labelOptions {
	numberAndList = 'numberAndList',
	number = 'number',
	list = 'list'
}

@PanelHandler()
class HudSpecInfoHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<MomHudSpecInfo>(),
		container: $<Panel>('#SpecInfoContainer'),
		namesContainer: $<Panel>('#NamesContainer'),
		numSpecLabel: $<Label>('#NumSpecLabel')
	};

	maxNames = 10;
	dummySpectatorsEnabled = false;

	// Needs to be initialized to any values, they immediately get overridden. Set defaults in /cfg/hud_default.kv3
	specConfig = {
		fontFamily: 'Roboto',
		fontSize: 20,
		fontColor: 'rgba(255, 255, 255, 1)',
		horizontalAlign: 'right',
		labelOptions: 'numberAndList'
	} as specConfigType;

	constructor() {
		$.RegisterForUnhandledEvent('ObserverTargetChanged', () => this.onSpectatorChanged());
		$.RegisterForUnhandledEvent('MomentumSpectatorUpdate', () => this.onSpectatorChanged());
		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => this.onSpectatorChanged());

		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => {
			this.dummySpectatorsEnabled = true;
			this.createDummySpectators();
		});
		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => {
			this.dummySpectatorsEnabled = false;
			this.onSpectatorChanged();
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Spec_Info_Name'),
			resizeX: true,
			resizeY: false,
			dynamicStyles: {
				showLabels: {
					name: $.Localize('#Customizer_ShowLabels'),
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'Number and List', value: labelOptions.numberAndList },
						{ label: 'Number', value: labelOptions.number },
						{ label: 'List', value: labelOptions.list }
					],
					children: { styleID: 'maxPlayerCount', showWhen: ['numberAndList', 'list'] },
					callbackFunc: (_, value) => (this.specConfig.labelOptions = value as labelOptions),
					onChanged: () => this.createDummySpectators()
				},
				maxPlayerCount: {
					name: $.Localize('#Customizer_Spec_Info_MaxPlayerCount'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (this.maxNames = value),
					onChanged: () => this.createDummySpectators(),
					settingProps: { min: 0, max: 100 }
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
					targetPanel: ['.hudspecinfo__count', '.specinfo-list-entry__name'],
					styleProperty: 'fontFamily',
					callbackFunc: (_, value) => (this.specConfig.fontFamily = value),
					valueFn: (value) => `"${value}"`
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['.hudspecinfo__count', '.specinfo-list-entry__name'],
					styleProperty: 'fontSize',
					callbackFunc: (_, value) => (this.specConfig.fontSize = value)
				},
				fontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: ['.hudspecinfo__count', '.specinfo-list-entry__name'],
					styleProperty: 'color',
					callbackFunc: (_, value) => {
						this.panels.numSpecLabel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9);
						this.specConfig.fontColor = value;
					},
					onChanged: () => this.createDummySpectators()
				},
				backgroundColor: {
					name: $.Localize('#Customizer_BackgroundColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.hudspecinfo__container',
					styleProperty: 'backgroundColor'
				},
				alignText: {
					name: $.Localize('#Customizer_AlignText'),
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'Left', value: 'left' },
						{ label: 'Center', value: 'center' },
						{ label: 'Right', value: 'right' }
					],
					targetPanel: ['.hudspecinfo__count', '.specinfo-list-entry'],
					styleProperty: 'horizontalAlign',
					callbackFunc: (_, value) =>
						(this.specConfig.horizontalAlign = value as 'center' | 'left' | 'right'),
					onChanged: () => this.createDummySpectators()
				}
			}
		});
	}

	createDummySpectators() {
		this.panels.namesContainer.RemoveAndDeleteChildren();
		$.GetContextPanel().SetDialogVariableInt('numspec', this.maxNames);

		this.panels.container.visible = true;

		if (this.specConfig.labelOptions === 'list') {
			this.panels.numSpecLabel.visible = false;
		} else {
			this.panels.numSpecLabel.visible = true;
		}

		if (this.specConfig.labelOptions === 'number') return;

		for (let i = 0; i < this.maxNames; i++) {
			this.createSpecNameLabel(`Player ${i + 1}`);
		}

		this.createSpecNameLabel('...');
	}

	onPanelLoad() {
		this.panels.cp.SetDialogVariableInt('numspec', 0);
		this.panels.container.visible = false;
	}

	onSpectatorChanged() {
		if (this.dummySpectatorsEnabled) return;

		const specList = SpectatorAPI.GetSpecList();

		const specCount = specList.length;
		if (specCount > 0) {
			this.panels.container.visible = true;
			$.GetContextPanel().SetDialogVariableInt('numspec', specCount);
		} else this.panels.container.visible = false;

		if (this.specConfig.labelOptions === 'list') {
			this.panels.numSpecLabel.visible = false;
		} else {
			this.panels.numSpecLabel.visible = true;
		}

		if (this.specConfig.labelOptions === 'number') return;
		// 0 max names means there is no max
		const maxDisplayNames = this.maxNames > specCount || this.maxNames === 0 ? specCount : this.maxNames;

		this.panels.namesContainer.RemoveAndDeleteChildren();
		for (let i = 0; i < maxDisplayNames; i++) {
			const steamID = specList[i];
			const friendlyName = FriendsAPI.GetNameForXUID(steamID);
			// perhaps display more info than just the friendly name

			this.createSpecNameLabel(friendlyName);
		}

		// full list was truncated so make that apparent
		if (maxDisplayNames < specCount) {
			this.createSpecNameLabel('...');
		}
	}

	createSpecNameLabel(text: string) {
		const snippetCont = $.CreatePanel('Panel', this.panels.namesContainer, '');
		snippetCont.LoadLayoutSnippet('specinfo-list-entry');
		snippetCont.style.horizontalAlign = this.specConfig.horizontalAlign;

		const nameLabel = snippetCont.FindChildInLayoutFile<Label>('FriendlySpecName');
		nameLabel.text = text;
		nameLabel.style.fontFamily = `"${this.specConfig.fontFamily}"`;
		nameLabel.style.color = this.specConfig.fontColor as rgbaColor;
		nameLabel.style.textShadowFast = getTextShadowFast(this.specConfig.fontColor as rgbaColor, 0.9);
		nameLabel.style.fontSize = `${this.specConfig.fontSize}px`;
		nameLabel.style.horizontalAlign = this.specConfig.horizontalAlign;
	}
}
