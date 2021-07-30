"use strict";

class MainMenuDrawer {

    static drawerTabs = {
        ProfileDrawer: 'drawer_profile',
        LobbyDrawer: 'drawer_lobby',
        StatsDrawer: 'drawer_stats',
        ChangelogDrawer: 'drawer_changelog'
    }

    static activeTab;

    static isExtended = false;

    static navigateToTab(tab) {
        const parentPanel = $('#MainMenuDrawerContent');
        $.Msg('parent: ' + parentPanel.id);

        // Check to see if tab to show exists.
        // If not load the xml file.
        if (!parentPanel.FindChildInLayoutFile(tab)) {
            const newPanel = $.CreatePanel('Panel', parentPanel, tab);
            newPanel.LoadLayout('file://{resources}/layout/drawer/' + MainMenuDrawer.drawerTabs[tab] + '.xml', false, false );
        }

        // UNDONE: Transition?


        //If a we have a active tab and it is different from the selected tab hide it.
        //Then show the selected tab
        if( MainMenuDrawer.activeTab !== tab ) {
            // If the tab exists then hide it
            if( MainMenuDrawer.activeTab !== undefined ) {
                const panelToHide = $.GetContextPanel().FindChildInLayoutFile( MainMenuDrawer.activeTab );
                panelToHide.RemoveClass( 'Active' );
            }

            //Show selected tab
            MainMenuDrawer.activeTab = tab;
            const activePanel = $.GetContextPanel().FindChildInLayoutFile( tab );
            activePanel.AddClass( 'Active' );

            // Force a reload of any resources since we're about to display the panel
            activePanel.visible = true;
            activePanel.SetReadyForDisplay( true );
        }
    }

    static extendDrawer()
    {
        let panel = $("#MainMenuDrawerPanel");
        panel.AddClass('LeftMoving')
        var kfs = panel.CreateCopyOfCSSKeyframes( 'drawer_move_left' );
        panel.UpdateCurrentAnimationKeyframes(kfs);
        MainMenuDrawer.isExtended = true;

        SteamLobbyAPI.RefreshList({'this_is_where_filters_will_go_in_the_future' : 'true'});
    }

    static retractDrawer()
    {
        let panel = $("#MainMenuDrawerPanel");
        panel.AddClass('RightMoving')
        var kfs = panel.CreateCopyOfCSSKeyframes( 'drawer_move_right' );
        panel.UpdateCurrentAnimationKeyframes(kfs);
        MainMenuDrawer.isExtended = false;
    }

    static toggleDrawer()
    {
        if (MainMenuDrawer.isExtended)
        {
            MainMenuDrawer.retractDrawer();
        }
        else
        {
            MainMenuDrawer.extendDrawer();
        }
    }

    static extendAndSwitch(tab)
    {
        MainMenuDrawer.navigateToTab(tab);
        if (!MainMenuDrawer.isExtended)
            MainMenuDrawer.extendDrawer();
    }

    static setLobbyButtonImage(path)
    {
        $('#LobbyButtonImage').SetImage(path);
    }

}

//--------------------------------------------------------------------------------------------------
// Entry point called when panel is created
//--------------------------------------------------------------------------------------------------
(function() {
    MainMenuDrawer.navigateToTab("LobbyDrawer");
    $.RegisterEventHandler('OnLobbyButtonImageChange', $.GetContextPanel(), MainMenuDrawer.setLobbyButtonImage)
})();