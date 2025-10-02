import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import AuthenicationResult = MomentumAPI.AuthenicationResult;

export enum Page {
	MAP_SELECTOR = 'MapSelection',
	LEARN = 'Learn',
	SETTINGS = 'Settings',
	CONTROLS_LIBRARY = 'ControlsLibrary'
}

@PanelHandler()
class MainMenuHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<MainMenu>(),
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
		quitButtonIcon: $<Image>('#QuitButtonImage'),
		legal: $<Panel>('#LegalConsent')
	};

	activePage: Page | null = null;

	constructor() {
		$.RegisterForUnhandledEvent('ShowMainMenu', () => this.onShowMainMenu());
		$.RegisterForUnhandledEvent('HideMainMenu', () => this.onHideMainMenu());
		$.RegisterForUnhandledEvent('ShowPauseMenu', () => this.onShowPauseMenu());
		$.RegisterForUnhandledEvent('HidePauseMenu', () => this.onHidePauseMenu());
		$.RegisterForUnhandledEvent('MapSelector_OnLoaded', () => this.onMapSelectorLoaded());
		$.RegisterForUnhandledEvent('ReloadMainMenuBackground', () => this.setMainMenuBackground());
		$.RegisterForUnhandledEvent('OnMomentumQuitPrompt', () => this.onQuitPrompt());
		$.RegisterForUnhandledEvent('MomAPI_Authenticated', (result) => this.onAuthenticated(result));
		$.RegisterEventHandler('Cancelled', $.GetContextPanel(), () => this.onEscapeKeyPressed());

		// Close the map selector when a map is loaded
		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => this.hideMainMenuPageContent());

		$.DispatchEvent('HideIntroMovie');
	}

	async onPanelLoad() {
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

		if (GameInterfaceAPI.GetSettingBool('developer')) {
			$('#ControlsLibraryButton').RemoveClass('hide');
		}

		this.setMainMenuBackground();

		await this.checkUserLegalConsent();

		this.showPlaytestWelcomePopup();

		$.DispatchEvent('MainMenuPageShown', null);
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
		if (this.activePage === Page.SETTINGS) {
			$.DispatchEvent('SettingsSave');
		}
	}

	/**
	 * Switch main menu page
	 */
	navigateToPage(page: Page, layoutFile: string, hasBlur = true) {
		this.panels.mapSelectorBackground.SetHasClass('mapselector__background--hidden', page !== Page.MAP_SELECTOR);

		this.panels.contentBlur.visible = hasBlur;

		if (this.activePage === page) {
			$.DispatchEvent('Activated', this.panels.homeButton, PanelEventSource.MOUSE);
			return;
		}

		// Check to see if page to show exists. If not load the xml file.
		if (!this.panels.cp.FindChildInLayoutFile(page)) {
			const newPanel = $.CreatePanel('Panel', this.panels.pageContent, page);

			newPanel.LoadLayout(`file://{resources}/layout/pages/${layoutFile}.xml`, false, false);
			newPanel.RegisterForReadyEvents(true);

			// Handler that catches PropertyTransitionEndEvent event for this panel.
			// Check if the panel is transparent then collapse it.
			$.RegisterEventHandler('PropertyTransitionEnd', newPanel, (panelName, propertyName) => {
				// Panel is visible and fully transparent
				if (
					newPanel.id === panelName &&
					propertyName === 'opacity' &&
					newPanel.visible &&
					newPanel.IsTransparent()
				) {
					// Set visibility to false and unload resources
					newPanel.visible = false;
					newPanel.SetReadyForDisplay(false);
					return true;
				}
				return false;
			});
		}

		// If we have an active tab and it is different from the selected tab, hide it.
		// Then show the selected tab.
		if (this.activePage !== page) {
			// If the tab exists then hide it
			if (this.activePage) {
				const pagePanel = this.panels.cp.FindChildInLayoutFile(this.activePage);
				pagePanel.visible = false;
				pagePanel.AddClass('mainmenu__page-container--hidden');
				$.DispatchEvent('MainMenuPageHidden', this.activePage);
			}

			// Show selected page
			this.activePage = page;
			const activePanel = this.panels.cp.FindChildInLayoutFile(page);
			activePanel.RemoveClass('mainmenu__page-container--hidden');
			$.DispatchEvent('MainMenuPageShown', page);

			// Force a reload of any resources since we're about to display the panel
			activePanel.visible = true;
			activePanel.SetReadyForDisplay(true);
		}

		this.showMainMenuPageContent();
	}

	/**
	 * Show the main menu page container and retract the drawer.
	 */
	showMainMenuPageContent() {
		this.panels.pageContent.RemoveClass('mainmenu__page-container--hidden');

		$.DispatchEvent('RetractDrawer');

		this.panels.homeContent.AddClass('home--hidden');
	}

	/**
	 * Hide the main menu page container and active page, and display the home page content.
	 */
	hideMainMenuPageContent() {
		this.panels.pageContent.AddClass('mainmenu__page-container--hidden');
		this.panels.mapSelectorBackground.AddClass('mapselector__background--hidden');

		// Uncheck the active button in the main menu navbar.
		const activeButton = this.panels.topButtons.Children().find((panel) => panel.IsSelected());
		if (activeButton && activeButton.id !== 'HomeButton') {
			activeButton.checked = false;
		}

		// If the tab exists then hide it
		if (this.activePage) {
			const panelToHide = this.panels.cp.FindChildInLayoutFile(this.activePage);
			if (panelToHide) panelToHide.AddClass('mainmenu__page-container--hidden');

			$.DispatchEvent('MainMenuPageHidden', this.activePage);
		}

		$.DispatchEvent('MainMenuPageShown', null);
		this.activePage = null;
		this.panels.homeContent.RemoveClass('home--hidden');
	}

	/**
	 * Temporary method to show the playtest welcome thingy
	 */
	showPlaytestWelcomePopup() {
		if (!$.persistentStorage.getItem('mainMenu.playtestWelcomeShown')) {
			UiToolkitAPI.ShowCustomLayoutPopup('', 'file://{resources}/layout/modals/popups/playtest-welcome.xml');
		}
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
		$.PlaySoundEvent(isLightMode ? 'MenuThemeDark' : 'MenuThemeLight');
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
	 * Handles quit button getting pressed, deciding whether to `disconnect` or `quit`
	 * based on if we're ingame or not.
	 */
	onQuitButtonPressed() {
		if (GameInterfaceAPI.GetGameUIState() === GameUIState.PAUSEMENU) {
			GameInterfaceAPI.ConsoleCommand('disconnect');
			this.hideMainMenuPageContent();
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

	/** Quits the game. Bye! */
	quitGame() {
		GameInterfaceAPI.ConsoleCommand('quit');
	}

	onEscapeKeyPressed() {
		// Resume game in pause menu mode, OTHERWISE close the active menu menu page
		if (GameInterfaceAPI.GetGameUIState() === GameUIState.PAUSEMENU) {
			$.DispatchEvent('MainMenuResumeGame');
		} else {
			this.hideMainMenuPageContent();
		}
	}

	onAuthenticated(result: MomentumAPI.AuthenicationResult) {
		if (result === MomentumAPI.AuthenicationResult.SUCCESS) return;

		if (result === AuthenicationResult.FAILURE_ACCOUNT_LIMITED) {
			UiToolkitAPI.ShowGenericPopupTwoOptions(
				'#API_Auth_Failure',
				'#API_Auth_LimitedSteamAccount',
				'wide-popup',
				'#API_Auth_SteamLimitedInfo',
				() => SteamOverlayAPI.OpenURL('https://help.steampowered.com/en/faqs/view/71D3-35C2-AD96-AA3A'),
				'#Common_OK',
				() => {}
			);

			return;
		}

		let token: string;
		switch (result) {
			case AuthenicationResult.FAILURE_LOCAL_STEAM_CONNECTION:
			case AuthenicationResult.FAILURE_BACKEND_STEAM_CONNECTION:
				token = '#API_Auth_SteamDown';
				break;
			case AuthenicationResult.FAILURE_SIGNUPS_DISABLED:
				token = '#API_Auth_SignupsDisabled';
				break;
			case AuthenicationResult.FAILURE_BACKEND_DOWN:
				token = '#API_Auth_BackendDown';
				break;
			default:
				token = '#API_Auth_Unauthorized';
		}

		UiToolkitAPI.ShowGenericPopupOk('#API_Auth_Failure', token, 'wide-popup', () => {});
	}

	checkUserLegalConsent(): Promise<void> {
		return new Promise((resolve) => {
			const consent = MomentumAPI.GetUserAuthConsent();
			if (consent === MomentumAPI.UserAuthConsent.VALID) {
				resolve();
				return;
			}

			this.toggleAnnounceMode(true);
			this.panels.legal.LoadLayoutSnippet(
				consent === MomentumAPI.UserAuthConsent.INVALID ? 'UserConsentInitial' : 'UserConsentOutdated'
			);

			this.panels.legal.FindChildTraverse('OKButton')!.SetPanelEvent('onactivate', () => {
				MomentumAPI.GrantUserAuthConsent();
				this.toggleAnnounceMode(false);
				resolve();
			});

			this.panels.legal.FindChildTraverse('DeclineButton')!.SetPanelEvent('onactivate', () => {
				GameInterfaceAPI.ConsoleCommand('quit');
			});
		});
	}

	/**
	 * Put the main menu into "announce" mode, when we want to show
	 * big fullscreen stuff on startup like legal consent
	 */
	toggleAnnounceMode(enable: boolean) {
		this.panels.cp.SetHasClass('--announce-mode', enable);
	}
}
