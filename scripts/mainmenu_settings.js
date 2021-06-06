"use strict";

class MainMenuSettings {
	static activeTab = null;
	
	static navigateToTab(tab, xmlName) {
        const parentPanel = $('#SettingsMenuContent');

        // Check to see if tab to show  exists.
        // If not load the xml file.
        if (!parentPanel.FindChildInLayoutFile(tab)) {
            const newPanel = $.CreatePanel('Panel', parentPanel, tab);
            $.Msg( 'Created Panel with id: ' + newPanel.id );

            newPanel.LoadLayout('file://{resources}/layout/settings/' + xmlName + '.xml', false, false );
            
            // Handler that catches OnPropertyTransitionEndEvent event for this panel.  
            // Check if the panel is transparent then collapse it. 
            newPanel.OnPropertyTransitionEndEvent = function ( panelName, propertyName ) {
                if( newPanel.id === panelName && propertyName === 'opacity') {
                    // Panel is visible and fully transparent
                    if( newPanel.visible === true && newPanel.IsTransparent() ) {
                        // Set visibility to false and unload resources
                        newPanel.visible = false;
                        newPanel.SetReadyForDisplay( false );
                        return true;
                    }
                }

                return false;
            }

            $.RegisterEventHandler( 'PropertyTransitionEnd', newPanel, newPanel.OnPropertyTransitionEndEvent );
  
            // Start the new panel off as invisible, and decide a bit further on if we want to display it or not
            newPanel.visible = false;
        }

		//If a we have a active tab and it is different from the selected tab hide it.
		//Then show the selected tab
        if( MainMenuSettings.activeTab !==  tab ) {
            // If the tab exists then hide it
            if( MainMenuSettings.activeTab ) {
                const panelToHide = $.GetContextPanel().FindChildInLayoutFile( MainMenuSettings.activeTab );
                panelToHide.RemoveClass( 'Active' ); 
            // $.Msg( 'HidePanel: ' + activeTab  );
            }
            
            //Show selected tab
            const prevTab = MainMenuSettings.activeTab;
            MainMenuSettings.activeTab = tab;
            const activePanel = $.GetContextPanel().FindChildInLayoutFile( tab );
            activePanel.AddClass( 'Active' );

            // Force a reload of any resources since we're about to display the panel
			activePanel.visible = true;
			activePanel.SetReadyForDisplay( true );

            SettingsMenuShared.newTabOpened( MainMenuSettings.activeTab );
        }	
	}
}

//--------------------------------------------------------------------------------------------------
// Entry point called when panel is created
//--------------------------------------------------------------------------------------------------
(function() {
	MainMenuSettings.navigateToTab("InputSettings", "settings_input");
})();
