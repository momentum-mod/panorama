import { PanelHandler } from 'util/module-helpers';
import { EndOfRunShowReason } from 'common/timer';
import { GamemodeInfo } from 'common/gamemode';
import { MapUserCompletions } from 'common/maps';
import { MapStatuses } from 'common/web/enums/map-status.enum';
import { Style } from 'common/web/enums/style.enum';
import { registerHUDCustomizerComponent } from 'common/hud-customizer';
import { TrackType } from 'common/web/enums/track-type.enum';

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
		gamemodeIcon: $<Image>('#HudTabMenuGamemodeImage'),
		leaderboards: $<Leaderboards>('#HudLeaderboards'),
		betaInfoContainer: $<Panel>('#BetaInfoContainer')
	};

	readonly components = {
		trackSelector: $<TrackSelector>('#HudTrackSelector'),
		styleSelector: $<StyleSelector>('#HudStyleSelector'),
		leaderboards: $<Leaderboards>('#HudLeaderboards'),
		playerList: $<Panel>('#PlayerList'),
		endOfRun: $<EndOfRun>('#TabMenuEndOfRun')
	};

	endOfRunAvailable = false;

	constructor() {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.setMapData(isOfficial));
		$.RegisterForUnhandledEvent('HudTabMenu_ForceClose', () => this.close());
		$.RegisterForUnhandledEvent('EndOfRun_Show', (reason) => this.openEndOfRun(reason));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', () => this.hideEndOfRun());
		$.RegisterForUnhandledEvent('ActiveZoneDefsChanged', () => this.onActiveZoneDefsChanged());
		$.RegisterForUnhandledEvent('MapCache_MapLoad', (mapName) => this.onMapLoad(mapName));
		$.RegisterForUnhandledEvent('HudTabMenu_Opened', () => this.onOpened());
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
		this.components.endOfRun.handler.connectTrackSelector(this.components.trackSelector);
		this.components.trackSelector.handler.connectEndOfRun(this.components.endOfRun);

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
		blur.AddBlurPanel(this.components.endOfRun.GetFirstChild());

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
		this.components.trackSelector.handler.endOfRunCallback = (
			trackStyle: Style,
			trackType: TrackType,
			trackNum: number
		) => this.openEndOfRun(EndOfRunShowReason.MANUALLY_SHOWN, { trackStyle, trackType, trackNum });

		this.components.styleSelector.handler.connectTrackSelector(this.components.trackSelector);

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

	/**
	 * Pull the freshest per-track rank/total for the completion table whenever the menu is opened,
	 * in the style currently selected. Cooldown-gated inside RefreshCompletions, so opening the tab
	 * menu often is cheap.
	 */
	onOpened() {
		const mapData = MapCacheAPI.GetCurrentMapData();
		if (!mapData) return;

		const mapID = mapData.staticData.id;
		const gamemode = GameModeAPI.GetCurrentGameMode();
		const style = this.components.styleSelector.handler.style;

		MapCacheAPI.RefreshCompletions(mapID, gamemode, style);
		// Also (re)try loading PB times - no-op once fetched, so this just covers a console-loaded
		// map whose initial map-load fetch hasn't succeeded yet.
		MapCacheAPI.RefreshUserPersonalBests(mapID, gamemode, style);
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

	openEndOfRun(
		reason: EndOfRunShowReason,
		trackInfo?: { trackStyle: Style; trackType: TrackType; trackNum: number }
	) {
		if (reason === EndOfRunShowReason.PLAYER_FINISHED_RUN) {
			this.endOfRunAvailable = true;
		} else {
			this.components.endOfRun.handler.generateCachedEOR(
				trackInfo.trackStyle,
				trackInfo.trackType,
				trackInfo.trackNum
			);
		}

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
	}

	close() {
		this.panels.cp.forceCloseTabMenu();
		return true;
	}
}
