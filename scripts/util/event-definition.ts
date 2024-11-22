/**
 * @file Common place to define new events with Panorama.
 *
 * Usage:   $.DefineEvent( eventName, NumArguments, [optional] ArgumentsDescription, [optional] Description )
 *          $.DefinePanelEvent( eventName, NumArguments, [optional] ArgumentsDescription, [optional] Description )
 *
 * Example: $.DefineEvent( 'MyCustomEvent', 2, 'args1, args2', 'Event defined in javascript' )
 *
 * General documentation about events can be found on
 *          https://developer.valvesoftware.com/wiki/Dota_2_Workshop_Tools/Panorama/Events
 *
 * Whilst Valve would document events by passing documentation strings to C++, which can in turn by output to
 * file/console, TypeScript provides us a much better, type-safe way to document events.
 *
 * To define events without type errors, add a definition to GlobalEventNameMap below, including types for
 * the callback.
 *
 * This is a far superior way to document events, and as such there isn't really any need to provide documentation
 * strings to C++ anymore.
 */

declare interface GlobalEventNameMap {
	ReloadMainMenuBackground: () => void;

	/**	Alert main menu tabs when they are shown, in case there is a data update needed */
	MainMenuTabShown: (tabID: string) => void;

	/** Fired when a main menu tab is closed */
	MainMenuTabHidden: (tabID: string) => void;

	/** Navigates to a setting by panel handle */
	SettingsNavigateToPanel: (tabID: keyof typeof import('common/settings').SettingsTabs, panel: GenericPanel) => void;

	/** Save the settings out to file (host_writeconfig) */
	SettingsSave: () => void;

	/** Open the right side drawer panel */
	ExtendDrawer: () => void;

	/** Close the right side drawer panel */
	RetractDrawer: () => void;

	/** Toggle the open or closed state of the right side drawer panel */
	ToggleDrawer: () => void;

	/** Changes the rightnav lobby button with icon and playercount */
	Drawer_UpdateLobbyButton: (imgSrc: string, playerCount: number) => void;

	/** Open drawer if closed, and switch the tab to the specified tab */
	Drawer_NavigateToTab: (tab: import('pages/drawer/drawer').Tab) => void;

	/** Open drawer if closed, and switch the tab to the specified tab */
	Drawer_ExtendAndNavigateToTab: (tabID: import('pages/drawer/drawer').Tab) => void;

	/** Send a refresh request for the lobby list */
	RefreshLobbyList: () => void;

	/** Sets the max players of your lobby */
	Lobby_SetMaxPlayers: (maxPlayers: number) => void;

	MapSelector_OnLoaded: () => void;

	MapSelector_ShowConfirmCancelDownload: (mapID: number) => void;

	MapSelector_HideLeaderboards: () => void;

	/** Force close the tab menu */
	HudTabMenu_ForceClose: () => void;

	ColorPickerSave: (currColor: rgbaColor) => void;

	ColorPickerCancel: () => void;
}

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
$.DefineEvent('MapSelector_HideLeaderboards', 0);
$.DefineEvent('HudTabMenu_ForceClose', 0);
$.DefineEvent('ColorPickerSave', 1, 'color');
$.DefineEvent('ColorPickerCancel', 0);
