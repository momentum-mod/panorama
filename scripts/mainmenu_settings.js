"use strict";

class MainMenuSettings {
    
    static settingsTabs = {
        InputSettings: {
			xml: 'settings_input',
			radioid: 'InputRadio'
		},
        AudioSettings: {
			xml: 'settings_audio',
			radioid: 'AudioRadio'
		},
        VideoSettings: {
			xml: 'settings_video',
			radioid: "VideoRadio"
		},
        OnlineSettings: {
			xml: 'settings_online',
			radioid: 'OnlineRadio'
		},
        GameplaySettings: {
			xml: 'settings_gameplay',
			radioid: 'GameplayRadio'
		},
        HUDSettings: {
			xml: 'settings_hud',
			radioid: 'HudRadio'
		},
        SearchSettings: {
			xml: 'settings_search'
		}
    }

	static activeTab = null;
	
	static navigateToTab(tab) {
        const parentPanel = $('#SettingsMenuContent');

        // Check to see if tab to show  exists.
        // If not load the xml file.
        if (!parentPanel.FindChildInLayoutFile(tab)) {
            const newPanel = $.CreatePanel('Panel', parentPanel, tab);
            $.Msg( 'Created Panel with id: ' + newPanel.id );

            newPanel.LoadLayout('file://{resources}/layout/settings/' + MainMenuSettings.settingsTabs[tab].xml + '.xml', false, false );
            
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

            MainMenuSettings.styleAlternatingItems();

            SettingsMenuShared.newTabOpened( MainMenuSettings.activeTab );
        }	
	}

    static navigateToSettingPanel( tab, panel )
    {
		$.DispatchEvent("Activated", $("#" + MainMenuSettings.settingsTabs[tab].radioid ), "mouse");
        panel.ScrollParentToMakePanelFit( 3, false );
        panel.SetFocus();
        panel.AddClass( 'Highlight' );
        var kfs = panel.CreateCopyOfCSSKeyframes( 'settings-highlight' );
        panel.UpdateCurrentAnimationKeyframes( kfs )
    }

    static isSettingsPanel ( panel )
    {
        return (['ChaosSettingsEnum', 'ChaosSettingsSlider', 'ChaosSettingsEnumDropDown', 'ChaosSettingsKeyBinder', 'ChaosSettingsToggle', 'ConVarColorDisplay']
            .includes( panel.paneltype )); 
    }
    
	static styleAlternatingItems() {
		$( '#SettingsMenuContent' ).FindChildrenWithClassTraverse( 'settings-group' ).forEach( group => {
			var n = 0;
			group.Children().forEach( item => {
				if ( item.paneltype === 'TooltipPanel' )
					item.Children().forEach( subitem => styleItem( subitem ));
				else styleItem( item );
				
				function styleItem( panel )
				{
					if (MainMenuSettings.isSettingsPanel( panel ) )
					{
						n++;
						n % 2 == 0 ? item.AddClass( 'even-row' ) : item.AddClass( 'odd-row' );
					}
				}
			});
		});
    }
}

//--------------------------------------------------------------------------------------------------
// Entry point called when panel is created
//--------------------------------------------------------------------------------------------------
(function() {
    // Load in every tab. This is necessary for search to work, using the same silly technique that CS:GO does.
    // Maybe worth moving initial loading from file into its own function?
    for (let tab in MainMenuSettings.settingsTabs) {
        if (tab != MainMenuSettings.settingsTabs.SearchSettings) {
            MainMenuSettings.navigateToTab(tab);
        }
    }

	MainMenuSettings.navigateToTab("InputSettings");
    $.RegisterEventHandler( 'LayoutReloaded', $('#SettingsMenuContent'), () => SettingsMenuShared.newTabOpened( MainMenuSettings.activeTab ) );
})();