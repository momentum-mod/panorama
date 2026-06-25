import { PanelHandler } from 'util/module-helpers';
import { EndOfRunShowReason } from 'common/timer';
import { GamemodeInfo } from 'common/gamemode';
import { MapCreditType } from 'common/web/enums/map-credit-type.enum';
import type { MMap } from 'common/web/types/models/models';
import { getNumStages } from 'common/leaderboard';
import { getAllCredits, getTier, MapUserCompletions, SimpleMapCredit } from 'common/maps';
import { MapStatuses } from 'common/web/enums/map-status.enum';
import { Style } from 'common/web/enums/style.enum';

import { registerHUDCustomizerComponent } from 'common/hud-customizer';

/**
 * Class for the HUD tab menu panel, which contains the leaderboards, end of run, and zoning.
 */
@PanelHandler()
class HudTabMenuHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTabMenu>(),
		sidebysideContainer: $<Panel>('#SideBySideContainer'),
		endOfRunContainer: $<Panel>('#EndOfRunContainer'),
		nameContainer: $<Panel>('#NameContainer'),
		playerListContainer: $<Panel>('#TabMenuPlayerListContainer'),
		tabMenuCenter: $<Panel>('#TabMenuCenter'),
		centerMainContainer: $<Panel>('#CenterMainContainer'),
		endOfRunFrame: $<Frame>('#EndOfRunFrame'),
		zoningOpen: $<Button>('#ZoningOpen'),
		zoningClose: $<Button>('#ZoningClose'),
		gamemodeIcon: $<Image>('#HudTabMenuGamemodeImage'),
		credits: $<Panel>('#HudTabMenuMapCredits'),
		linearSeparator: $<Label>('#HudTabMenuLinearSeparator'),
		linearLabel: $<Label>('#HudTabMenuLinearLabel'),
		stageCountSeparator: $<Panel>('#HudTabMenuStageCountSeparator'),
		stageCountLabel: $<Label>('#HudTabMenuStageCountLabel'),
		betaInfoContainer: $<Panel>('#BetaInfoContainer'),
		leaderboards: $<Leaderboards>('#HudLeaderboards')
	};

	readonly components = {
		trackSelector: $<TrackSelector>('#HudTrackSelector'),
		leaderboards: $<Leaderboards>('#HudLeaderboards'),
		playerList: $<Panel>('#PlayerList')
	};

	constructor() {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.setMapData(isOfficial));
		$.RegisterForUnhandledEvent('HudTabMenu_ForceClose', () => this.close());
		$.RegisterForUnhandledEvent('EndOfRun_Show', (reason) => this.showEndOfRun(reason));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', () => this.hideEndOfRun());
		$.RegisterForUnhandledEvent('ActiveZoneDefsChanged', () => this.updateMapStats());
		$.RegisterForUnhandledEvent('MapCache_MapLoad', () => this.onMapLoad());
		$.RegisterForUnhandledEvent('Drawer_UpdateLobbyButton', (_, playerCount) =>
			this.updatePlayerListVisibility(playerCount <= 1)
		);

		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Tab_Menu_Name'),
			resizeX: false,
			resizeY: false,
			moveX: false,
			moveY: false,
			canDisable: false,
			dynamicStyles: {}
		});

		this.updatePlayerListVisibility(true);
	}

	openInSteamOverlay() {
		const mapData = MapCacheAPI.GetCurrentMapData();
		const frontendUrl = GameInterfaceAPI.GetSettingString('mom_api_url_frontend');
		if (mapData && frontendUrl) {
			SteamOverlayAPI.OpenURL(`${frontendUrl}/maps/${mapData.staticData.name}`);
		}
	}

	onMapLoad() {
		const mapData = MapCacheAPI.GetCurrentMapData();
		if (!mapData) return;

		this.panels.nameContainer.SetDialogVariable('name', mapData.staticData.name);

		const gamemode = GameModeAPI.GetCurrentGameMode();

		const blur: HudBlurTarget = this.panels.cp.GetParent().GetParent().FindChild('HudBlur');

		// TEMPORARY MOCK DATA
		const completions: MapUserCompletions = {
			mapID: mapData.staticData.id,
			gamemode: gamemode,
			style: Style.NORMAL,
			tracks: [
				// trackType: 0 (1 item)
				{ trackType: 0, trackNum: 1, tier: 2, totalCompletions: 6909, time: null, rank: null, group: 0 },

				// trackType: 1 (10 items)
				{ trackType: 1, trackNum: 1, tier: 0, totalCompletions: 10664, time: null, rank: null, group: 1 },
				{ trackType: 1, trackNum: 2, tier: 0, totalCompletions: 10167, time: null, rank: null, group: 2 },
				{ trackType: 1, trackNum: 3, tier: 0, totalCompletions: 9825, time: null, rank: 9819, group: 3 },
				{ trackType: 1, trackNum: 4, tier: 0, totalCompletions: 9745, time: null, rank: null, group: 4 },
				{ trackType: 1, trackNum: 5, tier: 0, totalCompletions: 8640, time: null, rank: 8623, group: 5 },
				{ trackType: 1, trackNum: 6, tier: 0, totalCompletions: 8336, time: null, rank: 1867, group: 5 },
				{ trackType: 1, trackNum: 7, tier: 0, totalCompletions: 6969, time: null, rank: 1115, group: 5 },
				{ trackType: 1, trackNum: 8, tier: 1, totalCompletions: 42069, time: null, rank: 420, group: 0 },
				{ trackType: 1, trackNum: 9, tier: 2, totalCompletions: 80085, time: null, rank: 69, group: 1 },
				{ trackType: 1, trackNum: 10, tier: 3, totalCompletions: 1337, time: null, rank: null, group: 2 },

				// trackType: 2 (10 items)
				{ trackType: 2, trackNum: 1, tier: 0, totalCompletions: 69420, time: null, rank: null, group: 3 },
				{ trackType: 2, trackNum: 2, tier: 1, totalCompletions: 9001, time: null, rank: 1337, group: 4 },
				{ trackType: 2, trackNum: 3, tier: 2, totalCompletions: 8008, time: null, rank: null, group: 5 },
				{ trackType: 2, trackNum: 4, tier: 3, totalCompletions: 420, time: null, rank: 69, group: 0 },
				{ trackType: 2, trackNum: 5, tier: 4, totalCompletions: 666, time: null, rank: null, group: 1 },
				{ trackType: 2, trackNum: 6, tier: 5, totalCompletions: 777, time: null, rank: 777, group: 2 },
				{ trackType: 2, trackNum: 7, tier: 0, totalCompletions: 58008, time: null, rank: null, group: 3 },
				{ trackType: 2, trackNum: 8, tier: 1, totalCompletions: 31415, time: null, rank: 42, group: 4 },
				{ trackType: 2, trackNum: 9, tier: 2, totalCompletions: 8675309, time: null, rank: 80085, group: 5 },
				{ trackType: 2, trackNum: 10, tier: 3, totalCompletions: 1337420, time: null, rank: 6969, group: 0 }
			]
		};

		this.components.trackSelector.handler.setBlurPanel(blur);
		blur.AddBlurPanel(this.components.leaderboards);
		blur.AddBlurPanel(this.components.playerList.GetFirstChild());
		blur.AddBlurPanel(this.panels.endOfRunFrame);

		this.components.trackSelector.handler.connectLeaderboards(this.panels.leaderboards);
		this.components.trackSelector.handler.updateMapData(mapData.staticData);
		this.components.trackSelector.handler.updateTrackData(completions);

		this.panels.betaInfoContainer.SetHasClass(
			'hide',
			!MapStatuses.IN_SUBMISSION.includes(mapData.staticData.status)
		);
	}

	updatePlayerListVisibility(isEmpty: boolean) {
		this.panels.playerListContainer.visible = !isEmpty;
		this.panels.tabMenuCenter.SetHasClass('tab-menu-center--no-playerlist', isEmpty);
	}

	showEndOfRun(reason: EndOfRunShowReason) {
		this.panels.centerMainContainer.AddClass('hide');
		this.panels.nameContainer.AddClass('hide');
		this.panels.endOfRunContainer.RemoveClass('hide');
	}

	hideEndOfRun() {
		this.panels.centerMainContainer.RemoveClass('hide');
		this.panels.nameContainer.RemoveClass('hide');
		this.panels.endOfRunContainer.AddClass('hide');
	}

	setMapData(isOfficial: boolean) {
		$.GetContextPanel().SetHasClass('hud-tab-menu--unofficial', !isOfficial);

		const img = GamemodeInfo.get(GameModeAPI.GetCurrentGameMode()).icon;

		this.panels.gamemodeIcon.SetImage(`file://{images}/gamemodes/${img}.svg`);

		const mapData = MapCacheAPI.GetCurrentMapData();

		if (mapData && isOfficial) {
			this.setMapStats(mapData.staticData);
			this.setMapAuthorCredits(getAllCredits(mapData.staticData, MapCreditType.AUTHOR));
		}
	}

	setMapAuthorCredits(credits: SimpleMapCredit[]) {
		// Delete existing name labels
		this.panels.credits.Children()?.forEach((label) => label.DeleteAsync(0));

		if (credits.length === 0) {
			return;
		}

		$.CreatePanel('Label', this.panels.credits, '', {
			class: 'hud-tab-menu-map-info__credits-other-text',
			text: $.Localize('#Common_By')
		});

		for (const [idx, { alias, steamID }] of credits.entries()) {
			const namePanel = $.CreatePanel('Label', this.panels.credits, '', {
				text: alias
			});

			namePanel.AddClass('hud-tab-menu-map-info__credits-name');

			if (steamID) {
				namePanel.AddClass('hud-tab-menu-map-info__credits-name--steam');

				// TODO: Should be an onactivate (left click, not right), and open player card component,
				// once that's made.
				namePanel.SetPanelEvent('oncontextmenu', () => {
					UiToolkitAPI.ShowSimpleContextMenu('', '', [
						{
							label: $.Localize('#Action_ShowSteamProfile'),
							jsCallback: () => {
								SteamOverlayAPI.OpenToProfileID(steamID);
							}
						}
					]);
				});
			}

			// hoped this would make contextmenu work but it doesn't
			if (idx < credits.length - 1) {
				const commaPanel = $.CreatePanel('Label', this.panels.credits, '');
				commaPanel.AddClass('hud-tab-menu-map-info__credits-other-text');
				commaPanel.text = ',';
			}
		}
	}

	updateMapStats() {
		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.setMapStats(mapData.staticData);
		}
	}

	setMapStats(mapData: MMap) {
		this.panels.cp.forceCloseTabMenu();

		const mainTrackTier = getTier(mapData, GameModeAPI.GetCurrentGameMode());
		const numStages = getNumStages(mapData);
		const isLinear = numStages <= 1;

		this.panels.cp.SetDialogVariableInt('tier', mainTrackTier ?? 0);
		this.panels.linearSeparator.visible = isLinear;
		this.panels.linearLabel.visible = isLinear;
		this.panels.stageCountSeparator.visible = !isLinear;
		this.panels.stageCountLabel.visible = !isLinear;
		if (!isLinear) {
			this.panels.cp.SetDialogVariableInt('stageCount', numStages);
		}
		this.panels.cp.SetDialogVariableInt('runs', mapData.stats?.completions);
	}

	close() {
		this.panels.cp.forceCloseTabMenu();
		return true;
	}
}
