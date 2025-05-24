import { PanelHandler, OnPanelLoad } from 'util/module-helpers';
import { checkDosa } from 'util/dont-show-again';
import { RunSafeguardType } from 'common/safeguards';

enum GameUIState {
	INVALID = 0,
	LOADINGSCREEN = 1,
	INGAME = 2,
	MAINMENU = 3,
	PAUSEMENU = 4,
	INTROMOVIE = 5
}

@PanelHandler()
class MainMenuHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		pageContent: $<Panel>('#PageContent'),
		homeContent: $<Panel>('#HomeContent'),
		contentBlur: $<BaseBlurTarget>('#MainMenuContentBlur'),
		backgroundBlur: $<BaseBlurTarget>('#MainMenuBackgroundBlur'),
		movie: null as Movie,
		image: $<Image>('#MainMenuBackground'),
		model: $<ModelPanel>('#MainMenuModel'),
		mapSelectorBackground: $<Image>('#MainMenuBackgroundMapSelectorImage'),
		topButtons: $<Panel>('#MainMenuTopButtons'),
		homeButton: $<RadioButton>('#HomeButton'),
		quitButtonIcon: $<Image>('#QuitButtonImage')
	};

	activeTab = '';

	constructor() {
		$.RegisterForUnhandledEvent('ShowMainMenu', () => this.onShowMainMenu());
		$.RegisterForUnhandledEvent('HideMainMenu', () => this.onHideMainMenu());
		$.RegisterForUnhandledEvent('ShowPauseMenu', () => this.onShowPauseMenu());
		$.RegisterForUnhandledEvent('HidePauseMenu', () => this.onHidePauseMenu());
		$.RegisterForUnhandledEvent('MapSelector_OnLoaded', () => this.onMapSelectorLoaded());
		$.RegisterForUnhandledEvent('Safeguard_Disconnect', () => this.onSafeguardDisconnect());
		$.RegisterForUnhandledEvent('Safeguard_Quit', () => this.onSafeguardQuit());
		$.RegisterForUnhandledEvent('Safeguard_ChangeMap', (mapName) => this.onSafeguardMapChange(mapName));
		$.RegisterForUnhandledEvent('ReloadMainMenuBackground', () => this.setMainMenuBackground());
		$.RegisterForUnhandledEvent('OnMomentumQuitPrompt', () => this.onQuitPrompt());
		$.RegisterEventHandler('Cancelled', $.GetContextPanel(), () => this.onEscapeKeyPressed());

		// Close the map selector when a map is successfully loaded
		$.RegisterForUnhandledEvent(
			'MapSelector_TryPlayMap_Outcome',
			(outcome) => outcome && this.onHomeButtonPressed()
		);

		$.DispatchEvent('HideIntroMovie');
	}

	onPanelLoad() {
		// These aren't accessible until the page has loaded fully, find them now
		this.panels.movie = $('#MainMenuMovie');
		this.panels.model = $('#MainMenuModel');

		this.panels.model.SetModelRotation(0, 270, 0); // Get arrow logo facing to the right, looks better
		this.panels.model.SetModelRotationSpeedTarget(0, 0.2, 0);
		this.panels.model.SetMouseXRotationScale(0, 1, 0); // By default mouse X will rotate the X axis, but we want it to spin Y axis
		this.panels.model.SetMouseYRotationScale(0, 0, 0); // Disable mouse Y movement rotations

		this.panels.model.LookAtModel();
		this.panels.model.SetCameraOffset(-200, 0, 0);
		this.panels.model.SetCameraFOV(40);

		this.panels.model.SetDirectionalLightColor(0, 0.5, 0.5, 0.5);
		this.panels.model.SetDirectionalLightDirection(0, 1, 0, 0);

		if (GameInterfaceAPI.GetSettingBool('developer')) $('#ControlsLibraryButton').RemoveClass('hide');

		this.setMainMenuBackground();

		this.showPlaytestWelcomePopup();
	}

	/**
	 * Fired by C++ whenever main menu is switched to.
	 */
	onShowMainMenu() {
		this.panels.movie = $('#MainMenuMovie');
		this.panels.image = $('#MainMenuBackground');

		this.panels.quitButtonIcon.SetImage('file://{images}/quit.svg');

		this.setMainMenuBackground();
	}

	/**
	 * Fired by C++ whenever main menu is switched from.
	 */
	onHideMainMenu() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	/**
	 * Fired by C++ whenever pause menu (i.e. main menu when in a map) is switched to.
	 */
	onShowPauseMenu() {
		this.panels.cp.AddClass('MainMenuRootPanel--PauseMenuMode');

		this.panels.quitButtonIcon.SetImage('file://{images}/exit-door.svg');
	}

	/**
	 * Fired by C++ whenever pause menu is switched from.
	 */
	onHidePauseMenu() {
		this.panels.cp.RemoveClass('MainMenuRootPanel--PauseMenuMode');

		// Save to file whenever the settings page gets closed
		if (this.activeTab === 'Settings') {
			$.DispatchEvent('SettingsSave');
		}
	}

	/**
	 * Switch main menu page
	 */
	navigateToPage(tab: string, xmlName: string, hasBlur = true) {
		this.panels.mapSelectorBackground.SetHasClass('mapselector__background--hidden', tab !== 'MapSelection');

		this.panels.contentBlur.visible = hasBlur;

		if (this.activeTab === tab) {
			$.DispatchEvent('Activated', this.panels.homeButton, PanelEventSource.MOUSE);
			return;
		}

		// Check to see if tab to show exists.
		// If not load the xml file.
		if (!this.panels.cp.FindChildInLayoutFile(tab)) {
			const newPanel = $.CreatePanel('Panel', this.panels.pageContent, tab);

			newPanel.LoadLayout(`file://{resources}/layout/pages/${xmlName}.xml`, false, false);
			newPanel.RegisterForReadyEvents(true);

			// Handler that catches PropertyTransitionEndEvent event for this panel.
			// Check if the panel is transparent then collapse it.
			$.RegisterEventHandler('PropertyTransitionEnd', newPanel, (panelName, propertyName) => {
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
			});
		}

		// If a we have a active tab and it is different from the selected tab hide it.
		// Then show the selected tab
		if (this.activeTab !== tab) {
			// Trigger sound event for the new panel
			// if (xmlName) {
			// 	$.DispatchEvent('PlaySoundEffect', 'tab_' + xmlName.replace('/', '_'), 'MOUSE');
			// }

			// If the tab exists then hide it
			if (this.activeTab) {
				const panelToHide = this.panels.cp.FindChildInLayoutFile(this.activeTab);
				panelToHide.AddClass('mainmenu__page-container--hidden');

				$.DispatchEvent('MainMenuTabHidden', this.activeTab);
			}

			// Show selected tab
			this.activeTab = tab;
			const activePanel = this.panels.cp.FindChildInLayoutFile(tab);
			activePanel.RemoveClass('mainmenu__page-container--hidden');

			// Force a reload of any resources since we're about to display the panel
			activePanel.visible = true;
			activePanel.SetReadyForDisplay(true);
		}

		this.showContentPanel();
	}

	/**
	 * Show the main menu page container and retract the drawer.
	 */
	showContentPanel() {
		this.panels.pageContent.RemoveClass('mainmenu__page-container--hidden');

		$.DispatchEvent('RetractDrawer');

		this.panels.homeContent.AddClass('home--hidden');
	}

	/**
	 * Hide the main menu page container and active page, and display the home page content.
	 */
	onHideContentPanel() {
		this.panels.pageContent.AddClass('mainmenu__page-container--hidden');

		// Uncheck the active button in the main menu navbar.
		const activeButton = this.panels.topButtons.Children().find((panel) => panel.IsSelected());
		if (activeButton && activeButton.id !== 'HomeButton') {
			activeButton.checked = false;
		}

		// If the tab exists then hide it
		if (this.activeTab) {
			const panelToHide = this.panels.cp.FindChildInLayoutFile(this.activeTab);
			if (panelToHide) panelToHide.AddClass('mainmenu__page-container--hidden');

			$.DispatchEvent('MainMenuTabHidden', this.activeTab);
		}

		this.activeTab = '';

		this.panels.homeContent.RemoveClass('home--hidden');
	}

	/**
	 * Temporary method to show the playtest welcome thingy
	 */
	showPlaytestWelcomePopup() {
		if (!checkDosa('playtestWelcome'))
			UiToolkitAPI.ShowCustomLayoutPopupParameters(
				'',
				'file://{resources}/layout/modals/popups/playtest-welcome.xml',
				'dosaKey=playtestWelcome&dosaNameToken=Dosa_PlaytestWelcome'
			);
	}

	/**
	 * Set the video background based on persistent storage settings
	 */
	setMainMenuBackground() {
		if (!this.panels.movie?.IsValid() || !this.panels.image?.IsValid()) return;

		let useVideo = $.persistentStorage.getItem<boolean>('settings.mainMenuMovie');

		if (useVideo === null) {
			// Enable video by default
			useVideo = true;
			$.persistentStorage.setItem('settings.mainMenuMovie', true);
		}

		this.panels.movie.visible = useVideo;
		this.panels.movie.SetReadyForDisplay(useVideo);

		this.panels.image.visible = !useVideo;
		this.panels.image.SetReadyForDisplay(!useVideo);

		let backgroundVar = Number.parseInt($.persistentStorage.getItem('settings.mainMenuBackground'));

		if (Number.isNaN(backgroundVar)) {
			// Set color mode by system preference
			backgroundVar = $.SystemInDarkMode() ? 1 : 0;
			$.persistentStorage.setItem('settings.mainMenuBackground', backgroundVar);
		}

		let name: string;

		// If it's xmas and you're using one of the default backgrounds, replace it with the xmas version
		const date = new Date();
		if (date.getMonth() === 11 && date.getDate() >= 18 && backgroundVar <= 1) {
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
			this.panels.movie.SetMovie(`file://{resources}/videos/backgrounds/${name}.webm`);
			this.panels.movie.Play();
		} else {
			this.panels.image.SetImage(`file://{images}/backgrounds/${name}.dds`);
		}
	}

	/*
	 *	Toggles between dark and light mode in the main menu
	 */
	toggleBackgroundLightDark() {
		const isLightMode = $.persistentStorage.getItem('settings.mainMenuBackground') === 0;
		$.persistentStorage.setItem('settings.mainMenuBackground', isLightMode ? 1 : 0);
		this.setMainMenuBackground();
		$.PlaySoundEvent(isLightMode ? 'UIPanorama.MenuThemeDark' : 'UIPanorama.MenuThemeLight');
	}

	/**
	 * Hide the map selector background
	 */
	hideMapSelectorBackground() {
		this.panels.mapSelectorBackground.AddClass('mapselector__background--hidden');
	}

	/**
	 * Handles the map selector load event to add blurs to some of the map selector panels.
	 * Necessary to handle in here because map selector background is a part of the main menu background section.
	 */
	onMapSelectorLoaded() {
		for (const panel of ['MapSelectorLeft', 'MapDescription', 'MapInfoStats', 'Leaderboards'])
			this.panels.backgroundBlur?.AddBlurPanel($.GetContextPanel().FindChildTraverse(panel));
	}

	/**
	 * Handles home button getting pressed.
	 */
	onHomeButtonPressed() {
		this.onHideContentPanel();
		this.hideMapSelectorBackground();
	}

	/**
	 * Handles quit button getting pressed, deciding whether to `disconnect` or `quit`
	 * based on if we're ingame or not.
	 */
	onQuitButtonPressed() {
		if (GameInterfaceAPI.GetGameUIState() === (GameUIState.PAUSEMENU as any)) {
			GameInterfaceAPI.ConsoleCommand('disconnect');
			this.onHomeButtonPressed();
			return;
		}
		this.onQuitPrompt();
	}

	/** Handles when the quit button is shown, either from button getting pressed or event fired from C++. */
	onQuitPrompt(toDesktop = true) {
		if (!toDesktop) return; // currently don't handle disconnect prompts

		$.DispatchEvent('MainMenuPauseGame'); // make sure game is paused so we can see the popup if hit from a keybind in-game

		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
			$.Localize('#Action_Quit'),
			$.Localize('#Action_Quit_Message'),
			'warning-popup',
			$.Localize('#Action_Quit'),
			this.quitGame,
			$.Localize('#Action_Return'),
			() => {},
			'blur'
		);
	}

	/** Shows a safeguard popup when disconnect is pressed during a run and safeguard is on */
	onSafeguardDisconnect() {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#Safeguard_MapQuitToMenu'),
			$.Localize('#Safeguard_MapQuitToMenu_Message'),
			'warning-popup',
			() => $.DispatchEvent('Safeguard_Response', RunSafeguardType.QUIT_TO_MENU),
			() => {}
		);
	}

	/** Shows a safeguard popup when quit is pressed during a run and safeguard is on */
	onSafeguardQuit() {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#Safeguard_MapQuitGame'),
			$.Localize('#Safeguard_MapQuitGame_Message'),
			'warning-popup',
			() => $.DispatchEvent('Safeguard_Response', RunSafeguardType.QUIT_GAME),
			() => {}
		);
	}

	/** Shows a safeguard popup when map change is triggered during a run and safeguard is on */
	onSafeguardMapChange(mapName: string) {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#Safeguard_MapChange'),
			$.Localize('#Safeguard_MapChange_Message').replace('%map%', mapName),
			'warning-popup',
			() => GameInterfaceAPI.ConsoleCommand('__map_change_ok 1;map ' + mapName),
			() => {}
		);
	}

	/** Quits the game. Bye! */
	quitGame() {
		GameInterfaceAPI.ConsoleCommand('quit');
	}

	onEscapeKeyPressed() {
		// Resume game in pause menu mode, OTHERWISE close the active menu menu page
		if (GameInterfaceAPI.GetGameUIState() === (GameUIState.PAUSEMENU as any)) {
			$.DispatchEvent('MainMenuResumeGame');
		} else {
			this.onHomeButtonPressed();
		}
	}
}
