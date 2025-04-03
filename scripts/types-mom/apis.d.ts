type RunMetadata = import('common/timer').RunMetadata;
type Gamemode = import('common/web').Gamemode;

declare namespace MomentumAPI {
	/** Gets the entire User object with profile and stats. May be disk-cached data. */
	function GetPlayerUserData(): import('common/web').User;

	/** Fetch new user data from backend, fires MomAPI_UserUpdate when complete. */
	function RefreshPlayerUserData(): void;

	/** Gets the local players level */
	function GetPlayerXp(): int32;

	/** Gets the local players XP */
	function GetPlayerLevel(): int32;

	/** Gets the total XP needed to reach a given level." */
	function GetCosmeticXpForLevel(level: int32): int32;

	/** Gets the amount of money the local player has (Units)." */
	function GetPlayerMoney(): int32;
	/** Gets Momentum's current version information." */

	function GetVersionInfo(): string;
}

declare namespace MomentumMovementAPI {
	const enum PlayerMoveStatus {
		AIR = 0,
		WALK = 1,
		WATER = 2,
		WATERJUMP = 3
	}

	interface LastMove {
		wishdir: vec3;
		moveStatus: PlayerMoveStatus;
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
		efficiency: float;
	}

	interface LastTick {
		strafeRight: int32;
		speedGain: float;
		idealGain: float;
		yawRatio: float;
	}

	const enum MoveType {
		NONE = 0,
		ISOMETRIC = 1,
		WALK = 2,
		STEP = 3,
		FLY = 4,
		FLYGRAVITY = 5,
		VPHYSICS = 6,
		PUSH = 7,
		NOCLIP = 8,
		LADDER = 9,
		OBSERVER = 10,
		CUSTOM = 11
	}

	/** Gets the current value of sv_stopspeed. */
	function GetStopspeed(): float;

	/** Gets the physics tick interval in seconds */
	function GetTickInterval(): float;

	/* Gets the current game time in seconds */
	function GetCurrentTime(): float;

	/** Gets the player's movetype (eg. normal, on a ladder, noclip, etc) */
	function GetMoveType(): MoveType;

	/** Gets an object containing the last move data */
	function GetLastMoveData(): LastMove;

	/* Gets an object containing stats from the last jump */
	function GetLastJumpStats(): LastJump;

	/** Gets an object containing gain stats from the last tick */
	function GetLastTickStats(): LastTick;
}

declare namespace MomentumPlayerAPI {
	/** Gets the player or spec target's current velocity */
	function GetVelocity(): vec3;

	/** Gets the player or spec target's current view angles */
	function GetAngles(): vec3;

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

declare namespace MomentumReplayAPI {
	/** Gets the current tick of the replay */
	function GetCurrentTick(): int32;

	/** Gets the total ticks of the replay */
	function GetTotalTicks(): int32;

	/** Gets the current time of the replay */
	function GetCurrentTime(): float;

	/** Gets the total time of the replay */
	function GetTotalTime(): float;

	/** Gets whether the replay is paused */
	function IsPaused(): boolean;

	/** Sets the progress of the replay */
	function SetProgress(progress: float): void;

	enum ReplayState {
		NONE = 0,
		PLAYING = 1,
		PAUSED = 2
	}

	interface ReplayProgress {
		curtick: int32;
		totalticks: int32;
		curtime: float;
		endtime: float;
	}

	function GetReplayState(): ReplayState;

	function GetReplayProgress(): ReplayProgress;

	function GetReplayRunMetadata(): RunMetadata | null;
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
	function Create(type: 0 | 1 | 2): void;

	/** Joins a lobby of the given SteamID */
	function Join(steamID: steamID): void;

	/** Leaves the current lobby */
	function Leave(): void;

	/** Change the lobby visibility */
	function ChangeVisibility(type: 0 | 1 | 2): void;

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

	/* Gets the game mode used by the game UI. */
	function GetMetaGameMode(): Gamemode;

	/** Gets the name of a given gamemode type. */
	function GetGameModeName(gamemode: Gamemode): string;

	const enum GameModeHUDCapability {
		SYNC = 0,
		SYNC_BAR = 1,
		KEYPRESS_STRAFES = 2,
		KEYPRESS_JUMPS = 3,
		KEYPRESS_ATTACK = 4,
		KEYPRESS_WALK = 5,
		KEYPRESS_SPRINT = 6
	}

	/** Gets whether the current gamemode has the specified HUD capability. */
	function CurrentGameModeHasHUDCapability(capability: GameModeHUDCapability): boolean;
}

declare namespace MomentumTimerAPI {
	/**
	 * OLD API! Remove me!
	 * @deprecated
	 */
	function GetTimerState(): any;
	/**
	 * OLD API! Remove me!
	 * @deprecated
	 */
	function GetCurrentRunTime(): any;

	type Zones = import('common/web').MapZones;

	/** Gets the observed timer status */
	function GetObservedTimerStatus(): import('common/timer').TimerStatus;

	/** Gets the observed timer run splits */
	function GetObservedTimerRunSplits(): import('common/timer').RunSplits;

	/** Gets the ZoneDefs for the active zones, if any */
	function GetActiveZoneDefs(): Zones;

	/** Replace the active zones with the specified ZoneDefs */
	function SetActiveZoneDefs(zoneDefs: Zones): void;

	/** Save the specified ZoneDefs to newzones file */
	function SaveZoneDefs(zoneDefs: Zones): void;

	/** Load ZoneDefs from newzones file */
	function LoadZoneDefs(useLocal: boolean): boolean;
}

declare namespace MapCacheAPI {
	interface UserTrackData {
		completed: boolean;
		time: number;
	}
	interface UserData {
		inFavorites: boolean;
		lastPlayed: number;
		// Keys are bitpacked as `gamemode << 24 | trackType << 16 | trackNum << 8 | style`
		tracks: Record<number, UserTrackData>;
	}

	type StaticData = import('common/web').MMap;

	interface MapData {
		staticData: StaticData;
		userData?: UserData;
		mapFileExists: boolean;
		roamingLobbyPlayerCount: number;
	}

	/** Get the current map's name */
	function GetMapName(): string;

	/** Get the metadata for the current map */
	function GetCurrentMapData(): MapData;

	/** Gets the map data for the given mapID */
	function GetMapData(mapID: int32): MapData;

	/** Returns true if the given mapID is queued from download */
	function MapQueuedForDownload(mapID: int32): boolean;

	/** Checks backend for latest static cache versions, download if out-of-date */
	function CheckForUpdates(): void;

	/** Fetches private maps visible to the user */
	function FetchPrivateMaps(): void;
}

declare namespace SpectatorAPI {
	function GetSpecList(): steamID[];
}

declare namespace RunComparisonsAPI {
	function GetComparisonRun(): RunMetadata;
}

declare namespace ZonesAPI {
	function GetZoneCount(...args: any[]): any; // TODO: Old API (I think)
	function GetZoneSpeed(...args: any[]): any;
	function GetZoneSpeed(...args: any[]): any;
	function GetCurrentZone(...args: any[]): any;
}

declare namespace NewsAPI {
	interface RSSFeedItem {
		title: string;
		description: string;
		link: string;
		date: string;
		author: string;
		image: string;
	}

	function GetRSSFeed(): void;
}

declare namespace SpeedometerSettingsAPI {
	interface Settings {
		custom_label: string;
		enabled_axes: [boolean, boolean, boolean];
		type: import('common/speedometer').SpeedometerType;
		color_type: import('common/speedometer').SpeedometerColorType;
		range_color_profile?: string;
	}

	/**
	 * The naming of "Range" color as related is a bit confusing but too much work to refactor.
	 * When you see a "RangeColor" it's better thought of as "Color Range".
	 */
	interface RangeColorProfile {
		min: number;
		max: number;
		color: [number, number, number, number];
	}

	interface ColorProfile {
		profile_name: string;
		profile_ranges: RangeColorProfile[];
	}

	/** Gets speedometer settings for the current gamemode */
	function GetCurrentGamemodeSettings(): Settings[];

	/** Gets speedometer settings for a specific gamemode */
	function GetSettings(gamemode: Gamemode): Settings[];

	/** Resets speedometers for a specific gamemode to default */
	function SaveSpeedometersFromJS(gamemode: Gamemode, settings: Settings[]): boolean;

	/** Saves the range color profiles to file */
	function ResetSpeedometersToDefault(gamemode: Gamemode): boolean;

	/** Gets speedometer color profiles */
	function GetColorProfiles(): ColorProfile[];

	/** Gets a specified speedometer color profile */
	function GetColorProfile(name: string): ColorProfile;

	/** Saves the range color profiles to file */
	function SaveColorProfilesFromJS(profiles: ColorProfile[]): boolean;

	/** Resets color profiles to the default */
	function ResetColorProfilesToDefault(): boolean;
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

	const enum DefragPhysics {
		VQ3 = 0,
		CPM = 1,
		VTG = 2
	}

	function GetDFPhysicsMode(): DefragPhysics;

	function GetHUDProjection(): import('hud/cgaz').ProjectionMode;

	function GetHUDFOV(): float;

	function GetHUDAccelCFG(): AccelConfig;

	function GetHUDPrimeCFG(): PrimeConfig;

	function GetHUDSnapCFG(): SnapConfig;

	function GetHUDWIndicatorCFG(): WIndicatorConfig;

	function GetHUDCompassCFG(): CompassConfig;

	function GetHUDGroundboostCFG(): GroundboostConfig;
}

/**
 * API for reading and writing HUD config files.
 *
 * C++ side is agnostic to what you pass it, and we're not decided on the format of HUD layouts,
 * so types here are deliberately very weak; types in the HUD customizer files are much stronger.
 *
 * Note that cfg/hud_default.kv3 is stored in a the licensee-only game repo, just let someone
 * (probably Tom) know if you need to update it.
 */
declare namespace HudCustomizerAPI {
	/**
	 * Saves the given object to cfg/hud.kv3.
	 */
	function SaveLayoutFromJS(data: Record<string, any>): void;

	/**
	 * Tries to get the contents of cfg/hud.kv3 as a JS object.
	 *
	 * If cfg/hud.kv3 doesn't exist, loads cfg/hud_default.kv3.
	 */
	function GetLayout(): Record<string, any>;

	/**
	 * Gets the contents of cfg/hud_default.kv3 as a JS object.
	 */
	function GetDefaultLayout(): Record<string, any>;
}
