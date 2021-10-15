'use strict';

//--------------------------------------------------------------------------------------------------
// Purpose: Common place to define new events with panorama. This file is only include by
//          layout/mainmenu.xml ensuring that new events are only registered once with panorama
//
// Usage:   $.DefineEvent( eventName, NumArguments, [optional] ArgumentsDescripton, [optional] Description )
//          $.DefinePanelEvent( eventName, NumArguments, [optional] ArgumentsDescripton, [optional] Description )
//
// Example: $.DefineEvent( 'MyCustomEvent', 2, 'args1, args2', 'Event defined in javascript' )
//
// General documentation about events can be found on
//          https://developer.valvesoftware.com/wiki/Dota_2_Workshop_Tools/Panorama/Events
//
//--------------------------------------------------------------------------------------------------

(function () {
	$.DefineEvent('HideContentPanel', 0, 'no args', 'Hide all the content panels and show the default home dashboard');
	$.DefineEvent('ShowContentPanel', 0, 'no args', 'Show a content panel');
	$.DefineEvent('MainMenuSettings_navigateToSettingPanel', 2, 'category, settingPanel', 'Navigates to a setting by panel handle');
	$.DefineEvent('ReloadBackground', 0, '', 'Reloads the main menu background');
	$.DefineEvent('MainMenuTabShown', 1, 'tabid', 'Alert main menu tabs when they are shown, in case there is a data update needed');
	$.DefineEvent('ExtendDrawer', 0, 'Open the right side drawer panel');
	$.DefineEvent('RetractDrawer', 0, 'Close the right side drawer panel');
	$.DefineEvent('ToggleDrawer', 0, 'Toggle the open or closed state of the right side drawer panel');
	$.DefineEvent('RefreshLobbyList', 0, '', 'Send a refresh request for the lobby list');
	$.DefineEvent('OnLobbyButtonImageChange', 1);
	$.DefineEvent('LoadMapSelector', 0);
})();
