"use strict";

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

( function() {
    $.DefineEvent( 'SidebarContextMenuActive', 1, 'bActive', 'Let the sidebar panel know if a context menu is active on a section of it.' );
    $.DefineEvent( 'SidebarIsCollapsed', 1, 'bActive', 'Is sidebar collapsed.' );
    $.DefineEvent( 'InventoryItemPreview', 1, 'itemId', 'Just itemid' );
    $.DefineEvent( 'LootlistItemPreview', 2, 'itemId', 'typeParams', 'Requesting an item preview popup for the given item id. typeParams, caseid, key id' );
    $.DefineEvent( 'HideContentPanel', 0, 'no args', 'Hide all the content panels and show the default home dashboard' );
    $.DefineEvent( 'ShowContentPanel', 0, 'no args', 'Show a content panel' );
    $.DefineEvent( 'InitAvatar', 2, 'xuid, type of panel', 'Update the avatar panel data for a xuid' );
    $.DefineEvent( 'UpdateVanityModelData', 0, 'no args', 'Update the vanity model with list of anims and model panel from updated settings' );
    $.DefineEvent( 'OpenPlayMenu', 0, 'no args', 'opens the play menu from anywhere. EXAMPLE from party menu settings button from client' );
    $.DefineEvent( 'OpenInventory', 0, 'no args', 'opens the inventory menu from anywhere.' );
    $.DefineEvent( 'OpenWatchMenu', 0, 'no args', 'opens the watch menu from anywhere.' );
    $.DefineEvent( 'OpenSidebarPanel', 0, 'no args', 'open the sidebar from a abutton click from anywhere' );
    $.DefineEvent( 'StartDecodeableAnim', 0, 'no args', 'tells the decode panel to play the animation' );

    $.DefineEvent( 'EndOfMatch_ShowNext', 0, '', "Notify the EndOfMatch controller to proceed to the next panel." );
    $.DefineEvent( 'StreamPanelClosed', 0, '', "Notify that user has closed stream panel" );

    $.DefineEvent( 'Scoreboard_CycleStats', 0, '', "Cycle the stats." );

    $.DefineEvent( 'Scoreboard_GetFreeForAllTopThreePlayers', 0, '', "Returns top three players on team 'ANY'" );
    $.DefineEvent( 'EndOfMatch_GetFreeForAllTopThreePlayers_Response', 3, 'first, second, third', "Callback for Scoreboard_GetFreeForAllTopThreePlayers" );
    $.DefineEvent( 'Scoreboard_GetFreeForAllPlayerPosition', 1, 'xuid', "Given a player index and an xuid, returns top three players on that player's team" );
    $.DefineEvent( 'EndOfMatch_GetFreeForAllPlayerPosition_Response', 1, 'position', "Callback for Scoreboard_GetFreeForAllPlayerPosition" );
    //DEVONLY{
    $.DefineEvent( 'Scoreboard_SetMuteAbusive', 1, 'newVal', "set cl_mute_frequent_abusers" );
    //}DEVONLY
    $.DefineEvent( 'Scoreboard_UnborrowMusicKit', 0, '', "Cancel Music Kit borrowing" );

    $.DefineEvent( 'Scoreboard_Casualties_OnMouseOver', 0, '', '' );
    $.DefineEvent( 'Scoreboard_Casualties_OnMouseOut', 0, '', '' );
    $.DefineEvent( 'ShowAcceptPopup', 1, 'popup', 'Fired when accept match popup is shown.' );
    $.DefineEvent( 'CloseAcceptPopup', 0, '', 'Fired when accept match popup Closes.' );

    $.DefineEvent( 'ShowTournamentStore', 0, '', 'Show tournament store popup' );
    $.DefineEvent( 'AddItemToCart', 1, 'itemID', 'Add an itemid to tournament store shopping cart' );
    $.DefineEvent( 'RemoveItemFromCart', 1, 'itemID', 'Remove an item of this id from the tournament store shopping cart' );

    $.DefineEvent( 'CloseSubMenuContent', 0, 'no args', 'Closes up the submenu panel' );
    $.DefineEvent( 'NavigateToTab', 4, 'tab name, xml name, If its a tab, if you should add to stack', 'Closes up the submenu panel' );
    $.DefineEvent( 'ReloadBackground', 0, '', 'Reloads the main menu background')
    //$.DefineEvent( 'PopulateTournamentsPage', 2, 'TournamentID', 'tab' , 'Populates tab of given tournament');
    $.DefineEvent( 'InitializeTournamentsPage', 1, 'tournament ID', 'Loads the layout for a given tournament for active tournament tab' );
    $.DefineEvent( 'ShowActiveTournamentPage', 1, 'tab to show id', 'Opens active tournament page in the watch panel' );
    $.DefineEvent( 'RefreshPickemPage', 1, 'tournament ID', 'refreshed pickem data' );

    //$.DefineEvent( 'PopulateTournamentNavBarButtons', 2, 'TournamentID', 'tab' , 'Populates nav bar of given tournament');
    //$.DefineEvent( 'SetUpTournamentPageText', 3, 'TournamentID', 'tab', 'tab name', 'Sets up tournament page text');
    $.DefineEvent( 'FriendInvitedFromContextMenu', 1, 'xuid', 'invite friend from the playercard. Make the invite anim snow immediately instead of waiting for the callback that can take a long time.' );
    $.DefineEvent( 'CapabilityPopupIsOpen', 1, 'bActive', 'User is using the name tag or opening a case, or stickering.  Using one of the capabilites' );
    $.DefineEvent( 'ShowSelectItemForCapabilityPopup', 3, 'capability, itemid, itemid2', 'Show popup in Inventory that allow you to select a second item for a capability that requires 2 items' );
    $.DefineEvent( 'HideSelectItemForCapabilityPopup', 0, '', 'Hide this popup in inventory' );
    $.DefineEvent( 'ShowLoadoutForItem', 3, 'slot', 'subslot', 'team', 'Open loadout panel for an item' );
    $.DefineEvent( 'ShowAcknowledgePopup', 2, 'updatetype, itemid', 'show acknowledge popup, also takes params for when an item is updated but does not need to be acknowledged like after using a nametag' );
    $.DefineEvent( 'RefreshActiveInventoryList', 0, '', 'Make the active list get the items in it' );
    $.DefineEvent( 'ShowDeleteItemConfirmationPopup', 1, 'itemid', 'When a user is trying to delete an item from inventory' );
    $.DefineEvent( 'ShowUseItemOnceConfirmationPopup', 1, 'itemid', 'When a user is trying to use an item from inventory that can be used once' );
    $.DefineEvent( 'ShowResetMusicVolumePopup', 1, 'itemid', 'When a user is trying to equip a musickit but has thier music volume off from inventory' );
    $.DefineEvent( 'ShowTradeUpPanel', 0, '', 'Show trade up panel' );
    $.DefineEvent( 'UpdateTradeUpPanel', 0, '', 'Update trade up panel' );
    $.DefineEvent( 'MainMenuTabShown', 1, 'tabid', 'Alert main menu tabs when they are shown, in case there is a data update needed' );
} )();