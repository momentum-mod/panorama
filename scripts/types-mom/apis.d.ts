declare namespace MomentumAPI {
	/** Gets the local players level */
	function GetPlayerXp(): int32;

	/** Gets the local players XP */
	function GetPlayerLevel(): int32;

	/** Gets the total XP needed to reach a given level." */
	function GetCosmeticXpForLevel(level: int32): int32;

	/** Gets the amount of money the local player has (Units)." */
	function GetPlayerMoney(): int32;
	/** Gets Momentum's current version information." */

	function GetVersionInfo(): { version: string };
}

declare namespace MomentumMovementAPI {
	interface LastMove {
		wishdir: import('util/math').Vector;
		moveStatus: import('common/movement').PlayerMoveStatus;
		wishspeed: float;
		acceleration: float;
		maxspeed: float;
		friction: float;
		hasteTime: int32;
		damageBoostTime: int32;
		slickTime: int32;
		defragTimer: int32;
		defragTimerFlags: int32;
	}

	interface LastJump {
		jumpCount: int32;
		takeoffSpeed: float;
		jumpSpeedDelta: float;
		takeoffTime: float;
		timeDelta: float;
		strafeSync: float;
		strafeCount: int32;
		speedGain: float;
		enviroAccel: float;
		yawRatio: float;
		heightDelta: float;
		distance: float;
		efficency: float;
	}

	interface LastTick {
		strafeRight: int32;
		speedGain: float;
		idealGain: float;
		yawRatio: float;
	}

	/** Gets the current value of sv_stopspeed. */
	function GetStopspeed(): float;

	/** Gets the physics tick interval in seconds */
	function GetTickInterval(): float;

	/* Gets the current game time in seconds */
	function GetCurrentTime(): float;

	/** Gets the player's movetype (eg. normal, on a ladder, noclip, etc) */
	function GetMoveType(): import('common/movement').MoveType;

	/** Gets an object containing the last move data */
	function GetLastMoveData(): LastMove;

	/* Gets an object containing stats from the last jump */
	function GetLastJumpStats(): LastJump;

	/** Gets an object containing gain stats from the last tick */
	function GetLastTickStats(): LastTick;
}

declare namespace MomentumPlayerAPI {
	/** Gets the player or spec target's current velocity */
	function GetVelocity(): import('util/math').Vector;

	/** Gets the player or spec target's current view angles */
	function GetAngles(): import('util/math').Vector;

	/** Gets the player or spec target's percentage of sync'd strafe ticks according to calculation type */
	function GetStrafeSync(type: 0 | 1): float;

	/** Gets the player's practice mode state */
	function IsInPracticeMode(): boolean;

	/** Gets the player's current FOV. */
	function GetFOV(): float;

	/** Gets whether the player is ducking. */
	function IsDucking(): boolean;
}

declare namespace MomentumWeaponAPI {
	/**
	 * Gets the weapon slot for a specific weapon ID.
	 * @returns -1 if not found.
	 */
	function GetWeaponSlot(weaponID: import('common/weapon').WeaponID): int32;
}

declare namespace ChatAPI {
	function ChangeMuteState(steamID: number, mute: boolean): void;

	function BIsUserMuted(steamID: number): boolean;
}

declare namespace SteamLobbyAPI {
	/**
	 * Request a data update. If new data is available, runs callbacks
	 * @todo Filters haven't been implemented yet. For now, pass an empty object.
	 */
	function RefreshList(filters: Record<string, never>): boolean;

	/** Create a new lobby with the given visibility */
	function Create(type: import('common/steam-lobby').LobbyType): void;

	/** Joins a lobby of the given SteamID */
	function Join(steamID: string): void;

	/** Leaves the current lobby */
	function Leave(): void;

	/** Change the lobby visibility */
	function ChangeVisibility(type: import('common/steam-lobby').LobbyType): void;

	/** Set the max players (up to 255) */
	function SetMaxPlayers(maxPlayers: number): void;

	/** Show the Steam Overlay invite dialog if we're in a lobby */
	function ShowInviteDialog(): void;
}

declare namespace GameModeAPI {
	type Gamemode = import('common/web').Gamemode;
	
	/** Gets a random tip for the given gamemode. On first call, will load tips from file. */
	function GetRandomTipForGameMode(gamemode: Gamemode): string;

	/* Gets the current game mode type. */
	function GetCurrentGameMode(): Gamemode;

	/** Gets the name of a given gamemode type. */
	function GetGameModeName(gamemode: Gamemode): string;

	type GameModeHUDCapability = ValueOf<GameModeHUDCapabilityEnum>;
	interface GameModeHUDCapabilityEnum {
		SYNC: 0;
		SYNC_BAR: 1;
		KEYPRESS_STRAFES: 2;
		KEYPRESS_JUMPS: 3;
		KEYPRESS_ATTACK: 4;
		KEYPRESS_WALK: 5;
		KEYPRESS_SPRINT: 6;
	}

	/** Gets whether the current gamemode has the specified HUD capability. */
	function CurrentGameModeHasHUDCapability(capability: GameModeHUDCapability);
}

declare namespace MomentumTimerAPI {
	function GetTimerState(): any; // TODO: Old API
}

declare namespace ZonesAPI {
	function GetZoneCount(...args: any[]): any; // TODO: Old API (I think)
}

declare namespace MapCacheAPI {
	type Map = import('common/web').MMap;
	/** Get the current map's name */
	function GetMapName(): string;

	/** Get the metadata for the current map */
	function GetCurrentMapData(): Map;

	/** Gets all the maps from the map cache */
	function GetMaps(): Map[];

	/** Gets the map data for the given mapID */
	function GetMapDataByID(mapID: int32): Map;

	/** Returns true if the given mapID is queued from download */
	function MapQueuedForDownload(mapID: int32): boolean;
}

/** Probably changing soon, doing weak types. */
declare namespace RunComparisonsAPI {
	function GetLoadedComparison(): any;
}

declare namespace NewsAPI {
	function GetRSSFeed(): void;
}

declare namespace DefragAPI {
	interface AccelConfig {
		enable: boolean;
		mirrorEnable: boolean;
		mirrorBorder: float;
		scaleEnable: boolean;
		minSpeed: float;
		height: float;
		offset: float;
		dzColor: rgbaColor;
		fastColor: rgbaColor;
		slowColor: rgbaColor;
		turnColor: rgbaColor;
	}

	interface PrimeConfig {
		enable: boolean;
		truenessMode: int32;
		inactiveEnable: boolean;
		oneLineEnable: boolean;
		minSpeed: float;
		height: float;
		offset: float;
		gainColor: rgbaColor;
		lossColor: rgbaColor;
		altColor: rgbaColor;
		highlightEnable: boolean;
		highlightBorder: float;
		highlightColor: rgbaColor;
		scaleHeightEnable: boolean;
		scaleColorEnable: boolean;
		arrowEnable: boolean;
		arrowSize: float;
		arrowColor: rgbaColor;
	}

	interface SnapConfig {
		enable: boolean;
		enableHeightGain: boolean;
		highlightMode: int32;
		colorMode: int32;
		minSpeed: float;
		height: float;
		offset: float;
		color: rgbaColor;
		altColor: rgbaColor;
		highlightColor: rgbaColor;
		altHighlightColor: rgbaColor;
		fastColor: rgbaColor;
		slowColor: rgbaColor;
	}

	interface WIndicatorConfig {
		enable: boolean;
		height: float;
		offset: float;
		size: float;
		color: rgbaColor;
		border: float;
	}

	interface CompassConfig {
		compassMode: int32;
		compassArrowSize: float;
		compassTickSize: float;
		compassOffset: float;
		pitchEnable: boolean;
		pitchTarget: string;
		pitchWidth: float;
		pitchOffset: float;
		statMode: int32;
		color: rgbaColor;
		highlightColor: rgbaColor;
	}

	interface GroundboostConfig {
		enable: boolean;
		overshootEnable: boolean;
		textMode: int32;
		textColorMode: int32;
		crashHlEnable: boolean;
	}

	function GetDFPhysicsMode(): import('common/movement').DefragPhysics;

	function GetHUDProjection(): 0 | 1 | 2;

	function GetHUDFOV(): float;

	function GetHUDAccelCFG(): AccelConfig;

	function GetHUDPrimeCFG(): PrimeConfig;

	function GetHUDSnapCFG(): SnapConfig;

	function GetHUDWIndicatorCFG(): WIndicatorConfig;

	function GetHUDCompassCFG(): CompassConfig;

	function GetHUDGroundboostCFG(): GroundboostConfig;
}
