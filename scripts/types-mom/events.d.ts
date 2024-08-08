interface GlobalEventNameMap {
	PanoramaComponent_SteamLobby_OnListUpdated: (lobbyList: SteamLobby.LobbyList) => void;

	PanoramaComponent_SteamLobby_OnDataUpdated: (lobbyData: SteamLobby.LobbyData) => void;

	PanoramaComponent_SteamLobby_OnMemberDataUpdated: (memberData: SteamLobby.MemberData) => void;

	PanoramaComponent_SteamLobby_OnMemberStateChanged: (
		steamID: string,
		change: import('common/steam-lobby').LobbyMemberStateChange
	) => void;

	/** Fired when client state changes */
	PanoramaComponent_SteamLobby_OnLobbyStateChanged: (
		change: import('common/steam-lobby').LobbyMemberStateChange
	) => void;

	PanoramaComponent_Chat_OnPlayerMuted: (steamID: string) => void;

	PanoramaComponent_Chat_OnPlayerUnmuted: (steamID: string) => void;

	OnNewChatEntry: (panel: GenericPanel & { message: string; author_name: string; author_xuid: string }) => void;

	HudCompare_Update: () => void;

	// TODO: Old, remove after rio stuff is in
	OnMomentumTimerStateChange: () => any;

	OnCookUpdate: (time: float, percentage: float) => void; // Conc thing!

	OnConcEntityPanelThink: () => void;

	OnAimOverGhostChange: (paneL: MomHudGhostEntityPanel, aimOver: boolean) => void;

	// Some map cache stuff is probably wrong, not doing fully since probably changing soon

	MapCache_MapLoad: (mapName: string) => void;

	MapCache_CacheUpdate: (...args: unknown[]) => void; // TODO: Not typing since likely to change soon (sources are weird)

	MapCache_MapUpdate: (...args: unknown[]) => void;

	MapCache_SearchComplete: (success: boolean) => void;

	MapDownload_Queued: (mapID: uint32, added: boolean) => void;

	MapDownload_Start: (mapID: uint32, mapName: string) => void;

	MapDownload_Size: (mapID: uint32, size: uint64) => void;

	MapDownload_Progress: (mapID: uint32, sizeOfChunk: uint64, offsetOfChunk: uint64) => void;

	MapDownload_End: (mapID: uint32, error: boolean) => void;

	Game_MetaModeChanged: (gamemode: import('common/web').Gamemode) => void;

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
}
