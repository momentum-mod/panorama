"use strict";
//--------------------------------------------------------------------------------------------------
// Common place to define new events with Panorama.
//
// Usage:   $.DefineEvent( eventName, NumArguments, [optional] ArgumentsDescription, [optional] Description )
//          $.DefinePanelEvent( eventName, NumArguments, [optional] ArgumentsDescription, [optional] Description )
//
// Example: $.DefineEvent( 'MyCustomEvent', 2, 'args1, args2', 'Event defined in javascript' )
//
// General documentation about events can be found on
//          https://developer.valvesoftware.com/wiki/Dota_2_Workshop_Tools/Panorama/Events
//
// Whilst Valve would document events by passing documentation strings to C++, which can in turn by output to
// file/console, TypeScript provides us a much better, type-safe way to document events.
//
// To define events without type errors, add a definition to GlobalEventNameMap below, including types for
// the callback.
//
// This is a far superior way to document events, and as such there isn't really any need to provide documentation
// strings to C++ anymore.
//--------------------------------------------------------------------------------------------------
$.DefineEvent('HideMainMenuContentPanel', 0);
$.DefineEvent('ShowMainMenuContentPanel', 0);
$.DefineEvent('ReloadMainMenuBackground', 0);
$.DefineEvent('MainMenuTabShown', 1);
$.DefineEvent('MainMenuTabHidden', 1);
$.DefineEvent('SettingsNavigateToPanel', 2);
$.DefineEvent('SettingsSave', 0);
$.DefineEvent('ExtendDrawer', 0);
$.DefineEvent('RetractDrawer', 0);
$.DefineEvent('ToggleDrawer', 0);
$.DefineEvent('Drawer_UpdateLobbyButton', 2);
$.DefineEvent('Drawer_NavigateToTab', 1);
$.DefineEvent('Drawer_ExtendAndNavigateToTab', 1);
$.DefineEvent('RefreshLobbyList', 0);
$.DefineEvent('Lobby_SetMaxPlayers', 1);
$.DefineEvent('MapSelector_OnLoaded', 0);
$.DefineEvent('MapSelector_ShowConfirmCancelDownload', 1);
$.DefineEvent('HudTabMenu_ForceClose', 0);
$.DefineEvent('ColorPickerSave', 1, 'color');
$.DefineEvent('ColorPickerCancel', 0);
