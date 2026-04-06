import { PanelHandler } from 'util/module-helpers';
import { getNumStages } from 'common/leaderboard';
import { getAuthorNames, getTier } from '../common/maps';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

@PanelHandler()
class HudMapInfoHandler {
	readonly panels = {
		cachedInfoContainer: $<Panel>('#CachedInfoContainer'),
		mapInfoLabel: $<Label>('#MapInfoLabel')
	};

	mapTypeText: string;
	showTiers = true;
	showMapType = true;

	constructor() {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', (mapName: string) => this.onOfficialMapLoad(mapName));

		//TODO: Add generic border styles
		//TODO: Handle variable width? Kinda done, Customizer needs to be able to have minimum width set

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: true,
			resizeY: false,
			dynamicStyles: {
				showVersion: {
					name: 'Show Version',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#VersionLabel',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showMapName: {
					name: 'Show Map Name',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#MapNameLabel',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showGamemode: {
					name: 'Show Gamemode',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#MapNameLabel',
					callbackFunc: (panel, value) => {
						const label = panel as Label;
						if (value) label.SetTextWithDialogVariables('{s:mapname} ({s:gamemode})');
						if (!value) label.SetTextWithDialogVariables('{s:mapname}');
					}
				},
				showAuthors: {
					name: 'Show Authors',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#AuthorLabel',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showTier: {
					name: 'Show Tier',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.showTiers = value;
						this.constructString();
					}
				},
				showMapType: {
					name: 'Show Map Type',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.showMapType = value;
						this.constructString();
					}
				},

				//TODO: Remake this using a proper CustomizerPropertyType when added
				alignText: {
					name: 'Align Text',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['.hud-map-info__label', '#CachedInfoContainer'],
					callbackFunc: (panel, value) => {
						switch (value) {
							case 0:
								panel.style.horizontalAlign = 'left';
								panel.style.textAlign = 'left';
								break;
							case 1:
								panel.style.horizontalAlign = 'center';
								panel.style.textAlign = 'center';
								break;
							case 2:
								panel.style.horizontalAlign = 'right';
								panel.style.textAlign = 'right';
								break;
						}
					},
					settingProps: { min: 0, max: 2 }
				},
				gap: {
					name: 'Gap',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.hud-map-info__label',
					styleProperty: 'marginBottom',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 20 }
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.hud-map-info__label',
					styleProperty: 'fontFamily'
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.hud-map-info__label',
					styleProperty: 'color'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.hud-map-info__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 10, max: 50 }
				}
			}
		});
	}

	constructString() {
		const mapInfoString = [];
		if (this.showTiers) mapInfoString.push($.Localize('#MapInfo_Tier', this.panels.mapInfoLabel));
		if (this.showMapType) mapInfoString.push(this.mapTypeText);
		this.panels.mapInfoLabel.text = mapInfoString.join(' - ');
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

			cp.SetDialogVariable('author', getAuthorNames(mapData.staticData));

			const mainTrackTier = getTier(mapData.staticData, GameModeAPI.GetCurrentGameMode());
			const numStages = getNumStages(mapData.staticData);
			const isLinear = numStages <= 1;

			cp.SetDialogVariableInt('tier', mainTrackTier ?? 0);
			cp.SetDialogVariableInt('stageCount', numStages);

			this.mapTypeText = isLinear
				? $.Localize('#MapInfo_Type_Linear')
				: $.Localize('#MapInfo_StageCount', this.panels.mapInfoLabel);

			this.constructString();
		} else {
			this.panels.cachedInfoContainer.visible = false;
		}
	}
}
