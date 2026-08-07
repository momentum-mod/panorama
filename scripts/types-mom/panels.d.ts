interface PanelTagNameMap {
	MomentumChat: MomentumChat;
	MomentumMapSelector: MomentumMapSelector;
	MapEntry: MapEntry;
	Leaderboards: Leaderboards;
	LeaderboardEntry: LeaderboardEntry;
	RangeColorDisplay: RangeColorDisplay;
	PlayerListPlayer: PlayerListPlayer;
	HudShowPos: HudShowPos;
	HudComparisons: HudComparisons;
	MomHudAmmo: MomHudAmmo;
	MomConcEntityPanel: MomConcEntityPanel;
	MomHudTabMenu: MomHudTabMenu;
	MomHudStatus: MomHudStatus;
	MomHudConcCookTime: MomHudConcCookTime;
	MomHudConcEntities: MomHudConcEntities;
	MomHudGhostEntities: MomHudGhostEntities;
	MomHudGhostEntityPanel: MomHudGhostEntityPanel;
	MomHudJumpStats: MomHudJumpStats;
	MomHudReplayControls: MomHudReplayControls;
	MomHudStickyCharge: MomHudStickyCharge;
	MomHudStrafeSync: MomHudStrafeSync;
	MomHudDFJump: MomHudDFJump;
	MomHudJumpTiming: MomHudJumpTiming;
	MomHudStrafeTrainer: MomHudStrafeTrainer;
	MomHudSpectate: MomHudSpectate;
	ZoneMenu: ZoneMenu;
	HudCustomizer: HudCustomizer;
}

interface MomentumChat extends AbstractPanel<'MomentumChat'> {
	SubmitText(): void;
}

interface MomentumMapSelector extends AbstractPanel<'MomentumMapSelector'> {
	readonly selectedMapData: MapCacheAPI.MapData;

	applyFilters(totalChange: boolean): void;
	/**
	 * Tell the C++ side which run style is on show, so the per-style data it owns (the completed
	 * filter, and the style it dispatches completion updates for) matches the style selector.
	 * Re-applies filters, since completion is per style.
	 */
	setSelectedStyle(style: import('common/web/enums/style.enum').Style): void;
	applyBackgroundMapImage(id: string, baseUrl: string | null): void;
	applyMapImageToImagePanel(imagePanel: Image, id: string, small: boolean, baseUrl: string): void;
}

interface MapEntry extends AbstractPanel<'MapEntry'> {
	readonly mapData: MapCacheAPI.MapData;
	readonly isDownloading: boolean;
}

interface Leaderboards extends AbstractPanel<'Leaderboards'> {
	handler: import('/pages/leaderboards/leaderboards').LeaderboardsHandler;

	/**
	 * Fetches a page (20 records) of leaderboard records for a map/track/gamemode/style/filter.
	 * Returns a request token; listen for `LeaderboardRecords_Loaded` (which passes the same
	 * token) then call `getLoadedLeaderboardRecords()` to read the result. A newer call
	 * supersedes any in-flight one.
	 *
	 * `filter` is a LeaderboardRecordsFilter: 0=global, 1=friends, 2=lobby, 3=savedReplays, 4=around.
	 * `page` is 0-based (ignored for `around`, which resolves to the page containing the user's PB).
	 */
	getLeaderboardRecords(
		mapID: int32,
		gamemode: import('common/web/enums/gamemode.enum').Gamemode,
		trackType: import('common/web/enums/track-type.enum').TrackType,
		trackNum: int32,
		style: import('common/web/enums/style.enum').Style,
		filter: import('common/leaderboard').LeaderboardRecordsFilter,
		page: int32
	): int32;

	/** Returns the most recently loaded page of leaderboard records fetched via `getLeaderboardRecords`. */
	getLoadedLeaderboardRecords(): import('common/leaderboard').LoadedLeaderboardRecords;

	/**
	 * Watches the replay for the loaded record at the given 0-based page index (its position in
	 * `getLoadedLeaderboardRecords().records`). Online replays are downloaded first. No-op if the
	 * index is out of range.
	 */
	playRecordReplay(index: int32): void;

	/** Sets the loaded record at the given 0-based page index as the comparison run (downloads it first for online records). */
	setRecordComparisonRun(index: int32): void;

	/** Deletes the saved-replay record at the given 0-based page index from disk. No-op for online records. */
	deleteRecordReplay(index: int32): void;
}

interface LeaderboardEntry extends AbstractPanel<'LeaderboardEntry'> {}

interface RangeColorDisplay extends AbstractPanel<'RangeColorDisplay'> {
	min: float;
	max: float;
	color: color;
	SetRange(min: float, max: float, color: color): void;
	SetBounds(min: float, max: float): void;
	SetMinNoEvent(min: float): void;
	SetMaxNoEvent(max: float): void;
	SetColorNoEvent(color: color): void;
}

interface HudComparisons extends AbstractHudPanel<'HudComparisons'> {}

interface MomHudTabMenu extends AbstractHudPanel<'MomHudTabMenu'> {
	forceCloseTabMenu(): void;
}

interface MomHudStatus extends AbstractHudPanel<'MomHudStatus'> {}

interface MomHudConcCookTime extends AbstractHudPanel<'MomHudConcCookTime'> {
	concTimerLabelEnabled: boolean;
}

interface MomHudConcEntities extends AbstractHudPanel<'MomHudConcEntities'> {
	readonly concEntPanelProgressBarEnabled: boolean;
	readonly concEntPanelTimerLabelEnabled: boolean;
}

interface MomConcEntityPanel extends AbstractHudPanel<'MomConcEntityPanel'> {
	readonly concPrimedPercent: number;
	readonly concPrimedTime: number;
	readonly concDistanceFadeAlpha: number;
}

interface MomHudGhostEntities extends AbstractHudPanel<'MomHudGhostEntities'> {
	readonly ghostNamesEnabled: boolean;
}

interface MomHudGhostEntityPanel extends AbstractHudPanel<'MomHudGhostEntityPanel'> {}

interface MomHudJumpStats extends AbstractHudPanel<'MomHudJumpStats'> {
	readonly jumpStatsCFG: {
		statsEnable: boolean;
		statsFirstPrint: int32;
		statsInterval: int32;
		statsLog: int32;
		takeoffSpeedEnable: boolean;
		speedDeltaEnable: boolean;
		enviroAccelEnable: boolean;
		takeoffTimeEnable: boolean;
		timeDeltaEnable: boolean;
		strafeSyncEnable: boolean;
		strafeCountEnable: boolean;
		yawRatioEnable: boolean;
		heightDeltaEnable: boolean;
		distanceEnable: boolean;
		efficiencyEnable: boolean;
	};
}

interface MomHudReplayControls extends AbstractHudPanel<'MomHudReplayControls'> {
	hidden: boolean;
}

interface MomHudStickyCharge extends AbstractHudPanel<'MomHudStickyCharge'> {
	readonly stickyChargeUnitType: import('hud/sticky-charge').StickyChargeUnit;
}

interface MomHudStrafeSync extends AbstractHudPanel<'MomHudStrafeSync'> {
	readonly strafesyncType: 0 | 1;
	readonly strafesyncColorize: 0 | 1 | 2;
}

interface MomHudDFJump extends AbstractHudPanel<'MomHudDFJump'> {}

interface MomHudJumpTiming extends AbstractHudPanel<'MomHudJumpTiming'> {}

interface PlayerListPlayer extends AbstractPanel<'PlayerListPlayer'> {
	readonly steamId: steamID;
	readonly isSelf: boolean;
	readonly connected: boolean;
	readonly spectating: boolean;
	readonly spectateWithTarget: steamID;
}

interface MomHudStrafeTrainer extends AbstractHudPanel<'MomHudStrafeTrainer'> {}

interface ZoneEditorRegion {
	region: import('common/web/types/models/models').Region;
	renderMode: import('pages/zoning/zoning').RegionRenderMode;
	editing: boolean;
}

interface ZoneEditorLimits {
	MAX_REGION_POINTS: number;
	MAX_TRACK_SEGMENTS: number;
	MAX_SEGMENT_CHECKPOINTS: number;
	MAX_STAGE_TRACKS: number;
	MAX_BONUS_TRACKS: number;
	MAX_REGIONS: number;
}

interface MomHudSpectate extends AbstractHudPanel<'MomHudSpectate'> {
	steamId: steamID;
	name: string;
	isReplay: boolean;
}

interface ZoneMenu extends AbstractPanel<'ZoneMenu'> {
	createRegion(startZone: boolean): void;

	editRegion(mode: import('pages/zoning/zoning').PickType): void;

	getEntityList(): import('pages/zoning/zoning').EntityList;

	moveToRegion(region: import('common/web/types/models/models').Region): void;

	previewTeleDest(region: import('common/web/types/models/models').Region): void;

	updateEditorRegions(editorRegions: ZoneEditorRegion[]): void;

	validateRegionPolygon(
		points: import('common/web/types/utils/vector.type').Vector2D[],
		closed: boolean
	): import('pages/zoning/zoning').RegionPolygonProblem;

	getZoningLimits(): ZoneEditorLimits;

	createDefaultTeleDest(
		region: import('common/web/types/models/models').Region
	): import('common/web/types/models/models').Region;
}

/**
 * Panel methods responsible for reading and writing HUD config files.
 *
 * C++ side is agnostic to what you pass it, just saves and loads until builtin KV3 <-> JSO mappings.
 *
 * Note that cfg/hud_default.json is stored in the licensee-only game repo, just let someone (probably Tom)
 * know if you need to update it.
 */
interface HudCustomizer extends AbstractPanel<'HudCustomizer'> {
	/**
	 * Enables/disables HUD customizer mode.
	 * Must be in map.
	 * Same as toggling mom_hudcustomizer_open 0/1.
	 * */
	toggleUI(enabled: boolean): void;

	/**
	 * Whether the HUD customizer UI is open.
	 * Precisely, it's whether the input capture is enabled.
	 */
	isOpen(): boolean;

	/** Saves the given object to cfg/hud/{path}.kv3. */
	saveLayout(path: string, data: import('hud/customizer').HudLayout): boolean;

	/** Tries to load file from cfg/hud/{path}.kv3 */
	loadLayout(path: string): import('hud/customizer').HudLayout | null;

	/** Tries to rename a layout file in cfg/hud/ */
	renameLayout(oldPath: string, newPath: string): boolean;

	/** Tries to delete a layout file in cfg/hud */
	deleteLayout(path: string): boolean;

	/** Lists all the filenames in cfg/hud/, omitting extension. */
	listLayouts(): string[];
}
