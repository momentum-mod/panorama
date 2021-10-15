'use strict';

//--------------------------------------------------------------------------------------------------
// Header Tab navigation and xml loading
//--------------------------------------------------------------------------------------------------

class MainMenuController {
	static activeTab = '';
	static contentPanel = $( '#JsMainMenuContent' );
	static contentBlurPanel = $( '#MainMenuContentBlur' );
	static videoPanel = '';
	static imagePanel = '';
	static playedInitialFadeUp = false;

	static onInitFadeUp() {
		if (!MainMenuController.playedInitialFadeUp) {
			MainMenuController.playedInitialFadeUp = true;
		}
	}

	static onShowMainMenu() {
		MainMenuController.onInitFadeUp();

		MainMenuController.videoPanel = $( '#MainMenuMovie' );
		MainMenuController.imagePanel = $( '#MainMenuBackground' );

		MainMenuController.setMainMenuBackground();
	}

	static onHideMainMenu() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static onShowPauseMenu() {
		$.GetContextPanel().AddClass('MainMenuRootPanel--PauseMenuMode');
	}

	static onHidePauseMenu() {
		$.GetContextPanel().RemoveClass('MainMenuRootPanel--PauseMenuMode');

		MainMenuController.onHomeButtonPressed();
	}

	static checkTabCanBeOpenedRightNow(tab) {
		return true;
	}

	static navigateToTab(tab, xmlName, hasBlur = true) {
		MainMenuController.contentBlurPanel.visible = hasBlur;

		if ( !MainMenuController.checkTabCanBeOpenedRightNow( tab ) ) {
			MainMenuController.onHomeButtonPressed();
			return; // validate that tabs can be opened (GC connection / China free-to-play / etc.)
		}

		if (MainMenuController.activeTab == tab) {
			$.DispatchEvent("Activated", $("#HomeButton"), "mouse");
			return;
		}

		// Check to see if tab to show exists.
		// If not load the xml file.
		if (!$.GetContextPanel().FindChildInLayoutFile(tab)) {
			const newPanel = $.CreatePanel('Panel', this.contentPanel, tab);

			newPanel.Data().elMainMenuRoot = $.GetContextPanel();
			newPanel.LoadLayout('file://{resources}/layout/' + xmlName + '.xml', false, false);
			newPanel.RegisterForReadyEvents(true);

			// Handler that catches OnPropertyTransitionEndEvent event for this panel.
			// Check if the panel is transparent then collapse it.
			newPanel.OnPropertyTransitionEndEvent = function (panelName, propertyName) {
				if (newPanel.id === panelName && propertyName === 'opacity') {
					// Panel is visible and fully transparent
					if (newPanel.visible === true && newPanel.IsTransparent()) {
						// Set visibility to false and unload resources
						newPanel.visible = false;
						newPanel.SetReadyForDisplay(false);
						return true;
					} else if (newPanel.visible === true) $.DispatchEvent('MainMenuTabShown', tab);
				}
				return false;
			};

			$.RegisterEventHandler('PropertyTransitionEnd', newPanel, newPanel.OnPropertyTransitionEndEvent);
		}

		// If a we have a active tab and it is different from the selected tab hide it.
		// Then show the selected tab
		if (MainMenuController.activeTab !== tab) {
			//Trigger sound event for the new panel
			// if (xmlName) {
			// 	$.DispatchEvent('PlaySoundEffect', 'tab_' + xmlName.replace('/', '_'), 'MOUSE');
			// }

			// If the tab exists then hide it
			if (MainMenuController.activeTab) {
				const panelToHide = $.GetContextPanel().FindChildInLayoutFile(MainMenuController.activeTab);
				panelToHide.AddClass('mainmenu__content--hidden');
			}

			//Show selected tab
			MainMenuController.activeTab = tab;
			const activePanel = $.GetContextPanel().FindChildInLayoutFile(tab);
			activePanel.RemoveClass('mainmenu__content--hidden');

			// Force a reload of any resources since we're about to display the panel
			activePanel.visible = true;
			activePanel.SetReadyForDisplay(true);
		}

		MainMenuController.showContentPanel();
	}

	static showContentPanel() {
		MainMenuController.contentPanel.RemoveClass('mainmenu__content--hidden');
			
		// $.GetContextPanel().FindChildTraverse('MainMenuModel').AddClass('homecontent__modelpanel--hidden');

		$.GetContextPanel().FindChildTraverse("MainMenuDrawerPanel")?.AddClass("drawer--content-panel-open");

		$.DispatchEvent('RetractDrawer');
		$.DispatchEvent('ShowContentPanel');

		$.GetContextPanel().FindChildTraverse('HomeContent').AddClass('homecontent--hidden');
	}

	static onHideContentPanel() {
		MainMenuController.contentPanel.AddClass('mainmenu__content--hidden');

		$.GetContextPanel().FindChildTraverse("MainMenuDrawerPanel")?.RemoveClass("drawer--content-panel-open");

		// Uncheck the active button in the main menu navbar.
		const elActiveNavBarBtn = MainMenuController.getActiveNavBarButton();
		if (elActiveNavBarBtn && elActiveNavBarBtn.id !== 'HomeButton') {
			elActiveNavBarBtn.checked = false;
		}

		// If the tab exists then hide it
		if (MainMenuController.activeTab) {
			const panelToHide = $.GetContextPanel().FindChildInLayoutFile(MainMenuController.activeTab);
			panelToHide.AddClass('mainmenu__content--hidden');
		}

		MainMenuController.activeTab = '';

		$.GetContextPanel().FindChildTraverse('HomeContent').RemoveClass('homecontent--hidden');
	}

	static getActiveNavBarButton() {
		const elNavBar = $.GetContextPanel().FindChildTraverse('JsMainMenuNavBar');
		const children = elNavBar.Children();
		const count = children.length;

		for (let i = 0; i < count; i++) {
			if (children[i].IsSelected()) {
				return children[i];
			}
		}
	}

	static onMainMenuLoaded() {
		const model = $.GetContextPanel().FindChildTraverse('MainMenuModel');

		model.SetModelRotation(0.0, 270.0, 0.0); // Get arrow logo facing to the right, looks better
		model.SetModelRotationSpeedTarget(0.0, 0.2, 0.0);
		model.SetMouseXRotationScale(0.0, 1.0, 0.0); // By default mouse X will rotate the X axis, but we want it to spin Y axis
		model.SetMouseYRotationScale(0.0, 0.0, 0.0); // Disable mouse Y movement rotations

		model.LookAtModel();
		model.SetCameraOffset(-200.0, 0.0, 0.0);
		model.SetCameraFOV(40.0);

		model.SetDirectionalLightColor(0, 0.5, 0.5, 0.5);
		model.SetDirectionalLightDirection(0, 1.0, 0.0, 0.0);

		if (GameInterfaceAPI.GetSettingBool('developer')) {
			$.GetContextPanel().FindChildTraverse('ControlsLibraryButton').RemoveClass('hide');
		}
	}

	static setMainMenuBackground() {
		const videoPanel = MainMenuController.videoPanel;
		const imagePanel = MainMenuController.imagePanel;

		if (!(videoPanel && videoPanel.IsValid() && imagePanel && imagePanel.IsValid())) return;

		const useVideo = GameInterfaceAPI.GetSettingBool('mom_ui_menu_background_video');

		videoPanel.visible = useVideo;
		videoPanel.SetReadyForDisplay(useVideo);

		imagePanel.visible = !useVideo;
		imagePanel.SetReadyForDisplay(!useVideo);

		var name = '';

		// Using a switch as we're likely to add more of these in the future
		switch (GameInterfaceAPI.GetSettingInt('mom_ui_menu_background_type')) {
			case 1:
				name = 'MomentumDark';
				break;
			default:
				name = 'MomentumLight';
		}

		if (useVideo) {
			videoPanel.SetMovie('file://{resources}/videos/backgrounds/' + name + '.webm');

			videoPanel.Play();
		} else {
			imagePanel.SetImage('file://{images}/backgrounds/' + name + '.dds');
		}
	}


	static onLoadMapSelector() {
		$.GetContextPanel().FindChildTraverse('MainMenuBackgroundBlur')?.AddBlurPanel($.GetContextPanel().FindChildTraverse('MapSelectorLeft'));
		$.GetContextPanel().FindChildTraverse('MainMenuBackgroundBlur')?.AddBlurPanel($.GetContextPanel().FindChildTraverse('MapDescription'));
		$.GetContextPanel().FindChildTraverse('MainMenuBackgroundBlur')?.AddBlurPanel($.GetContextPanel().FindChildTraverse('MapInfoStats'));
	}
	//--------------------------------------------------------------------------------------------------
	// Icon buttons functions
	//--------------------------------------------------------------------------------------------------

	static onHomeButtonPressed() {
		MainMenuController.onHideContentPanel();
	}

	static onQuitButtonPressed() {
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
			'Quit',
			'Are you sure you want to quit?',
			'quit-popup',
			'Return',
			() => {},
			'Quit',
			MainMenuController.quitGame,
			'blur'
		);
	}

	static quitGame() {
		GameInterfaceAPI.ConsoleCommand('quit');
	}

	static onEscapeKeyPressed(eSource, nRepeats, focusPanel) {
		MainMenuController.onHomeButtonPressed();

		// Resume game (pause menu mode)
		if ($.GetContextPanel().HasClass('MainMenuRootPanel--PauseMenuMode')) {
			$.DispatchEvent('ChaosMainMenuResumeGame');
		}
	}
}

//--------------------------------------------------------------------------------------------------
// Entry point called when panel is created
//--------------------------------------------------------------------------------------------------
(function () {
	$.RegisterForUnhandledEvent('ChaosShowMainMenu', MainMenuController.onShowMainMenu);
	$.RegisterForUnhandledEvent('ChaosHideMainMenu', MainMenuController.onHideMainMenu);
	$.RegisterForUnhandledEvent('ChaosShowPauseMenu', MainMenuController.onShowPauseMenu);
	$.RegisterForUnhandledEvent('ChaosHidePauseMenu', MainMenuController.onHidePauseMenu);
	$.RegisterForUnhandledEvent('LoadMapSelector', MainMenuController.onLoadMapSelector);

	$.RegisterForUnhandledEvent('ReloadBackground', MainMenuController.setMainMenuBackground);

	$.RegisterEventHandler('Cancelled', $.GetContextPanel(), MainMenuController.onEscapeKeyPressed);
})();
