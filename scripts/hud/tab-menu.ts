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
		endOfRunContainer: $<Panel>('#EndOfRunContainer'),
		nameContainer: $<Panel>('#NameContainer'),
		playerListContainer: $<Panel>('#TabMenuPlayerListContainer'),
		tabMenuCenter: $<Panel>('#TabMenuCenter'),
		centerMainContainer: $<Panel>('#CenterMainContainer'),
		endOfRunFrame: $<Frame>('#EndOfRunFrame'),
		endOfRunButton: $<Button>('#EndOfRunButton'),
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
		styleSelector: $<StyleSelector>('#HudStyleSelector'),
		leaderboards: $<Leaderboards>('#HudLeaderboards'),
		playerList: $<Panel>('#PlayerList')
	};

	endOfRunAvailable = false;

	constructor() {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.setMapData(isOfficial));
		$.RegisterForUnhandledEvent('HudTabMenu_ForceClose', () => this.close());
		$.RegisterForUnhandledEvent('EndOfRun_Show', (reason) => this.showEndOfRun(reason));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', () => this.hideEndOfRun());
		$.RegisterForUnhandledEvent('ActiveZoneDefsChanged', () => this.onActiveZoneDefsChanged());
		$.RegisterForUnhandledEvent('MapCache_MapLoad', (mapName) => this.onMapLoad(mapName));
		$.RegisterForUnhandledEvent('MapCache_CompletionsUpdate', (completions) =>
			this.onCompletionsUpdate(completions)
		);
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

		this.components.styleSelector.handler.setStyleChangedCallback((style) => this.onStyleSelected(style));

		// The leaderboard layout is shared with the map selector, which has no use for the zone
		// editor or HUD customizer, so those buttons are only available for the in-game tab menu version.
		this.panels.leaderboards.handler.setToolsAvailable(true);

		this.updatePlayerListVisibility(true);
	}

	openInSteamOverlay() {
		const mapData = MapCacheAPI.GetCurrentMapData();
		const frontendUrl = GameInterfaceAPI.GetSettingString('mom_api_url_frontend');
		if (mapData && frontendUrl) {
			SteamOverlayAPI.OpenURL(`${frontendUrl}/maps/${mapData.staticData.name}`);
		}
	}

	onMapLoad(mapName: string) {
		const mapData = MapCacheAPI.GetCurrentMapData();

		const blur: HudBlurTarget = this.panels.cp.GetParent().GetParent().FindChild('HudBlur');

		this.components.trackSelector.handler.setBlurPanel(blur);
		blur.AddBlurPanel(this.components.styleSelector);
		blur.AddBlurPanel(this.components.leaderboards);
		blur.AddBlurPanel(this.components.playerList.GetFirstChild());
		blur.AddBlurPanel(this.panels.endOfRunFrame);

		this.components.trackSelector.handler.connectLeaderboards(this.panels.leaderboards);
		this.components.trackSelector.handler.connectStyleSelector(this.components.styleSelector);

		// Styles are per-gamemode, so the selector rebuilds (and resets to the mode's default style)
		// whenever the mode changes. Otherwise it keeps whatever the user last picked.
		this.components.styleSelector.handler.setGamemode(GameModeAPI.GetCurrentGameMode());
		this.panels.leaderboards.handler.setStyle(this.components.styleSelector.handler.style);

		// An offline map: nothing online exists for it, so drive the selector off its local zones.
		if (!mapData) {
			this.panels.nameContainer.SetDialogVariable('name', mapName);
			this.panels.betaInfoContainer.AddClass('hide');
			this.components.trackSelector.handler.updateLocalTrackData(this.components.styleSelector.handler.style);
			return;
		}

		this.panels.nameContainer.SetDialogVariable('name', mapData.staticData.name);

		const gamemode = GameModeAPI.GetCurrentGameMode();

		this.components.trackSelector.handler.updateMapData(mapData.staticData);

		// Render the cached completions immediately, then refresh from online if stale. Updated data
		// (a late fetch, or a new PB patched by the run poster) arrives via MapCache_CompletionsUpdate.
		const style = this.components.styleSelector.handler.style;
		this.components.trackSelector.handler.updateTrackData(
			MapCacheAPI.GetCompletions(mapData.staticData.id, gamemode, style)
		);
		MapCacheAPI.RefreshCompletions(mapData.staticData.id, gamemode, style);
		// Also load PB times, so a map loaded via console (never opened in the map selector) still
		// shows them. No-op if the map selector already fetched them this session.
		MapCacheAPI.RefreshUserPersonalBests(mapData.staticData.id, gamemode, style);

		this.panels.betaInfoContainer.SetHasClass(
			'hide',
			!MapStatuses.IN_SUBMISSION.includes(mapData.staticData.status)
		);
	}

	onCompletionsUpdate(completions: MapUserCompletions) {
		// Fires for every map/mode/style; ignore updates that aren't for what we're showing (the
		// current map in the current mode, in the selected style).
		const mapData = MapCacheAPI.GetCurrentMapData();

		// Offline map: local-replay PBs arrive here too (tagged mapID 0), routed to the local table.
		if (!mapData) {
			this.components.trackSelector.handler.onLocalCompletionsUpdate(completions);
			return;
		}

		if (completions.mapID !== mapData.staticData.id) return;

		if (
			completions.gamemode !== GameModeAPI.GetCurrentGameMode() ||
			completions.style !== this.components.styleSelector.handler.style
		) {
			return;
		}

		this.components.trackSelector.handler.updateTrackData(completions);
	}

	/** Switch the leaderboard, and the tracks' times/ranks, over to a newly picked style. */
	onStyleSelected(style: Style) {
		this.panels.leaderboards.handler.setStyle(style);

		const mapData = MapCacheAPI.GetCurrentMapData();

		// Offline map: PBs are per style, so rebuild the local track table for the new one.
		if (!mapData) {
			this.components.trackSelector.handler.updateLocalTrackData(style);
			return;
		}

		const mapID = mapData.staticData.id;
		const gamemode = GameModeAPI.GetCurrentGameMode();

		this.components.trackSelector.handler.updateTrackData(MapCacheAPI.GetCompletions(mapID, gamemode, style));
		MapCacheAPI.RefreshCompletions(mapID, gamemode, style);
		MapCacheAPI.RefreshUserPersonalBests(mapID, gamemode, style);
	}

	onActiveZoneDefsChanged() {
		this.updateMapStats();

		// An offline map's tracks come from its zones, which can load (or be edited in the zone
		// editor) after the map itself, so rebuild the selector whenever they change.
		if (!MapCacheAPI.GetCurrentMapData()) {
			this.components.trackSelector.handler.updateLocalTrackData(this.components.styleSelector.handler.style);
		}
	}

	updatePlayerListVisibility(isEmpty: boolean) {
		this.panels.playerListContainer.visible = !isEmpty;
		this.panels.tabMenuCenter.SetHasClass('tab-menu-center--no-playerlist', isEmpty);
	}

	openEndOfRun() {
		if (!this.endOfRunAvailable) return;

		this.showEndOfRun(EndOfRunShowReason.MANUALLY_SHOWN);
	}

	showEndOfRun(reason: EndOfRunShowReason) {
		if (reason === EndOfRunShowReason.PLAYER_FINISHED_RUN) {
			this.endOfRunAvailable = true;
		}
		this.panels.centerMainContainer.AddClass('hide');
		this.panels.nameContainer.AddClass('hide');
		this.panels.endOfRunButton.style.opacity = 0.00001;
		this.panels.endOfRunContainer.RemoveClass('hide');
	}

	hideEndOfRun() {
		if (this.endOfRunAvailable) this.panels.endOfRunButton.style.opacity = 1;
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
