//--------------------------------------------------------------------------------------------------
// Common place to register new panel type with panorama
//--------------------------------------------------------------------------------------------------

UiToolkitAPI.RegisterPanel2d('Split', 'file://{resources}/layout/components/split.xml');
UiToolkitAPI.RegisterPanel2d('LineGraph', 'file://{resources}/layout/components/graphs/line-graph.xml');
UiToolkitAPI.RegisterPanel2d('LevelIndicator', 'file://{resources}/layout/components/level-indicator.xml');
UiToolkitAPI.RegisterPanel2d('PlayerCard', 'file://{resources}/layout/components/player-card.xml');

UiToolkitAPI.RegisterHUDPanel2d('MomHudTimer', 'file://{resources}/layout/hud/timer.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudStatus', 'file://{resources}/layout/hud/status.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudMapInfo', 'file://{resources}/layout/hud/map-info.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudWeaponSelection', 'file://{resources}/layout/hud/weapon-selection.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudCgaz', 'file://{resources}/layout/hud/cgaz.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudGroundboost', 'file://{resources}/layout/hud/ground-boost.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudDFJump', 'file://{resources}/layout/hud/df-jump.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudJumpStats', 'file://{resources}/layout/hud/jump-stats.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudSpecInfo', 'file://{resources}/layout/hud/spec-info.xml');
UiToolkitAPI.RegisterHUDPanel2d('MomHudSynchronizer', 'file://{resources}/layout/hud/synchronizer.xml');

UiToolkitAPI.RegisterPanel2d('ToastManager', 'file://{resources}/layout/util/toast-manager.xml');
UiToolkitAPI.RegisterPanel2d('ToastGeneric', 'file://{resources}/layout/modals/toasts/generic.xml');
