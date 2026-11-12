import { PanelHandler } from 'util/module-helpers';
import { EndOfRunShowReason, RunMetadata } from 'common/timer';
import { GamemodeInfo } from 'common/gamemode';
import { MapUserCompletions, SimpleMapCredit, getAllCredits } from 'common/maps';
import { MapCreditType } from 'common/web/enums/map-credit-type.enum';
import { MapStatuses } from 'common/web/enums/map-status.enum';
import { Style } from 'common/web/enums/style.enum';
import { registerHUDCustomizerComponent } from 'common/hud-customizer';
import { TrackType } from 'common/web/enums/track-type.enum';
import { getRunStyleName } from 'common/style';

/** Most map authors listed in the end of run header before the list is cut off with an ellipsis. */
const MAX_HEADER_AUTHORS = 3;

/**
 * Class for the HUD tab menu panel, which contains the leaderboards, end of run, and zoning.
 */
@PanelHandler()
class HudTabMenuHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTabMenu>(),
		endOfRunContainer: $<Panel>('#EndOfRunContainer'),
		endOfRunHeader: $<Panel>('#EndOfRunHeader'),
		endOfRunAuthors: $<Panel>('#EndOfRunAuthors'),
		endOfRunPlayer: $<Panel>('#EndOfRunPlayer'),
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
	private mapName = '';
	private mapAuthors: SimpleMapCredit[] = [];

	constructor() {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.setMapData(isOfficial));
		$.RegisterForUnhandledEvent('HudTabMenu_ForceClose', () => this.close());
		$.RegisterForUnhandledEvent('EndOfRun_Show', (reason) => this.openEndOfRun(reason));
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunFinish', (run) => this.onRunFinished(run));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', () => this.hideEndOfRun());
		$.RegisterForUnhandledEvent('ActiveZoneDefsChanged', () => this.onActiveZoneDefsChanged());
		$.RegisterForUnhandledEvent('MapCache_MapLoad', (mapName) => this.onMapLoad(mapName));
		$.RegisterForUnhandledEvent('HudTabMenu_Opened', () => this.onOpened());
		$.RegisterForUnhandledEvent('MapCache_CompletionsUpdate', (completions) =>
			this.onCompletionsUpdate(completions)
		);

		$.RegisterForUnhandledEvent('SteamLobby_Enter', () => this.updatePlayerListVisibility());
		$.RegisterForUnhandledEvent('SteamLobby_Exit', () => this.updatePlayerListVisibility());
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberStateChanged', () =>
			this.updatePlayerListVisibility()
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

		this.updatePlayerListVisibility();
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
		this.mapName = mapData?.staticData.name ?? mapName;
		this.mapAuthors = mapData ? getAllCredits(mapData.staticData, MapCreditType.AUTHOR) : [];

		const blur: HudBlurTarget = this.panels.cp.GetParent().GetParent().FindChild('HudBlur');

		this.components.trackSelector.handler.setBlurPanel(blur);
		blur.AddBlurPanel(this.components.styleSelector);
		blur.AddBlurPanel(this.components.leaderboards);
		blur.AddBlurPanel(this.components.playerList.GetFirstChild());
		blur.AddBlurPanel(this.panels.endOfRunHeader);
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
		this.components.trackSelector.handler.updateEorButtonVisibility();

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

	updatePlayerListVisibility() {
		const isEmpty = SteamLobbyAPI.GetCurrentLobbyMemberCount() <= 1;
		this.panels.playerListContainer.visible = !isEmpty;
		this.panels.tabMenuCenter.SetHasClass('tab-menu-center--no-playerlist', isEmpty);
	}

	openEndOfRun(
		reason: EndOfRunShowReason,
		trackInfo?: { trackStyle: Style; trackType: TrackType; trackNum: number }
	) {
		if (reason === EndOfRunShowReason.PLAYER_FINISHED_RUN) {
			this.endOfRunAvailable = true;
			const status = MomentumTimerAPI.GetObservedTimerStatus();
			this.setEndOfRunHeader(status.style, status.trackId.type, status.trackId.number);
		} else {
			this.setEndOfRunHeader(trackInfo.trackStyle, trackInfo.trackType, trackInfo.trackNum);
			this.components.endOfRun.handler.generateCachedEOR(
				trackInfo.trackStyle,
				trackInfo.trackType,
				trackInfo.trackNum
			);
			this.setEndOfRunPlayer(this.components.endOfRun.handler.baseRun);
		}

		this.panels.centerMainContainer.AddClass('hide');
		this.panels.nameContainer.AddClass('hide');
		this.panels.endOfRunContainer.RemoveClass('hide');
	}

	private onRunFinished(run: RunMetadata) {
		this.setEndOfRunPlayer(run);
	}

	private setEndOfRunPlayer(run?: RunMetadata | null) {
		const steamID = HudTabMenuHandler.resolveSteamID(run?.playerSteamId);
		this.populateLinkedRow(this.panels.endOfRunPlayer, '#Common_RunBy', 'player', [
			{ alias: run?.playerName ?? '', steamID }
		]);
	}

	/**
	 * Run metadata types playerSteamId as a number, which can't hold a SteamID64 exactly (rounds to a different
	 * profile). Handle every shape it could actually arrive in: an exact string (what Panorama returns for uint64s),
	 * a 32-bit account ID, or a rounded double belonging to the local player (whose exact ID we can get).
	 * TODO: Remove once the engine sends playerSteamId as an exact string.
	 */
	private static resolveSteamID(raw: string | number | undefined): steamID | undefined {
		if (!raw) return undefined;

		if (typeof raw === 'string') return /^\d{15,}$/.test(raw) ? raw : undefined;

		const local = UserAPI.GetXUID();
		if (raw === Number(local)) return local;

		if (Number.isSafeInteger(raw) && raw > 0 && raw < 2 ** 32) {
			// SteamID64 = 76561197960265728 + accountID, done in two decimal halves to avoid precision loss
			const low = 960265728 + raw;
			const high = 76561197 + Math.floor(low / 1e9);
			return `${high}${String(low % 1e9).padStart(9, '0')}`;
		}

		return undefined;
	}

	private populateAuthors() {
		this.populateLinkedRow(
			this.panels.endOfRunAuthors,
			'#MapInfo_Author',
			'author',
			this.mapAuthors.slice(0, MAX_HEADER_AUTHORS),
			// Too many authors would push the row over the map name, so cut it off
			this.mapAuthors.length > MAX_HEADER_AUTHORS
		);
	}

	/**
	 * Fills a container with a localized row like "By <name>, <name>", where each name with a Steam ID is clickable
	 * and opens their Steam profile. The localized string is split around a marker so the surrounding text stays
	 * translatable.
	 */
	private populateLinkedRow(
		container: Panel,
		token: string,
		variable: string,
		entries: SimpleMapCredit[],
		truncated = false
	) {
		container.RemoveAndDeleteChildren();

		const header = this.panels.endOfRunHeader;
		const marker = '\u0001';
		header.SetDialogVariable(variable, marker);
		const [prefix, suffix] = $.Localize(token, header).split(marker);

		const textClass = 'tab-menu-endofrun__info-text';
		const addLabel = (text: string, classes = '') =>
			$.CreatePanel('Label', container, '', { text, class: `${textClass} ${classes}`.trim() });

		// Names carry their own left margin, so drop any trailing space from the localized text
		if (prefix.trim()) addLabel(prefix.trimEnd());

		entries.forEach(({ alias, steamID }, i) => {
			const label = addLabel(alias, `${textClass}--name ${textClass}--truncate`);
			if (steamID) {
				label.RemoveClass(`${textClass}--name`);
				label.AddClass(`${textClass}--steam`);
				label.SetPanelEvent('onactivate', () => SteamOverlayAPI.OpenToProfileID(steamID));
			}
			if (i < entries.length - 1) addLabel(',');
		});

		if (truncated) {
			addLabel(',');
			addLabel('…', `${textClass}--name`);
		}
		if (suffix?.trim()) addLabel(suffix.trimStart());
	}

	private setEndOfRunHeader(style: Style, trackType: TrackType, trackNum: number) {
		let track: string;
		switch (trackType) {
			case TrackType.STAGE:
				track = `${$.Localize('#Leaderboards_Tracks_Stage')} ${trackNum}`;
				break;
			case TrackType.BONUS:
				track = `${$.Localize('#Leaderboards_Tracks_Bonus')} ${trackNum}`;
				break;
			default:
				track = $.Localize('#TrackSelector_Main');
		}

		const header = this.panels.endOfRunHeader;
		header.SetDialogVariable('eor_map', this.mapName);
		header.SetDialogVariable('eor_track', track);
		this.populateAuthors();
		header.SetDialogVariable('eor_style', $.Localize(getRunStyleName(style)));
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
