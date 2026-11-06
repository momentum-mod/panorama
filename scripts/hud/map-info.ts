import { PanelHandler } from 'util/module-helpers';
import { getNumBonuses, getNumStages } from 'common/leaderboard';
import { getAuthorNames, getTier } from '../common/maps';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { getTextShadowFast } from 'common/hud-customizer';

@PanelHandler()
class HudMapInfoHandler {
	readonly panels = {
		cachedInfoContainer: $<Panel>('#CachedInfoContainer'),
		mapInfoLabel: $<Label>('#MapInfoLabel'),
		bonusInfoLabel: $<Label>('#BonusInfoLabel')
	};

	mapTypeText: string;
	showTiers = true;
	showMapType = true;
	showBonuses = false;
	showReleaseYear = true;
	authorNames = '';
	releaseYear = '';
	numBonuses?: number;

	constructor() {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', (mapName: string) => this.onOfficialMapLoad(mapName));

		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Map_Info_Name'),
			resizeX: true,
			resizeY: false,
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
					targetPanel: '.hud-map-info__label',
					styleProperty: 'fontFamily',
					valueFn: (value) => `"${value}"`
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.hud-map-info__label',
					styleProperty: 'fontSize'
				},
				fontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.hud-map-info__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) =>
						(panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9))
				},
				showLabels: {
					name: $.Localize('#Customizer_ShowLabels'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'showVersion' },
						{ styleID: 'showMapName' },
						{ styleID: 'showAuthors' },
						{ styleID: 'showTier' },
						{ styleID: 'showMapType' },
						{ styleID: 'showBonuses' }
					]
				},
				showVersion: {
					name: $.Localize('#Customizer_Map_Info_ShowVersion'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#VersionLabel',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showMapName: {
					name: $.Localize('#Customizer_Map_Info_ShowMapName'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#MapNameLabel',
					children: { styleID: 'showGamemode', showWhen: true },
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showGamemode: {
					name: $.Localize('#Customizer_Map_Info_ShowGamemode'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#MapNameLabel',
					callbackFunc: (panel, value) => {
						const label = panel as Label;
						if (value) label.SetTextWithDialogVariables('{s:mapname} ({s:gamemode})');
						if (!value) label.SetTextWithDialogVariables('{s:mapname}');
					}
				},
				showAuthors: {
					name: $.Localize('#Customizer_Map_Info_ShowAuthors'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#AuthorLabel',
					children: { styleID: 'showReleaseYear', showWhen: true },
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showReleaseYear: {
					name: $.Localize('#Customizer_Map_Info_ShowReleaseYear'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.showReleaseYear = value),
					onChanged: () => this.constructAuthorString()
				},
				showTier: {
					name: $.Localize('#Customizer_Map_Info_ShowTier'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.showTiers = value),
					onChanged: () => this.constructString()
				},
				showMapType: {
					name: $.Localize('#Customizer_Map_Info_ShowMapType'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.showMapType = value),
					onChanged: () => this.constructString()
				},
				showBonuses: {
					name: $.Localize('#Customizer_Map_Info_ShowBonuses'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.showBonuses = value),
					onChanged: () => this.constructBonusString()
				},
				gap: {
					name: $.Localize('#Customizer_Gap'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.hud-map-info__label',
					styleProperty: 'marginBottom',
					valueFn: (value) => `${value}px`
				},
				alignText: {
					name: $.Localize('#Customizer_AlignText'),
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'Left', value: 'left' },
						{ label: 'Center', value: 'center' },
						{ label: 'Right', value: 'right' }
					],
					targetPanel: ['.hud-map-info__label', '#CachedInfoContainer'],
					styleProperty: 'horizontalAlign'
				}
			},
			postInit: () => {
				this.constructAuthorString();
				this.constructString();
				this.constructBonusString();
			}
		});
	}

	constructAuthorString() {
		const authorString =
			this.showReleaseYear && this.releaseYear ? `${this.authorNames} (${this.releaseYear})` : this.authorNames;
		$.GetContextPanel().SetDialogVariable('author', authorString);
	}

	constructString() {
		const mapInfoString = [];
		if (this.showTiers) mapInfoString.push($.Localize('#MapInfo_Tier', this.panels.mapInfoLabel));
		if (this.showMapType) mapInfoString.push(this.mapTypeText);
		this.panels.mapInfoLabel.text = mapInfoString.join(' - ');
	}

	constructBonusString() {
		if (!this.showBonuses || this.numBonuses === undefined || this.numBonuses <= 0) {
			this.panels.bonusInfoLabel.text = '';
			this.panels.bonusInfoLabel.SetHasClass('hide', true);
			return;
		}

		const token = this.numBonuses === 1 ? '#MapInfo_BonusCount' : '#MapInfo_BonusesCount';
		this.panels.bonusInfoLabel.text = $.Localize(token, this.panels.bonusInfoLabel);
		this.panels.bonusInfoLabel.SetHasClass('hide', false);
	}

	onOfficialMapLoad(mapName: string) {
		if (!mapName) return;

		const cp = $.GetContextPanel();
		cp.SetDialogVariable('mapname', mapName);
		cp.SetDialogVariable('gamemode', $.Localize(GameModeAPI.GetGameModeName(GameModeAPI.GetCurrentGameMode())));
		cp.SetDialogVariable('version', MomentumAPI.GetVersionInfo());

		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.panels.cachedInfoContainer.visible = true;

			const rawDate = mapData.staticData.info?.creationDate ?? mapData.staticData.info?.approvedDate;
			this.releaseYear =
				rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate).getUTCFullYear().toString() : '';

			this.authorNames = getAuthorNames(mapData.staticData);

			const mainTrackTier = getTier(mapData.staticData, GameModeAPI.GetCurrentGameMode());
			const numStages = getNumStages(mapData.staticData);
			const isLinear = numStages <= 1;

			cp.SetDialogVariableInt('tier', mainTrackTier ?? 0);
			cp.SetDialogVariableInt('stageCount', numStages);

			this.mapTypeText = isLinear
				? $.Localize('#MapInfo_Type_Linear')
				: $.Localize('#MapInfo_StageCount', this.panels.mapInfoLabel);
			this.numBonuses = getNumBonuses(mapData.staticData);
			cp.SetDialogVariableInt('bonusCount', this.numBonuses);

			this.constructAuthorString();
			this.constructString();
			this.constructBonusString();
		} else {
			this.panels.cachedInfoContainer.visible = false;
		}
	}
}
