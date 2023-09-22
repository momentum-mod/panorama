const TABS = {
	LobbyDrawer: {
		layout: 'lobby',
		button: $('#LobbyButton')
	},
	ProfileDrawer: {
		layout: 'profile',
		button: $('#ProfileButton')
	},
	ChallengesDrawer: {
		layout: 'challenges',
		button: $('#ChallengesButton')
	},
	AboutDrawer: {
		layout: 'about',
		button: $('#AboutButton')
	}
};

class Drawer {
	static activeTab;
	static isExtended = false;

	static panels = {
		/** @type {Panel} @static */
		drawer: $('#MainMenuDrawerPanel'),
		/** @type {Panel} @static */
		content: $('#MainMenuDrawerContent'),
		/** @type {ModelPanel} @static */
		mainMenuModel: $('#MainMenuModel'),
		/** @type {Image} @static */
		lobbyTypeImage: $('#LobbyButtonImage'),
		/** @type {Label} @static */
		lobbyPlayerCountLabel: $('#LobbyPlayerCountLabel')
	};

	static {
		for (const tab of Object.keys(TABS)) this.loadTab(tab);

		$.RegisterForUnhandledEvent('Drawer_UpdateLobbyButton', this.updateLobbyButton.bind(this));
		$.RegisterForUnhandledEvent('Drawer_NavigateToTab', this.navigateToTab.bind(this));
		$.RegisterForUnhandledEvent('Drawer_ExtendAndNavigateToTab', this.extendAndNavigateToTab.bind(this));
		$.RegisterForUnhandledEvent('ExtendDrawer', this.extend.bind(this));
		$.RegisterForUnhandledEvent('RetractDrawer', this.retract.bind(this));
		$.RegisterForUnhandledEvent('ToggleDrawer', this.toggle.bind(this));
	}

	/**
	 * Load a drawer tab
	 * @param {Object} tab The tab to load
	 */
	static loadTab(tab) {
		const newPanel = $.CreatePanel('Panel', this.panels.content, tab);

		newPanel.LoadLayout('file://{resources}/layout/pages/drawer/' + TABS[tab].layout + '.xml', false, false);

		$.RegisterEventHandler('PropertyTransitionEnd', this.panels.content, (panelName, propertyName) => {
			if (
				newPanel.id === panelName &&
				propertyName === 'opacity' &&
				newPanel.visible === true &&
				newPanel.IsTransparent()
			) {
				newPanel.visible = false;
				newPanel.SetReadyForDisplay(false);
				return true;
			}
			return false;
		});
	}

	/**
	 * Switch to a drawer tab
	 * @param {Object} tab The TABS object to switch to
	 */
	static navigateToTab(tab) {
		if (this.activeTab === tab) return;

		if (this.activeTab) {
			this.panels.drawer.FindChildInLayoutFile(this.activeTab).RemoveClass('drawer__tab--active');
		}

		this.activeTab = tab;

		const activePanel = $.GetContextPanel().FindChildInLayoutFile(tab);

		activePanel.AddClass('drawer__tab--active');
		activePanel.visible = true;
		activePanel.SetReadyForDisplay(true);
	}

	/**
	 * Switch to drawer tab and open it
	 * @param {Object} tab The Tabs object to switch to
	 */
	static extendAndNavigateToTab(tab) {
		this.navigateToTab(tab);

		if (!this.isExtended) this.extend();
	}

	/**
	 * Extend the drawer
	 */
	static extend() {
		if (this.isExtended) return;

		this.panels.drawer.AddClass('drawer--expanded');
		this.panels.mainMenuModel?.AddClass('home__modelpanel--hidden');

		this.isExtended = true;

		if (!this.activeTab) {
			$.DispatchEvent('Activated', TABS.LobbyDrawer.button, 'mouse');
		}

		if (this.activeTab === 'LobbyDrawer') {
			$.DispatchEvent('RefreshLobbyList');
		}
	}

	/**
	 * Retract the drawer
	 */
	static retract() {
		if (!this.isExtended) return;

		this.panels.drawer.RemoveClass('drawer--expanded');
		this.panels.mainMenuModel?.RemoveClass('home__modelpanel--hidden');

		this.isExtended = false;
	}

	/**
	 * Toggle the drawer
	 */
	static toggle() {
		return this.isExtended ? this.retract() : this.extend();
	}

	/**
	 * Sets the rightnav lobby icon to the path and playercount of the current lobby
	 * @param {string} imgPath
	 * @param {number} playerCount
	 */
	static updateLobbyButton(imgPath, playerCount) {
		this.panels.lobbyTypeImage.SetImage(imgPath);
		this.panels.lobbyPlayerCountLabel.text = playerCount;
		this.panels.lobbyPlayerCountLabel.SetHasClass('rightnav__button-subtitle--hidden', playerCount <= 1);
	}

	/**
	 * Open the profile tab when the main menu player card is pressed
	 */
	static onPlayerCardPressed() {
		this.extend();

		if (this.activeTab !== 'ProfileDrawer') {
			$.DispatchEvent('Activated', TABS.ProfileDrawer.button, 'mouse');
		}
	}
}
