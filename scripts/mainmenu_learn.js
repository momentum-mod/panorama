"use strict";

class MainMenuLearn {

    static learnTabs = {
        SurfLearning: {
            xml: 'learning_surf',
            radioid: 'SurfRadio'
        },
        BhopLearning: {
            xml: 'learning_bhop',
            radioid: 'BhopRadio'
        },
        RJLearning: {
            xml: 'learning_rj',
            radioid: "RJRadio"
        },
        SJLearning: {
            xml: 'learning_sj',
            radioid: 'SJRadio'
        },
        AhopLearning: {
            xml: 'learning_ahop',
            radioid: 'AhopRadio'
        },
        ParkourLearning: {
            xml: 'learning_parkour',
            radioid: 'ParkourRadio'
        },
        ConcLearning: {
            xml: 'learning_conc',
            radioid: 'ConcRadio'
        },
        ClimbLearning: {
            xml: 'learning_climb',
            radioid: 'ClimbRadio'
        },
        TricksurfLearning: {
            xml: 'learning_tricksurf',
            radioid: 'TricksurfRadio'
        },
        DefragLearning: {
            xml: 'learning_defrag',
            radioid: 'DefragRadio'
        },
        SearchSettings: {
            xml: 'learning_search'
        }
    }

    static activeTab = null;
    
    static navigateToTab(tab) {
        const parentPanel = $('#LearningMenuContent');

        // Check to see if tab to show  exists.
        // If not load the xml file.
        if (!parentPanel.FindChildInLayoutFile(tab)) {
            const newPanel = $.CreatePanel('Panel', parentPanel, tab);
            $.Msg( 'Created Panel with id: ' + newPanel.id );

            newPanel.LoadLayout('file://{resources}/layout/learn/' + MainMenuLearn.learnTabs[tab].xml + '.xml', false, false );
            
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
        if( MainMenuLearn.activeTab !==  tab ) {
            // If the tab exists then hide it
            if( MainMenuLearn.activeTab ) {
                const panelToHide = $.GetContextPanel().FindChildInLayoutFile( MainMenuLearn.activeTab );
                panelToHide.RemoveClass( 'Active' ); 
            // $.Msg( 'HidePanel: ' + activeTab  );
            }
            
            //Show selected tab
            const prevTab = MainMenuLearn.activeTab;
            MainMenuLearn.activeTab = tab;
            const activePanel = $.GetContextPanel().FindChildInLayoutFile( tab );
            activePanel.AddClass( 'Active' );

            // Force a reload of any resources since we're about to display the panel
            activePanel.visible = true;
            activePanel.SetReadyForDisplay( true );

            MainMenuLearn.styleAlternatingItems();

            // Settings.newTabOpened( MainMenuLearn.activeTab );
        }	
    }

    // static navigateToSettingPanel( tab, panel )
    // {
    //     $.DispatchEvent("Activated", $("#" + MainMenuLearn.learnTabs[tab].radioid ), "mouse");
    //     panel.ScrollParentToMakePanelFit( 3, false );
    //     panel.SetFocus();
    //     panel.AddClass( 'Highlight' );
    //     var kfs = panel.CreateCopyOfCSSKeyframes( 'settings-highlight' );
    //     panel.UpdateCurrentAnimationKeyframes( kfs )
    // }

    static isSettingsPanel ( panel )
    {
        return (['ChaosSettingsEnum', 'ChaosSettingsSlider', 'ChaosSettingsEnumDropDown', 'ChaosSettingsKeyBinder', 'ChaosSettingsToggle']
            .includes( panel.paneltype )); 
    }
    
    static styleAlternatingItems() {
        $( '#LearningMenuContent' ).FindChildrenWithClassTraverse( 'settings-group' ).forEach( group => {
            var n = 0;
            group.Children().forEach( item => {
                if ( item.paneltype === 'TooltipPanel' )
                    item.Children().forEach( subitem => styleItem( subitem ));
                else styleItem( item );
                
                function styleItem( panel )
                {
                    if (MainMenuLearn.isSettingsPanel( panel ) )
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
    for (let tab in MainMenuLearn.learnTabs) {
        if (tab != MainMenuLearn.learnTabs.SearchSettings) {
            MainMenuLearn.navigateToTab(tab);
        }
    }

    MainMenuLearn.navigateToTab("SurfLearning");
})();