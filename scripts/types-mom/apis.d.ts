type RunMetadata = import('common/timer').RunMetadata;
type RunSplits = import('common/timer').RunSplits;
type Gamemode = import('common/web/enums/gamemode.enum').Gamemode;

declare namespace MomentumAPI {
	/** Whether we're currently authenticated with the backend. */
	function IsAuthenticated(): boolean;

	/** Gets the entire User object with profile and stats. May be disk-cached data. */
	function GetLocalUserData(): import('common/web/types/models/models').User;

	/** Fetch new user data from backend, fires MomAPI_LocalUserUpdate when complete. */
	function RefreshLocalUserData(): void;

	/** Whether local user is allowed to submit runs. */
	function AllowRunSubmission(): boolean;

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

	const enum UserAuthConsent {
		INVALID = 0,
		OUTDATED = 1,
		VALID = 2
	}

	function GetUserAuthConsent(): UserAuthConsent;

	function GrantUserAuthConsent(): void;

	const enum AuthenicationResult {
		SUCCESS = 0,

		// General failure case, could be invalid ticket, using noencryptedticket for prod etc...
		// Should be very rare for normal users.
		FAILURE_UNAUTHORIZED = 1,

		// Whenever Steam won't respond to local user with valid data (Tuesdays!)
		FAILURE_LOCAL_STEAM_CONNECTION = 2,

		// Backend can't get through to Steam (Tuesdays!)
		FAILURE_BACKEND_STEAM_CONNECTION = 3,

		// Backend is down for some reason
		FAILURE_BACKEND_DOWN = 4,

		// Limited (haven't spent £5) Steam account
		FAILURE_ACCOUNT_LIMITED = 5,

		// Signups killswitch is active (hard to know if we'll ever do this)
		FAILURE_SIGNUPS_DISABLED = 6
	}
}

declare namespace MomentumMovementAPI {
	const enum PlayerMoveStatus {
		AIR = 0,
		WALK = 1,
		WATER = 2,
		WATERJUMP = 3
	}

	interface MoveHudData {
		wishVel: vec3;
		moveStatus: PlayerMoveStatus;
		acceleration: float;
		maxspeed: float;
		friction: float;
		hasteTime: int32;
		damageBoostTime: int32;
		slickTime: int32;
		flightTime: int32;
		defragTimer: int32;
		defragTimerFlags: int32;
		airJumpEnabled: boolean;
		canAirJump: boolean;
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

	/** Gets an object containing the HUD data */
	function GetMoveHudData(): MoveHudData;

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

	/** Gets the player or spec target's current mechanical energy, expressed as the height (in units) reachable above the ground they last touched in their start zone */
	function GetEnergy(): float;

	/** Gets the player or spec target's percentage of sync'd strafe ticks according to calculation type */
	function GetStrafeSync(type: 0 | 1): float;

	/** Gets the player's practice mode state */
	function IsInPracticeMode(): boolean;

	/** Gets the player's current FOV. */
	function GetFOV(): float;

	/** Gets whether the player is ducking. */
	function IsDucking(): boolean;

	/** Gets whether the player is sprinting (ahop only). */
	function IsSprinting(): boolean;

	/** Gets whether the player is walking (ahop only). */
	function IsWalking(): boolean;
}

declare namespace MomentumWeaponAPI {
	/**
	 * Gets the weapon slot for a specific weapon ID.
	 * @returns -1 if not found.
	 */
	function GetWeaponSlot(weaponID: import('common/weapon').WeaponID): int32;
}

declare namespace MomentumReplayAPI {
	enum ReplayState {
		NONE = 0,
		PLAYING = 1,
		PAUSED = 2
	}

	interface ReplayProgress {
		curtick: int32;
		totalticks: int32;
		curtime: float;
		starttime: float;
		endtime: float;
	}

	function GetReplayState(): ReplayState;

	function GetReplayProgress(): ReplayProgress;

	function GetReplayRunSplits(): RunSplits | null;

	function PlayPause(): void;

	/** Go to some point within the replay, within [0, 1]  */
	function GoTo(position: float): void;

	function GoToStart(): void;

	function GoToEnd(): void;

	function GoToNextTick(): void;

	function GoToPreviousTick(): void;

	function GoToNextChapter(): void;

	function GoToPreviousChapter(): void;
}

declare namespace ChatAPI {
	function ChangeMuteState(steamID: steamID, mute: boolean): void;

	function BIsUserMuted(steamID: steamID): boolean;
}

declare namespace SteamLobbyAPI {
	/**
	 * Request a data update. If new data is available, runs callbacks
	 * @todo Filters haven't been implemented yet. For now, pass an empty object.
	 */
	function RefreshList(filters: Record<string, never>): boolean;

	/** Create a new lobby with the given visibility */
	function Create(type: 0 | 1 | 2, memberLimit: number): void;

	/** Joins a lobby of the given SteamID */
	function Join(steamID: steamID): void;

	/** Leaves the current lobby */
	function Leave(): void;

	/** Set the lobby type */
	function SetType(type: 0 | 1 | 2): void;

	/** Set the member limit */
	function SetMemberLimit(memberLimit: number): void;

	/** Show the Steam Overlay invite dialog if we're in a lobby */
	function ShowInviteDialog(): void;

	/** Get the maximum member limit a lobby may have */
	function GetMaxAllowedMemberLimit(): number;

	/** Returns true if the local player is currently in a lobby */
	function IsInLobby(): boolean;
}

declare namespace GameModeAPI {
	type Gamemode = import('common/web/enums/gamemode.enum').Gamemode;

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

	/**
	 * Get i18n token for the provided gamemode.
	 * Returns #Timer_Stage for most modes, #Timer_Course for modes like RJ.
	 */
	function GetGameModeSegmentToken(gamemode: Gamemode): string;

	/**
	 * Get i18n token for the provided gamemode.
	 * Returns #Timer_Checkpoint for most modes, #Timer_Jump for modes like RJ.
	 */
	function GetGameModeCheckpointToken(gamemode: Gamemode): string;

	/** Gets all valid run styles for the provided gamemode. */
	function GetValidRunStyles(gamemode: Gamemode): number[];
}

declare namespace MomentumTimerAPI {
	type Zones = import('common/web/types/models/models').MapZones;

	/** Gets the observed timer status */
	function GetObservedTimerStatus(): import('common/timer').TimerStatus;

	/** Gets the observed timer run splits */
	function GetObservedTimerRunSplits(): import('common/timer').RunSplits;

	/** Gets the observed run metadata. Returns null if not observing a run replay. */
	function GetObservedRunMetadata(): RunMetadata | null;

	/** Gets the ZoneDefs for the active zones, if any */
	function GetActiveZoneDefs(): Zones;

	/** Replace the active zones with the specified ZoneDefs */
	function SetActiveZoneDefs(zoneDefs: Zones): void;

	/** Save the specified ZoneDefs to newzones file */
	function SaveZoneDefs(zoneDefs: Zones): void;

	/** Load ZoneDefs from newzones file */
	function LoadZoneDefs(useLocal: boolean): boolean;

	/** Check whether local or online zone files exist */
	function GetSavedZoneStatus(): import('pages/zoning/zoning').savedZoneStatus;
}

declare namespace MomentumInputAPI {
	interface KeypressButtons {
		physicalButtons: int32;
		toggledButtons: int32;
		disabledButtons: int32;
		forcedButtons: int32;
	}

	function GetButtons(): KeypressButtons;
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

	type StaticData = import('common/web/types/models/models').MMap;

	interface MapData {
		staticData: StaticData;
		userData?: UserData;
		mapFileExists: boolean;
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
	/** Gets the RunMetadata for the comparison run, if any */
	function GetComparisonRun(): RunMetadata | null;
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

/**
 * Read-only access to the legacy cfg/speedometer files, only used by the one-time import into HUD presets.
 * @see import('common/speedometer-legacy-import')
 */
declare namespace SpeedometerSettingsAPI {
	/**
	 * Gets the speedometers of a gamemode from cfg/speedometer/speedometer.kv3.
	 * Null if the file doesn't exist or doesn't have the gamemode. Unvalidated, normalise before use.
	 */
	function GetLegacySettings(gamemode: Gamemode): unknown[] | null;

	/**
	 * Gets the range color profiles from cfg/speedometer/speedometer_colorprof.kv3.
	 * Null if the file doesn't exist. Unvalidated, normalise before use.
	 */
	function GetLegacyColorProfiles(): unknown[] | null;
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
		highlightStrength: float;
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

declare namespace ToastAPI {
	const enum ToastLocation {
		LEFT = 0,
		CENTER = 1,
		RIGHT = 2
	}

	const enum ToastStyle {
		INFO = 'info',
		SUCCESS = 'success',
		WARNING = 'warning',
		ERROR = 'error',
		BLUE = 'blue',
		RED = 'red',
		GREEN = 'green',
		ORANGE = 'orange'
	}

	function CreateToast(
		id: string,
		title: string,
		message: string,
		location: ToastLocation,
		duration: number,
		icon: string,
		style: string
	): void;

	function CreateToast_Simple(title: string, message: string): void;

	function CreateToast_Custom(
		id: string,
		layoutFile: string,
		location: ToastLocation,
		duration: number,
		params: Record<string, any>
	): void;

	function DeleteToast(id: string): void;

	function ClearToasts(): void;
}
