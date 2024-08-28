export enum GameUIState {
	INVALID = 0,
	LOADINGSCREEN = 1,
	INGAME = 2,
	MAINMENU = 3,
	PAUSEMENU = 4,
	INTROMOVIE = 5
}

/**
 * Bitflags of different HUD types to associate with hiding this panel.
 * @example
 * panel.hiddenHUDBits = Globals.State.HideHud.TABMENU //  hide the panel when the tab menu is open.
 */
export enum HideHud {
	WEAPONSELECTION = 1 << 0,
	FLASHLIGHT = 1 << 1,
	ALL = 1 << 2,
	HEALTH = 1 << 3,
	PLAYERDEAD = 1 << 4,
	NEEDSUIT = 1 << 5,
	MISCSTATUS = 1 << 6,
	CHAT = 1 << 7,
	CROSSHAIR = 1 << 8,
	VEHICLE_CROSSHAIR = 1 << 9,
	INVEHICLE = 1 << 10,
	BONUS_PROGRESS = 1 << 11,
	RADAR = 1 << 12,
	MINISCOREBOARD = 1 << 13,
	TABMENU = 1 << 14 // "Leaderboards" in some places, renaming for momenutm
}
