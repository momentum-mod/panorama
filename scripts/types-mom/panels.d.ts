interface PanelTagNameMap {
	MomentumChat: MomentumChat;
	MomentumMapSelector: MomentumMapSelector;
	MapEntry: MapEntry;
	HudComparisons: HudComparisons;
	MomConcEntityPanel: MomConcEntityPanel;
	MomHudConcCookTime: MomHudConcCookTime;
	MomHudConcEntities: MomHudConcEntities;
	MomHudGhostEntities: MomHudGhostEntities;
	MomHudGhostEntityPanel: MomHudGhostEntityPanel;
}

interface MomentumChat extends AbstractPanel<'MomentumChat'> {
	SubmitText(): void;
}

interface MomentumMapSelector extends AbstractPanel<'MomentumMapSelector'> {
	readonly selectedMapData: Web.MMap;

	ApplyFilters(): void;
}

interface MapEntry extends AbstractPanel<'MapEntry'> {
	readonly mapData: Web.MMap;
}

/** Only doing loose type since liable to change in near future. */
interface HudComparisons extends AbstractHudPanel<'HudComparisons'> {
	readonly currentRunData: any;
	readonly currentRunStats: any;
}

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
