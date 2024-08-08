//--------------------------------------------------------------------------------------------------
// Common place to register new panel type with Panorama
//
// When registering, add an entry to PanelTagNameMap and define the interface for the panel.
// If the panel attaches its JS class to its context panel, be sure to add a jsClass property to the interface.
//--------------------------------------------------------------------------------------------------

interface PanelTagNameMap {
	Split: Split;
	LineGraph: LineGraph;
	LevelIndicator: LevelIndicator;
	PlayerCard: PlayerCard;
	MomHudTimer: MomHudTimer;
	MomHudStatus: MomHudStatus;
	MomHudMapInfo: MomHudMapInfo;
	MomHudWeaponSelection: MomHudWeaponSelection;
	MomHudCgaz: MomHudCgaz;
	MomHudGroundboost: MomHudGroundboost;
	MomHudDFJump: MomHudDFJump;
	MomHudJumpStats: MomHudJumpStats;
	MomHudSpecInfo: MomHudSpecInfo;
	MomHudSynchronizer: MomHudSynchronizer;
	MomHudPowerupTimer: MomHudPowerupTimer;
	ToastContainer: ToastContainer;
	ToastGeneric: ToastGeneric;
}

declare interface PlayerCard extends AbstractPanel<'PlayerCard'> {
	jsClass: typeof PlayerCard;
}
UiToolkitAPI.RegisterPanel2d('PlayerCard', 'file://{resources}/layout/components/player-card.xml');

declare interface LevelIndicator extends AbstractPanel<'LevelIndicator'> {
	jsClass: typeof LevelIndicator;
	level: number;
}
UiToolkitAPI.RegisterPanel2d('LevelIndicator', 'file://{resources}/layout/components/level-indicator.xml');

declare interface LineGraph extends AbstractPanel<'LineGraph'> {
	jsClass: typeof LineGraph.Component;
}
UiToolkitAPI.RegisterPanel2d('LineGraph', 'file://{resources}/layout/components/graphs/line-graph.xml');

declare interface Split extends AbstractPanel<'Split'> {
	name: string;
	time: number;
	isFirst: boolean;
	diff: number;
	delta: number;
}
UiToolkitAPI.RegisterPanel2d('Split', 'file://{resources}/layout/components/split.xml');

declare interface ToastContainer extends AbstractPanel<'ToastContainer'> {}
UiToolkitAPI.RegisterPanel2d('ToastManager', 'file://{resources}/layout/util/toast-manager.xml');

declare interface ToastGeneric extends AbstractPanel<'ToastGeneric'> {}
UiToolkitAPI.RegisterPanel2d('ToastGeneric', 'file://{resources}/layout/modals/toasts/generic.xml');

declare interface MomHudTimer extends AbstractHudPanel<'MomHudTimer'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudTimer', 'file://{resources}/layout/hud/timer.xml');

declare interface MomHudStatus extends AbstractHudPanel<'MomHudStatus'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudStatus', 'file://{resources}/layout/hud/status.xml');

declare interface MomHudMapInfo extends AbstractHudPanel<'MomHudMapInfo'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudMapInfo', 'file://{resources}/layout/hud/map-info.xml');

declare interface MomHudWeaponSelection extends AbstractHudPanel<'MomHudWeaponSelection'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudWeaponSelection', 'file://{resources}/layout/hud/weapon-selection.xml');

declare interface MomHudCgaz extends AbstractHudPanel<'MomHudCgaz'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudCgaz', 'file://{resources}/layout/hud/cgaz.xml');

declare interface MomHudGroundboost extends AbstractHudPanel<'MomHudGroundboost'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudGroundboost', 'file://{resources}/layout/hud/ground-boost.xml');

declare interface MomHudDFJump extends AbstractHudPanel<'MomHudDFJump'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudDFJump', 'file://{resources}/layout/hud/df-jump.xml');

declare interface MomHudJumpStats extends AbstractHudPanel<'MomHudJumpStats'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudJumpStats', 'file://{resources}/layout/hud/jump-stats.xml');

declare interface MomHudSpecInfo extends AbstractHudPanel<'MomHudSpecInfo'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudSpecInfo', 'file://{resources}/layout/hud/spec-info.xml');

declare interface MomHudSynchronizer extends AbstractHudPanel<'MomHudSynchronizer'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudSynchronizer', 'file://{resources}/layout/hud/synchronizer.xml');

declare interface MomHudPowerupTimer extends AbstractHudPanel<'MomHudPowerupTimer'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudPowerupTimer', 'file://{resources}/layout/hud/powerup-timer.xml');
