interface PanelTagNameMap {
	MomentumChat: MomentumChat;
	MomentumMapSelector: MomentumMapSelector;
	MapEntry: MapEntry;
	Leaderboards: Leaderboards;
	LeaderboardEntry: LeaderboardEntry;
	RangeColorDisplay: RangeColorDisplay;
	HudComparisons: HudComparisons;
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
	MomHudSyncronizer: MomHudSynchronizer;
	ZoneMenu: ZoneMenu;
}

interface MomentumChat extends AbstractPanel<'MomentumChat'> {
	SubmitText(): void;
}

interface MomentumMapSelector extends AbstractPanel<'MomentumMapSelector'> {
	readonly selectedMapData: MapCacheAPI.MapData;

	applyFilters(totalChange: boolean): void;
	applyBackgroundMapImage(id: string, baseUrl: string): void;
	applyMapImageToImagePanel(imagePanel: Image, id: string, small: boolean, baseUrl: string): void;
}

interface MapEntry extends AbstractPanel<'MapEntry'> {
	readonly mapData: MapCacheAPI.MapData;
	readonly isDownloading: boolean;
}

interface Leaderboards extends AbstractPanel<'Leaderboards'> {
	/** Gets the status of the given times list. 0 means loaded */
	getTimesListStatus(
		type: import('common/leaderboard').LeaderboardType
	): import('common/leaderboard').LeaderboardStatusType;

	/** Applies the currently selected filters to the times list */
	applyFilters(): void;

	selectTrack(trackType: import('common/web').TrackType, trackNum: int32): void;
}

interface LeaderboardEntry extends AbstractPanel<'LeaderboardEntry'> {
	readonly timeData: any;
}

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
	ToggleHiddenState(): void;
}

interface MomHudStickyCharge extends AbstractHudPanel<'MomHudStickyCharge'> {
	readonly stickyChargeUnitType: import('hud/sticky-charge').StickyChargeUnit;
}

interface MomHudStrafeSync extends AbstractHudPanel<'MomHudStrafeSync'> {
	readonly strafesyncType: 0 | 1;
	readonly strafesyncColorize: 0 | 1 | 2;
}

interface MomHudDFJump extends AbstractHudPanel<'MomHudDFJump'> {}

interface MomHudSynchronizer extends AbstractHudPanel<'MomHudSynchronizer'> {}

declare const enum RegionRenderMode {
	NONE = 0,
	START = 1,
	START_WITH_SAFE_HEIGHT = 2,
	TRACK_SWITCH = 3,
	END = 4,
	MAJOR_CHECKPOINT = 5,
	MINOR_CHECKPOINT = 6,
	CANCEL = 7
}

declare const enum RegionPolygonProblem {
	INVALID_INPUT = -1,
	NONE = 0,
	POINTS_TOO_CLOSE = 1,
	ANGLE_TOO_SMALL = 2,
	COLINEAR_POINTS = 3,
	SELF_INTERSECTING = 4
}

interface ZoneEditorRegion {
	region: import('common/web').Region;
	renderMode: RegionRenderMode;
	editing: boolean;
}

interface ZoneEditorLimits {
	MAX_REGION_POINTS: number;
	MAX_TRACK_SEGMENTS: number;
	MAX_SEGMENT_CHECKPOINTS: number;
	MAX_STAGE_TRACKS: number;
	MAX_BONUS_TRACKS: number;
	MAX_ZONES_ALL_TRACKS: number;
}

declare const enum PickType {
	NONE = 0,
	CORNER = 1,
	BOTTOM = 2,
	HEIGHT = 3,
	SAFE_HEIGHT = 4,
	TELE_DEST_POS = 5,
	TELE_DEST_YAW = 6
}

interface ZoneMenu extends AbstractPanel<'ZoneMenu'> {
	startPointPick(mode: PickType): void;

	getEntityList(): import('pages/zoning/zoning').EntityList;

	setCornersFromRegion(region: import('common/web').Region): void;

	moveToRegion(region: import('common/web').Region): void;

	drawRegions(editorRegions: ZoneEditorRegion[]): void;

	validateRegionPolygon(points: import('common/web').Vector2D[], closed: boolean): RegionPolygonProblem;

	getZoningLimits(): ZoneEditorLimits;
}
