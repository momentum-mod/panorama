'use strict';

//--------------------------------------------------------------------------------------------------
// Purpose: Common place to register new panel type with panorama
//--------------------------------------------------------------------------------------------------

(function () {
	UiToolkitAPI.RegisterPanel2d('Split', 'file://{resources}/layout/components/split.xml');
	UiToolkitAPI.RegisterPanel2d('LineGraph', 'file://{resources}/layout/components/graphs/linegraph.xml');
	UiToolkitAPI.RegisterPanel2d('LevelIndicator', 'file://{resources}/layout/components/level_indicator.xml');
	UiToolkitAPI.RegisterPanel2d('PlayerCard', 'file://{resources}/layout/components/player_card.xml');

	// Perf tests
	UiToolkitAPI.RegisterPanel2d(
		'ChaosPerfTestsJsMultipleContexts',
		'file://{resources}/layout/tests/perf/perf_jsmultiplecontexts.xml'
	);
	UiToolkitAPI.RegisterPanel2d(
		'ChaosPerfTestsJsSingleContext',
		'file://{resources}/layout/tests/perf/perf_jssinglecontext.xml'
	);
	UiToolkitAPI.RegisterPanel2d('ChaosPerfTestsTypeSafety', 'file://{resources}/layout/tests/perf/type_safety.xml');

	// Test for the controls library
	UiToolkitAPI.RegisterPanel2d('ControlLibTestPanel', 'file://{resources}/layout/tests/controllibtestpanel.xml');

	UiToolkitAPI.RegisterHUDPanel2d('MomHudTimer', 'file://{resources}/layout/hud/timer.xml');
	UiToolkitAPI.RegisterHUDPanel2d('MomHudStatus', 'file://{resources}/layout/hud/status.xml');
	UiToolkitAPI.RegisterHUDPanel2d('MomHudMapInfo', 'file://{resources}/layout/hud/mapinfo.xml');
	UiToolkitAPI.RegisterHUDPanel2d('MomHudWeaponSelection', 'file://{resources}/layout/hud/weaponselection.xml');
	UiToolkitAPI.RegisterHUDPanel2d('MomHudCgaz', 'file://{resources}/layout/hud/cgaz.xml');
	UiToolkitAPI.RegisterHUDPanel2d('MomHudSpecInfo', 'file://{resources}/layout/hud/specinfo.xml');
	UiToolkitAPI.RegisterHUDPanel2d('MomHudSynchronizer', 'file://{resources}/layout/hud/synchronizer.xml');

	UiToolkitAPI.RegisterPanel2d('ToastManager', 'file://{resources}/layout/toast/toast_manager.xml');
	UiToolkitAPI.RegisterPanel2d('ToastGeneric', 'file://{resources}/layout/toast/toast_generic.xml');
})();
