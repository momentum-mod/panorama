/**
 * Common place to register new panel type with Panorama. Do NOT use it for panels declared in C++ already!!!
 *
 * When registering, add an entry to PanelTagNameMap and define the interface for the panel.
 * If the panel attaches its JS class to its context panel, be sure to add a handler property to the interface.
 *
 * NOTE: This file is "ambient", which means types declared here are available globally without imports, same as in the
 * `types` directory. Top-level imports must NOT be used, you'll break types all over the place if you do.
 * For imports, use import('<foo>'). It's ugly, sorry!
 */

declare interface PanelTagNameMap {
	LineGraph: LineGraph;
	LevelIndicator: LevelIndicator;
	PlayerCard: PlayerCard;
	MomHudTimer: MomHudTimer;
	MomHudStatus: MomHudStatus;
	MomHudMapInfo: MomHudMapInfo;
	MomHudWeaponSelection: MomHudWeaponSelection;
	MomHudDefrag: MomHudDefrag;
	MomHudGroundboost: MomHudGroundboost;
	MomHudDFJump: MomHudDFJump;
	MomHudJumpStats: MomHudJumpStats;
	MomHudJumpTiming: MomHudJumpTiming;
	MomHudSpecInfo: MomHudSpecInfo;
	MomHudStrafeTrainer: MomHudStrafeTrainer;
	MomHudPowerupTimer: MomHudPowerupTimer;
	MomHudSafeguardIndicator: MomHudSafeguardIndicator;
	ToastContainer: ToastContainer;
	ToastGeneric: ToastGeneric;
	Gallery: Gallery;
}

declare interface PlayerCard extends AbstractPanel<'PlayerCard'> {
	handler: import('components/player-card').PlayerCardHandler;
}
UiToolkitAPI.RegisterPanel2d('PlayerCard', 'file://{resources}/layout/components/player-card.xml');

declare interface LevelIndicator extends AbstractPanel<'LevelIndicator'> {
	handler: import('components/level-indicator').LevelIndicatorHandler;
}
UiToolkitAPI.RegisterPanel2d('LevelIndicator', 'file://{resources}/layout/components/level-indicator.xml');

declare interface LineGraph extends AbstractPanel<'LineGraph'> {
	handler: import('components/graphs/line-graph').LineGraphHandler;
}
UiToolkitAPI.RegisterPanel2d('LineGraph', 'file://{resources}/layout/components/graphs/line-graph.xml');

// Loaded using ShowCustomLayoutPopup
declare interface Gallery extends AbstractPanel<'Gallery'> {
	handler: import('components/gallery').GalleryHandler;
}

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

declare interface MomHudDefrag extends AbstractHudPanel<'MomHudDefrag'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudDefrag', 'file://{resources}/layout/hud/df-hud.xml');

declare interface MomHudGroundboost extends AbstractHudPanel<'MomHudGroundboost'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudGroundboost', 'file://{resources}/layout/hud/ground-boost.xml');

declare interface MomHudSpecInfo extends AbstractHudPanel<'MomHudSpecInfo'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudSpecInfo', 'file://{resources}/layout/hud/spec-info.xml');

declare interface MomHudPowerupTimer extends AbstractHudPanel<'MomHudPowerupTimer'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudPowerupTimer', 'file://{resources}/layout/hud/powerup-timer.xml');

declare interface MomHudSafeguardIndicator extends AbstractHudPanel<'MomHudSafeguardIndicator'> {}
UiToolkitAPI.RegisterHUDPanel2d('MomHudSafeguardIndicator', 'file://{resources}/layout/hud/safeguard-indicator.xml');
