import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { getTextShadowFast } from 'common/hud-customizer';

type specConfigType = {
	fontFamily: string;
	fontColor: string;
	fontSize: int32;
	horizontalAlign: 'center' | 'left' | 'right';
	showNameList: boolean;
};

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
		showNameList: true
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
			name: 'Spectators',
			resizeX: true,
			resizeY: false,
			dynamicStyles: {
				showNameList: {
					name: 'Show Name List',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.specConfig.showNameList = value;
						this.createDummySpectators();
					}
				},
				maxPlayerCount: {
					name: 'Max Player Count',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.maxNames = value;
						this.createDummySpectators();
					},
					settingProps: { min: 0, max: 100 }
				},
				fontStyling: {
					name: 'Font Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: ['.hudspecinfo__count', '.specinfo-list-entry__name'],
					styleProperty: 'fontFamily',
					callbackFunc: (_, value) => {
						this.specConfig.fontFamily = value;
					}
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['.hudspecinfo__count', '.specinfo-list-entry__name'],
					styleProperty: 'fontSize',
					callbackFunc: (_, value) => {
						this.specConfig.fontSize = value;
					}
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: ['.hudspecinfo__count', '.specinfo-list-entry__name'],
					styleProperty: 'color',
					callbackFunc: (_, value) => {
						this.panels.numSpecLabel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9);
						this.specConfig.fontColor = value;
						this.createDummySpectators();
					}
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.hudspecinfo__container',
					styleProperty: 'backgroundColor'
				},
				alignText: {
					name: 'Align Text',
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'Left', value: 'left' },
						{ label: 'Center', value: 'center' },
						{ label: 'Right', value: 'right' }
					],
					targetPanel: ['.hudspecinfo__count', '.specinfo-list-entry'],
					styleProperty: 'horizontalAlign',
					callbackFunc: (_, value) => {
						this.specConfig.horizontalAlign = value as 'center' | 'left' | 'right';
						this.createDummySpectators();
					}
				}
			}
		});
	}

	createDummySpectators() {
		$.GetContextPanel().SetDialogVariableInt('numspec', this.maxNames);
		this.panels.namesContainer.RemoveAndDeleteChildren();
		this.panels.container.visible = true;

		if (!this.specConfig.showNameList) return;

		for (let i = 0; i < this.maxNames; i++) {
			this.createSpecNameLabel(`Player ${i + 1}`);
		}
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

		if (!this.specConfig.showNameList) return;
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
		nameLabel.style.fontFamily = this.specConfig.fontFamily;
		nameLabel.style.color = this.specConfig.fontColor as rgbaColor;
		nameLabel.style.textShadowFast = getTextShadowFast(this.specConfig.fontColor as rgbaColor, 0.9);
		nameLabel.style.fontSize = `${this.specConfig.fontSize}px`;
		nameLabel.style.horizontalAlign = this.specConfig.horizontalAlign;
	}
}
