'use strict';

//--------------------------------------------------------------------------------------------------
// Header Tab navigation and xml loading
//--------------------------------------------------------------------------------------------------
class MainMenuController {
	static activeTab = '';
	static contentPanel = $('#JsMainMenuContent');
	static contentBlurPanel = $('#MainMenuContentBlur');
	static videoPanel = '';
	static imagePanel = '';
	static playedInitialFadeUp = false;

	static {
		$.RegisterForUnhandledEvent('ChaosShowMainMenu', MainMenuController.onShowMainMenu);
		$.RegisterForUnhandledEvent('ChaosHideMainMenu', MainMenuController.onHideMainMenu);
		$.RegisterForUnhandledEvent('ChaosShowPauseMenu', MainMenuController.onShowPauseMenu);
		$.RegisterForUnhandledEvent('ChaosHidePauseMenu', MainMenuController.onHidePauseMenu.bind(this));
		$.RegisterForUnhandledEvent('MapSelector_OnLoaded', MainMenuController.onMapSelectorLoaded);

		$.RegisterForUnhandledEvent('Safeguard_Disconnect', MainMenuController.onSafeguardDisconnect);
		$.RegisterForUnhandledEvent('Safeguard_Quit', MainMenuController.onSafeguardQuit);
		$.RegisterForUnhandledEvent('Safeguard_ChangeMap', MainMenuController.onSafeguardMapChange);

		$.RegisterForUnhandledEvent('ReloadBackground', MainMenuController.setMainMenuBackground);

		$.RegisterForUnhandledEvent('OnMomentumQuitPrompt', MainMenuController.onQuitPrompt.bind(this));

		$.RegisterEventHandler('Cancelled', $.GetContextPanel(), MainMenuController.onEscapeKeyPressed);

		// Close the map selector when a map is successfully loaded
		$.RegisterForUnhandledEvent(
			'MapSelector_TryPlayMap_Outcome',
			(outcome) => outcome && MainMenuController.onHomeButtonPressed()
		);

		$.DispatchEvent('ChaosHideIntroMovie');
	}

	// TODO: Delete me when proper engine support is added!
	static psdump() {
		for (let i = 0; i < $.persistentStorage.length; i++) {
			$.Msg(
				$.persistentStorage.key(i).toString() +
					': ' +
					JSON.stringify($.persistentStorage.getItem($.persistentStorage.key(i)))
			);
		}
	}

	static onInitFadeUp() {
		if (!MainMenuController.playedInitialFadeUp) {
			MainMenuController.playedInitialFadeUp = true;
		}
	}

	static onShowMainMenu() {
		MainMenuController.onInitFadeUp();

		MainMenuController.videoPanel = $('#MainMenuMovie');
		MainMenuController.imagePanel = $('#MainMenuBackground');

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

		// Save to file whenever the settings page gets closed
		if (this.activeTab === 'Settings') {
			$.DispatchEvent('SettingsSave');
		}
	}

	static navigateToTab(tab, xmlName, hasBlur = true) {
		if (tab === 'MapSelection') {
			$.GetContextPanel()
				.FindChildTraverse('MainMenuBackgroundMapSelectorImage')
				.RemoveClass('mapselector__background--hidden');
		} else {
			$.GetContextPanel()
				.FindChildTraverse('MainMenuBackgroundMapSelectorImage')
				.AddClass('mapselector__background--hidden');
		}

		MainMenuController.contentBlurPanel.visible = hasBlur;

		if (MainMenuController.activeTab == tab) {
			$.DispatchEvent('Activated', $('#HomeButton'), 'mouse');
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
					} else if (newPanel.visible === true) {
						$.DispatchEvent('MainMenuTabShown', tab);
					}
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
				panelToHide.AddClass('mainmenu__page-container--hidden');

				$.DispatchEvent('MainMenuTabHidden', MainMenuController.activeTab);
			}

			//Show selected tab
			MainMenuController.activeTab = tab;
			const activePanel = $.GetContextPanel().FindChildInLayoutFile(tab);
			activePanel.RemoveClass('mainmenu__page-container--hidden');

			// Force a reload of any resources since we're about to display the panel
			activePanel.visible = true;
			activePanel.SetReadyForDisplay(true);
		}

		MainMenuController.showContentPanel();
	}

	static showContentPanel() {
		MainMenuController.contentPanel.RemoveClass('mainmenu__page-container--hidden');

		$.DispatchEvent('RetractDrawer');
		$.DispatchEvent('ShowContentPanel');

		$.GetContextPanel().FindChildTraverse('HomeContent').AddClass('home--hidden');
	}

	static onHideContentPanel() {
		MainMenuController.contentPanel.AddClass('mainmenu__page-container--hidden');

		// Uncheck the active button in the main menu navbar.
		const elActiveNavBarBtn = MainMenuController.getActiveNavBarButton();
		if (elActiveNavBarBtn && elActiveNavBarBtn.id !== 'HomeButton') {
			elActiveNavBarBtn.checked = false;
		}

		// If the tab exists then hide it
		if (MainMenuController.activeTab) {
			const panelToHide = $.GetContextPanel().FindChildInLayoutFile(MainMenuController.activeTab);
			if (panelToHide) panelToHide.AddClass('mainmenu__page-container--hidden');

			$.DispatchEvent('MainMenuTabHidden', MainMenuController.activeTab);
		}

		MainMenuController.activeTab = '';

		$.GetContextPanel().FindChildTraverse('HomeContent').RemoveClass('home--hidden');
	}

	static getActiveNavBarButton() {
		return $.GetContextPanel()
			.FindChildTraverse('MainMenuTopButtons')
			.Children()
			.find((panel) => panel.IsSelected());
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
			$.GetContextPanel().FindChildTraverse('PSDumpButton').RemoveClass('hide');
		}

		this.showPlaytestWelcomePopup();
	}

	static showPlaytestWelcomePopup() {
		if (!$.persistentStorage.getItem('dontShowAgain.playtestWelcome')) {
			UiToolkitAPI.ShowCustomLayoutPopupParameters(
				'',
				'file://{resources}/layout/popups/popup_playtestwelcome.xml',
				'storageKey=playtestWelcome'
			);
		}
	}

	static setMainMenuBackground() {
		const videoPanel = MainMenuController.videoPanel;
		const imagePanel = MainMenuController.imagePanel;

		if (!videoPanel?.IsValid() || !imagePanel?.IsValid()) return;

		let useVideo = $.persistentStorage.getItem('settings.mainMenuMovie') === 1;

		if (typeof $.persistentStorage.getItem('settings.mainMenuMovie') === typeof null) {
			useVideo = true;
			// Enable video by default
			$.persistentStorage.setItem('settings.mainMenuMovie', 1);
		}

		videoPanel.visible = useVideo;
		videoPanel.SetReadyForDisplay(useVideo);

		imagePanel.visible = !useVideo;
		imagePanel.SetReadyForDisplay(!useVideo);

		const backgroundVar = parseInt($.persistentStorage.getItem('settings.mainMenuBackground'));

		if (isNaN(backgroundVar)) {
			// Light mode by default
			$.persistentStorage.setItem('settings.mainMenuBackground', 0);
		}

		let name = '';

		// If it's xmas and you're using one of the default backgrounds, replace it with the xmas version
		const date = new Date();
		if (date.getMonth() === 11 && date.getDate() >= 25 && backgroundVar <= 1) {
			name = 'MomentumXmas';
		} else {
			// Using a switch as we're likely to add more of these in the future
			switch (backgroundVar) {
				case 1:
					name = 'MomentumDark';
					break;
				default:
					name = 'MomentumLight';
					break;
			}
		}
		if (useVideo) {
			videoPanel.SetMovie('file://{resources}/videos/backgrounds/' + name + '.webm');

			videoPanel.Play();
		} else {
			imagePanel.SetImage('file://{images}/backgrounds/' + name + '.dds');
		}
	}

	/*
	 *	Toggles between dark and light mode in the main menu
	 */
	static toggleBackgroundLightDark() {
		const currentType = $.persistentStorage.getItem('settings.mainMenuBackground');

		if (!(currentType === 0 || currentType === 1)) return;

		$.persistentStorage.setItem('settings.mainMenuBackground', currentType === 0 ? 1 : 0);

		this.setMainMenuBackground();
	}

	static hideMapSelectorBackground() {
		$.GetContextPanel()
			.FindChildTraverse('MainMenuBackgroundMapSelectorImage')
			.AddClass('mapselector__background--hidden');
	}

	static onMapSelectorLoaded() {
		['MapSelectorLeft', 'MapDescription', 'MapInfoStats', 'Leaderboards'].forEach((panel) =>
			$.GetContextPanel()
				.FindChildTraverse('MainMenuBackgroundBlur')
				?.AddBlurPanel($.GetContextPanel().FindChildTraverse(panel))
		);
	}

	static onHomeButtonPressed() {
		MainMenuController.onHideContentPanel();
		MainMenuController.hideMapSelectorBackground();
	}

	static onQuitButtonPressed() {
		if (GameInterfaceAPI.GetGameUIState() === GAME_UI_STATE.PAUSEMENU) {
			GameInterfaceAPI.ConsoleCommand('disconnect');
			this.onHomeButtonPressed();
			return;
		}
		this.onQuitPrompt();
	}

	static onQuitPrompt(toDesktop = true) {
		if (!toDesktop) return; // currently dont handle disconnect prompts
		$.DispatchEvent('ChaosMainMenuPauseGame'); // make sure game is paused so we can see the popup if hit from a keybind in-game
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
			'Quit',
			'Are you sure you want to quit?',
			'warning-popup',
			'Quit',
			this.quitGame,
			'Return',
			() => {},
			'blur'
		);
	}

	static onSafeguardDisconnect() {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#MOM_MB_Safeguard_Map_Quit_ToMenu_Title'),
			"Leaving the map will cancel your timer, are you sure you want to quit?\n\n<span class='text-sm text-italic'>(You can turn this off in Settings → Gameplay → Safeguards)</span>",
			'warning-popup',
			() => $.DispatchEvent('Safeguard_Response', RUN_SAFEGUARD_TYPE.QUIT_TO_MENU),
			() => {}
		);
	}

	static onSafeguardQuit() {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#MOM_MB_Safeguard_Map_Quit_Game_Title'),
			"Quitting the game will cancel your timer, are you sure you want to quit?\n\n<span class='text-sm text-italic'>(You can turn this off in Settings → Gameplay → Safeguards)</span>",
			'warning-popup',
			() => $.DispatchEvent('Safeguard_Response', RUN_SAFEGUARD_TYPE.QUIT_GAME),
			() => {}
		);
	}

	static onSafeguardMapChange(mapName) {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#MOM_MB_Safeguard_Map_Change_Title'),
			`You are trying to change map to ${mapName} while your timer is still running, do you want to continue?\n\n<span class='text-sm text-italic'>(You can turn this off in Settings → Gameplay → Safeguards)</span>`,
			'warning-popup',
			() => GameInterfaceAPI.ConsoleCommand('__map_change_ok 1;map ' + mapName),
			() => {}
		);
	}

	static quitGame() {
		GameInterfaceAPI.ConsoleCommand('quit');
	}

	static onEscapeKeyPressed(_eSource, _nRepeats, _focusPanel) {
		// Resume game in pause menu mode, OTHERWISE close the active menu menu page
		if (GameInterfaceAPI.GetGameUIState() === GAME_UI_STATE.PAUSEMENU) {
			$.DispatchEvent('ChaosMainMenuResumeGame');
		} else {
			MainMenuController.onHomeButtonPressed();
		}
	}
}
