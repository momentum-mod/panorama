"use strict";

//--------------------------------------------------------------------------------------------------
// Header Tab navigation and xml loading
//--------------------------------------------------------------------------------------------------

class MainMenuController {

	static activeTab = '';
	static contentPanel = $( '#JsMainMenuContent' );
	static playedInitialFadeUp = false;


	static onInitFadeUp()
	{
		if( !MainMenuController.playedInitialFadeUp )
		{
			$( '#MainMenuContainerPanel' ).TriggerClass( 'show' );
			MainMenuController.playedInitialFadeUp = true;
		}
	};

	static onShowMainMenu()
	{
		MainMenuController.onInitFadeUp();
	};


	static onHideMainMenu()
	{
		$.Msg("Hide main menu");

		UiToolkitAPI.CloseAllVisiblePopups();
	};

	static onShowPauseMenu()
	{
		$.GetContextPanel().AddClass( 'MainMenuRootPanel--PauseMenuMode' );
	};

	static onHidePauseMenu()
	{
		$.GetContextPanel().RemoveClass( 'MainMenuRootPanel--PauseMenuMode' );

		this.onHomeButtonPressed();
	};

	static checkTabCanBeOpenedRightNow(tab )
	{
		return true;
	}

	static navigateToTab( tab, XmlName )
	{
		$.Msg( 'tabToShow: ' + tab + ' XmlName = ' + XmlName  );
		$.Msg( 'ContextPANEL: ' + $.GetContextPanel().id );

		if ( !this.checkTabCanBeOpenedRightNow( tab ) )
		{
			this.onHomeButtonPressed();
			return;	// validate that tabs can be opened (GC connection / China free-to-play / etc.)
		}

		//$.DispatchEvent('PlayMainMenuMusic', true, false, null );

		// Turn off ambient sound on movies.
		GameInterfaceAPI.SetSettingString( 'panorama_play_movie_ambient_sound', '0' );

		// Check to see if tab to show exists.
		// If not load the xml file.
		if( !$.GetContextPanel().FindChildInLayoutFile( tab ) )
		{
			const newPanel = $.CreatePanel('Panel', this.contentPanel, tab);

			newPanel.Data().elMainMenuRoot = $.GetContextPanel();
			$.Msg( 'Created Panel with id: ' + newPanel.id );

			newPanel.LoadLayout('file://{resources}/layout/' + XmlName + '.xml', false, false );
			newPanel.RegisterForReadyEvents( true );
			
			// Handler that catches OnPropertyTransitionEndEvent event for this panel.
			// Check if the panel is transparent then collapse it. 
			newPanel.OnPropertyTransitionEndEvent = function ( panelName, propertyName )
			{
				if( newPanel.id === panelName && propertyName === 'opacity' )
				{
					// Panel is visible and fully transparent
					if( newPanel.visible === true && newPanel.IsTransparent() )
					{
						// Set visibility to false and unload resources
						newPanel.visible = false;
						newPanel.SetReadyForDisplay( false );
						return true;
					}
					else if ( newPanel.visible === true )
					{
						$.DispatchEvent( 'MainMenuTabShown', tab );
					}
				}

				return false;
			};

			$.RegisterEventHandler( 'PropertyTransitionEnd', newPanel, newPanel.OnPropertyTransitionEndEvent );
		}
		
		// If a we have a active tab and it is different from the selected tab hide it.
		// Then show the selected tab
		if( MainMenuController.activeTab !== tab )
		{
			//Trigger sound event for the new panel
			if(XmlName) {
				$.DispatchEvent('PlaySoundEffect', 'tab_' + XmlName.replace('/', '_'), 'MOUSE');
			}
			
			// If the tab exists then hide it
			if( this.activeTab )
			{
				const panelToHide = $.GetContextPanel().FindChildInLayoutFile(m_activeTab);
				panelToHide.AddClass( 'mainmenu-content--hidden' );

				$.Msg( 'HidePanel: ' + m_activeTab  );
			}
			
			//Show selected tab
			MainMenuController.activeTab = tab;
			const activePanel = $.GetContextPanel().FindChildInLayoutFile(tab);
			activePanel.RemoveClass( 'mainmenu-content--hidden' );

			// Force a reload of any resources since we're about to display the panel
			activePanel.visible = true;
			activePanel.SetReadyForDisplay( true );
			$.Msg( 'ShowPanel: ' + MainMenuController.activeTab );

		}

		this.showContentPanel();
	};


	static showContentPanel()
	{
		if ( this.contentPanel.HasClass( 'mainmenu-content--offscreen' ) ) {
			this.contentPanel.RemoveClass( 'mainmenu-content--offscreen' );
		}

		$.DispatchEvent( 'ShowContentPanel' );
		this.dimMainMenuBackground( false );
	};

	static onHideContentPanel()
	{
		MainMenuController.contentPanel.AddClass( 'mainmenu-content--offscreen' );

		// Uncheck the active button in the main menu navbar.
		const elActiveNavBarBtn = MainMenuController.getActiveNavBarButton();
		if ( elActiveNavBarBtn && elActiveNavBarBtn.id !== 'MainMenuNavBarHome' ) {
			elActiveNavBarBtn.checked = false;
		}

		MainMenuController.dimMainMenuBackground( true );
		
		// If the tab exists then hide it
		if ( MainMenuController.activeTab )
		{
			const panelToHide = $.GetContextPanel().FindChildInLayoutFile(m_activeTab);
			panelToHide.AddClass( 'mainmenu-content--hidden' );
			 $.Msg( 'HidePanel: ' + MainMenuController.activeTab  );
		}

		MainMenuController.activeTab = '';

	};

	static onHomeButtonPressed()
	{
		$.DispatchEvent( 'HideContentPanel' );
	}

	static getActiveNavBarButton()
	{
		const elNavBar = $('#JsMainMenuNavBar');
		const children = elNavBar.Children();
		const count = children.length;

		for (let i = 0; i < count; i++)
		{
			if ( children[i].IsSelected() ) {
				return children[ i ];
			}
		}
	};

	static onTestButtonPressed() {
		$.Msg("Hi!");
	}

	static dimMainMenuBackground( removeDim )
	{		
		if ( removeDim && MainMenuController.contentPanel.HasClass('mainmenu-content--offscreen') &&
			$('#mainmenu-content__blur-target').HasHoverStyle() === false) {
			$('#MainMenuBackground').RemoveClass('Dim');
		} else
			$('#MainMenuBackground').AddClass('Dim');
	};

	//--------------------------------------------------------------------------------------------------
	// Icon buttons functions
	//--------------------------------------------------------------------------------------------------


	static onQuitButtonPressed()
	{	
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle( '#UI_ConfirmExitTitle',
			'#UI_ConfirmExitMessage',
			'',
			'#UI_Quit',
			function() {
				QuitGame( 'Option1' );
			},
			'#UI_Return',
			function() {
			},
			'dim'
		);
	}

	static quitGame( msg )
	{
		GameInterfaceAPI.ConsoleCommand('quit');
	}

	static openPlayMenu()
	{
		NavigateToTab( 'JsPlay', 'mainmenu_play' );
	};

	static onEscapeKeyPressed( eSource, nRepeats, focusPanel )
	{
		// Resume game (pause menu mode)
		if ( $.GetContextPanel().HasClass( 'MainMenuRootPanel--PauseMenuMode' ) ) {
			$.DispatchEvent( 'ChaosMainMenuResumeGame' );
		} else {
			const playButton = $('#MainMenuNavBarPlay');
			if( playButton && !playButton.HasClass( 'mainmenu-navbar__btn-small--hidden' ) ) {
				//$.DispatchEvent('PlayMainMenuMusic', true, true, null );
			}
		}
	};

}


//--------------------------------------------------------------------------------------------------
// Entry point called when panel is created
//--------------------------------------------------------------------------------------------------
(function()
{

	$.RegisterForUnhandledEvent( 'HideContentPanel', MainMenuController.onHideContentPanel );
	$.RegisterForUnhandledEvent( 'OpenPlayMenu', MainMenuController.openPlayMenu );
	$.RegisterForUnhandledEvent( 'ChaosShowMainMenu', MainMenuController.onShowMainMenu);
	$.RegisterForUnhandledEvent( 'ChaosHideMainMenu', MainMenuController.onHideMainMenu);
	$.RegisterForUnhandledEvent( 'ChaosShowPauseMenu', MainMenuController.onShowPauseMenu);
	$.RegisterForUnhandledEvent( 'ChaosHidePauseMenu', MainMenuController.onHidePauseMenu);
	
	//$.RegisterKeyBind( 'Chaos_mainmenu', 'key_escape', MainMenu.OnEscapeKeyPressed );
	$.RegisterEventHandler( "Cancelled", $.GetContextPanel(), MainMenuController.onEscapeKeyPressed );

})();
