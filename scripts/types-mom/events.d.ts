/**
 * This file is for type definitions of events declared in and fired from C++.
 * We need this file to be an ambient declaration file, so imports are banned. Unfortunately means we have to do
 * endless ugly import('...') for instances of actual enums inside of common/ (const enums are a hassle since can't be
 * iterated over).
 */

interface GlobalEventNameMap {
	/** Tells JavaScript to show a confirm/deny popup that fires MapSelector_ConfirmOverwrite( mapID ) upon confirm option select. */
	MapSelector_ShowConfirmOverwrite: (mapID: number) => void;

	/** Confirms overwrite of the given map, allowing download. */
	MapSelector_ConfirmOverwrite: (mapID: number) => void;

	/** Removes the given mapID: number from the download queue. */
	MapSelector_RemoveMapFromDownloadQueue: (mapID: number) => void;

	/** Confirms the cancellation of the download for the given mapID: number. */
	MapSelector_ConfirmCancelDownload: (mapID: number) => void;

	/** Tries playing the given mapID: number. If it is not found locally, it is added to library and downloaded. */
	MapSelector_TryPlayMap: (mapID: number) => void;

	/** Like MapSelector_TryPlayMap, but takes the gamemode to override to before passing it along. */
	MapSelector_TryPlayMap_GameModeOverride: (
		mapID: number,
		gamemode: import('common/web_dontmodifyme').Gamemode
	) => void;

	/** Toggles adding/removing a map to/from favorites */
	MapSelector_ToggleMapFavorite: (mapID: number, isAdding: boolean) => void;

	/** Deletes a downloaded map */
	MapSelector_DeleteMap: (mapID: number) => void;

	/** Fired when the maps list has applied filters, with the number of maps that passed the filters passed along. */
	MapSelector_MapsFiltered: (count: number) => void;

	/** Fired after TryPlayMap returns, if wasSuccessful the map was started, otherwise the map may be downloading or failed to start. */
	MapSelector_TryPlayMap_Outcome: (wasSuccessful: boolean) => void;

	/** Fired when the selected map has its data update */
	MapSelector_SelectedDataUpdate: (mapData: MapCacheAPI.MapData) => void;

	/**
	 * Fired when online map data for the selected map have been updated.
	 * These are fetched from the backend when a map is selected, with a 60s cooldown. If we're outside the cooldown,
	 * the event fires once we get a response from backend, otherwise it fires immediately after
	 * `MapSelector_SelectedDataUpdate`.
	 */
	MapSelector_SelectedOnlineDataUpdate: (stats: import('common/web_dontmodifyme').MMap) => void;

	PanoramaComponent_SteamLobby_OnListUpdated: (lobbyList: import('common/online').GroupedLobbyLists) => void;

	PanoramaComponent_SteamLobby_OnDataUpdated: (lobbyData: import('common/online').LobbyList) => void;

	PanoramaComponent_SteamLobby_OnMemberDataUpdated: (memberData: import('common/online').MemberData) => void;

	PanoramaComponent_SteamLobby_OnMemberStateChanged: (
		steamID: steamID,
		change: import('common/online').LobbyMemberStateChange
	) => void;

	/** Fired when client state changes */
	PanoramaComponent_SteamLobby_OnLobbyStateChanged: (change: import('common/online').LobbyMemberStateChange) => void;

	PanoramaComponent_Chat_OnPlayerMuted: (steamID: steamID) => void;

	PanoramaComponent_Chat_OnPlayerUnmuted: (steamID: steamID) => void;

	PanoramaComponent_News_OnRSSFeedReceived: (feed: { items: NewsAPI.RSSFeedItem[] }) => void;

	OnNewChatEntry: (panel: GenericPanel & { message: string; author_name: string; author_xuid: string }) => void;

	ComparisonRunUpdated: () => void;

	OnCookUpdate: (time: float, percentage: float) => void; // Conc thing!

	OnConcEntityPanelThink: () => void;

	OnAimOverGhostChange: (panel: MomHudGhostEntityPanel, aimOver: boolean) => void;

	// Some map cache stuff is probably wrong, not doing fully since probably changing soon
	MapCache_MapLoad: (mapName: string) => void;

	MapCache_CacheUpdate: (...args: unknown[]) => void; // TODO: Not typing since likely to change soon (sources are weird)

	MapCache_MapUpdate: (...args: unknown[]) => void;

	MapCache_SearchComplete: (success: boolean) => void;

	/** Fired when a static map list is updated from backend */
	MapCache_StaticCacheUpdate: (type: import('common/maps').MapListType, success: boolean) => void;

	/** Fired when finished checking latest static cache versions */
	MapCache_StaticCacheVersionChecked: (updatesNeeded: 0 | 1 | 2) => void;

	/** Fired when the private map lists are updated from online */
	MapCache_PrivateMapsUpdate: (success: boolean) => void;

	MapDownload_Queued: (mapID: uint32, added: boolean) => void;

	MapDownload_Start: (mapID: uint32, mapName: string) => void;

	MapDownload_Size: (mapID: uint32, size: uint64_str) => void;

	MapDownload_Progress: (mapID: uint32, sizeOfChunk: uint64_str, offsetOfChunk: uint64_str) => void;

	MapDownload_End: (mapID: uint32, error: boolean) => void;

	Game_MetaModeChanged: (gamemode: import('common/web_dontmodifyme').Gamemode) => void;

	OnMomentumWeaponStateChange: (
		state: import('common/weapon').WeaponStateChangeMode,
		weaponID: import('common/weapon').WeaponID
	) => void;

	OnAllMomentumWeaponsDropped: () => void;

	OnDefragHUDProjectionChange: () => void;

	OnDefragHUDFOVChange: () => void;

	OnDefragHUDAccelChange: () => void;

	OnDefragHUDSnapChange: () => void;

	OnDefragHUDPrimeChange: () => void;

	OnDefragHUDWIndicatorChange: () => void;

	OnDefragHUDCompassChange: () => void;

	OnDefragHUDGroundboostChange: () => void;

	DFJumpDataUpdate: (releaseDelay: float, pressDelay: float, totalDelay: float) => void;

	DFJumpMaxDelayChanged: (newDelay: float) => void;

	/** Called when the player changes a jump timing setting (mom_hud_jump_timing_range, mom_mv_perfect_jump_window, or mom_mv_autohop_mode). */
	JumpTimingSettingChanged: () => void;

	/** Jump timing has been updated */
	JumpTimingDataUpdate: (jumpTiming: number) => void;

	OnJumpStatsCFGChange: () => void;

	OnJumpStarted: () => void;

	/** Called when the player changes strafe trainer display mode setting (mom_hud_strafetrainer_mode). */
	OnStrafeTrainerModeChanged: (cvarValue: int32) => void;

	/** Called when the player changes strafe trainer color mode setting (mom_hud_strafetrainer_color_enable). */
	OnStrafeTrainerColorModeChanged: (cvarValue: int32) => void;

	/** Called when the player changes strafe trainer dynamic direction setting (mom_hud_strafetrainer_dynamic_enable). */
	OnStrafeTrainerDynamicModeChanged: (cvarValue: int32) => void;

	/** Called when the player changes strafe trainer direction setting  (mom_hud_strafetrainer_flip_enable). */
	OnStrafeTrainerDirectionChanged: (cvarValue: int32) => void;

	/** Called when the player changes strafe trainer buffer length setting (mom_hud_strafetrainer_buffer_size). */
	OnStrafeTrainerBufferChanged: (cvarValue: int32) => void;

	/** Called when the player changes strafe trainer minimum speed setting (mom_hud_strafetrainer_min_speed). */
	OnStrafeTrainerMinSpeedChanged: (cvarValue: int32) => void;

	/** Called when the player changes strafe trainer text mode setting (mom_hud_strafetrainer_stat_mode). */
	OnStrafeTrainerStatModeChanged: (cvarValue: int32) => void;

	/** Called when the player changes strafe trainer stats color mode setting (mom_hud_strafetrainer_color_enable). */
	OnStrafeTrainerStatColorModeChanged: (cvarValue: int32) => void;

	/** Fires when quit_prompt is called. */
	OnMomentumQuitPrompt: () => void;

	/** Fired when HUD chat is opened. */
	HudChat_Show: () => void;

	/** Fired when HUD chat is closed. */
	HudChat_Hide: () => void;

	/** Called on speed update, respecting mom_hud_speedometer_refresh_rate */
	OnSpeedometerUpdate: (deltaTime: float) => void;

	/** Called on explosive hit speed update */
	OnExplosiveHitSpeedUpdate: (velocity: vec3) => void;

	/** Called on jump speed update */
	OnJumpSpeedUpdate: (speed: float) => void;

	/** Called on ramp board speed update */
	OnRampBoardSpeedUpdate: (velocity: vec3) => void;

	/** Called on ramp leave speed update */
	OnRampLeaveSpeedUpdate: (velocity: vec3) => void;

	/** Called when speedometer settings have been loaded */
	OnSpeedometerSettingsLoaded: (success: boolean) => void;

	/** Called when range color profiles have been loaded */
	OnRangeColorProfilesLoaded: (success: boolean) => void;

	/** Called when speedometer settings have been saved */
	OnSpeedometerSettingsSaved: (success: boolean) => void;

	/** Called when range color profiles have been saved */
	OnRangeColorProfilesSaved: (success: boolean) => void;

	/**
	 * Fired from C++ when we want to create a standard Toast panel.
	 * @internal Don't use these, import ToastManager and use that directly.
	 */
	Toast_Show: (
		id: string,
		title: string,
		message: string,
		location: ToastAPI.ToastLocation,
		duration: number,
		icon: string,
		style: ToastAPI.ToastStyle
	) => void;

	/**
	 * Fired from C++ when we want to create a custom Toast panel.
	 * @internal Don't use these, import ToastManager and use that directly.
	 */
	Toast_ShowCustom: (
		id: string,
		layoutFile: string,
		location: ToastAPI.ToastLocation,
		duration: number,
		parameters: Record<string, any>
	) => void;

	/**
	 * Fired from C++ to delete toasts
	 * @internal Don't use these, import ToastManager and use that directly.
	 */
	Toast_Delete: (id: string) => void;

	/**
	 * Fired from C++ to clear toastsa
	 * @internal Don't use these, import ToastManager and use that directly.
	 */
	Toast_Clear: (location?: ToastAPI.ToastLocation) => void;

	MomentumSpectatorModeChanged: (mode: SpectateMode) => void;

	MomentumSpecListMaxNamesUpdate: (maxNames: uint32) => void;

	MomentumSpectateStart: () => void;

	MomentumSpectateStop: () => void;

	/** Called whgen lobby-wide spectator state changes */
	MomentumSpectatorUpdate: () => void;

	OnMomentumReplayStarted: () => void;

	OnMomentumReplayStopped: () => void;

	OnChargeUpdate: (chargeEnabled: boolean, speedInUps: float, percentageCharge: float) => void;

	OnStickyPanelStateChanged: (
		panel: Panel,
		state: import('hud/sticky-count').StickyState,
		prevState: import('hud/sticky-count').StickyState
	) => void;

	SteamLobby_Enter: (lobbyID: steamID) => void;

	SteamLobby_Exit: () => void;

	SteamLobby_MemberJoinLeave: (lobbyID: steamID, memberID: steamID) => void;

	OnMomentumPlayerPracticeModeStateChange: (enabled: boolean) => void;

	OnSaveStateUpdate: (count: int32, current: int32, usingMenu: boolean) => void;

	/** Fired when the HUD Leaderboards panel is opened */
	HudTabMenu_Opened: () => void;

	/** Fired when the HUD Leaderboards panel is closed */
	HudTabMenu_Closed: () => void;

	/** Fired when the HUD leaderboards panel gains mouse input */
	HudTabMenu_OnMouseActive: () => void;

	/** Fired when the HUD leaderboards panel should show the end of run panel */
	EndOfRun_Show: (reason: import('common/timer').EndOfRunShowReason) => void;

	/** Fired when the end of run panel should be hidden */
	EndOfRun_Hide: () => void;

	/** Fired when a run is finished and passes the run metadata for the completed run. At this point the replay has not been saved yet. */
	EndOfRun_Result_RunFinish: (run: RunMetadata) => void;

	/** Fired when the replay recording finishes and passes whether writing the file was successful */
	EndOfRun_Result_RunSave: (saved: boolean, run: RunMetadata) => void;

	/** Fired when the replay recording finishes and passes whether writing the file was successful */
	EndOfRun_Result_RunUpload: (uploaded: boolean, cosXP: number, rankXP: number, lvlGain: number) => void;

	ZoneMenu_Show: () => void;

	ZoneMenu_Hide: () => void;

	OnRegionEditCompleted: (region: import('common/web_dontmodifyme').Region) => void;

	OnRegionEditCanceled: () => void;

	/** Fired when the primary timer of the UI entity transitions to a different state */
	OnObservedTimerStateChange: () => void;

	/** Fired when the primary timer of the UI entity progresses to a new checkpoint */
	OnObservedTimerCheckpointProgressed: () => void;

	/** Fired when the primary timer of the UI entity effectively starts a segment. */
	OnObservedTimerSegmentEffectiveStart: () => void;

	/**
	 * Fired when the primary timer of the observed entity changes arbitrarily, such as
	 * when changing spectate targets or seeking during replay playback
	 */
	OnObservedTimerReplaced: () => void;

	/** Fired when a new controllable replay is set, or the prior one was shut down */
	OnControlledReplaySet: () => void;

	/** Fired when the selected time list type is changed, passing the old times list type and new type that was selected */
	Leaderboards_TimeListTypeChange: (
		oldType: import('common/leaderboard').LeaderboardType,
		newType: import('common/leaderboard').LeaderboardType
	) => void;

	/** Fired when the leaderboards is applying filters to the list, and passes the number of maps to display */
	Leaderboards_TimesFiltered: (numMaps: int32) => void;

	/** Fired when the leaderboards has its map data set but before times are loaded */
	Leaderboards_MapDataSet: (isOfficial: boolean) => void;

	/** Fired when the official map leaderboard data has loaded */
	Leaderboards_OfficialMapLeaderboardsLoaded: (map: import('common/web_dontmodifyme').MMap) => void;

	/** Fired when the local map leaderboard data has loaded */
	Leaderboards_LocalMapLeaderboardsLoaded: () => void;

	/** Fired when the leaderboards has attempted to play a replay. */
	Leaderboards_OnPlayReplay: () => void;

	LeaderboardEntry_TimeDataUpdated: () => void;

	LeaderboardEntry_PlayReplay: (itemIndex: int32) => void;

	LeaderboardEntry_SetComparisonRun: (itemIndex: int32) => void;

	LeaderboardEntry_DeleteReplay: (itemIndex: int32) => void;

	/** Fired when local user data is loaded from disk or fetched from backend. */
	MomAPI_UserUpdate: (user: import('common/web_dontmodifyme').User) => void;

	/** Fired on API authenticate success or failure. */
	MomAPI_Authenticated: (result: MomentumAPI.AuthenicationResult) => void;

	ActiveZoneDefsChanged: () => void;

	/** Fired after updating the map cache with the latest map lobby player counts. */
	MapEntry_MapLobbiesUpdated: (playerCount: number) => void;

	/** Called when the player changes safeguard HUD settings (mom_safeguard_holdtime). */
	OnSafeguardSettingChanged: () => void;

	/** Called when the player starts holding down a safeguarded command. */
	OnSafeguardCommandHold: () => void;

	/** Called when the player releases a safeguarded command before it completes. */
	OnSafeguardCommandRelease: () => void;

	/** Called when the player completes a safeguarded command. */
	OnSafeguardCommandComplete: () => void;

	/** Called when HUD customizer edit UI has been enabled. */
	HudCustomizer_Opened: () => void;
	
	/** Called when HUD customizer edit UI has been enabled, straight after Closed. Just for use in customizer.ts! */
	HudCustomizer_OpenedInternal: () => void;

	/** Called when HUD customizer edit UI has been disabled. */
	HudCustomizer_Closed: () => void;

	/** Called when HUD layout has been loaded. */
	HudCustomizer_LayoutLoaded: (success: boolean) => void;

	/** Called when HUD layout has been reloaded (probably by mom_hudcustomizer_reloadlayout). */
	HudCustomizer_LayoutReloaded: (success: boolean) => void;

	/** Called when HUD layout has been saved. */
	HudCustomizer_LayoutSaved: (success: boolean) => void;
}

interface PanelEventNameMap {
	MapEntry_MapDataUpdate: () => void;
}
