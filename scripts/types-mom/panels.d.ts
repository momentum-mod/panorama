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
	readonly selectedMapData: import('common/web').MMap;

	ApplyFilters(): void;
}

interface MapEntry extends AbstractPanel<'MapEntry'> {
	readonly mapData: import('common/web').MMap;
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

interface ZoneMenu extends AbstractPanel<'ZoneMenu'> {
	startPointPick(multiPick: boolean): void;

	getEntityList(): import('pages/zoning/zoning').EntityList;

	setCornersFromRegion(region: import('common/web').Region): void;
}
