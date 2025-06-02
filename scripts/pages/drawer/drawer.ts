import { PanelHandler } from 'util/module-helpers';

export const Tabs = {
	LobbyDrawer: {
		layout: 'lobby',
		button: $('#LobbyButton')
	},
	// ProfileDrawer: {
	// 	layout: 'profile',
	// 	button: $('#ProfileButton')
	// },
	// ChallengesDrawer: {
	// 	layout: 'challenges',
	// 	button: $('#ChallengesButton')
	// },
	AboutDrawer: {
		layout: 'about',
		button: $('#AboutButton')
	}
};

export type Tab = keyof typeof Tabs;

@PanelHandler()
class DrawerHandler {
	activeTab: string;
	isExtended = false;

	readonly panels = {
		drawer: $<Panel>('#MainMenuDrawerPanel'),
		content: $<Panel>('#MainMenuDrawerContent'),
		mainMenuModel: $<Panel>('#MainMenuModel'),
		lobbyTypeImage: $<Image>('#LobbyButtonImage'),
		lobbyPlayerCountLabel: $<Label>('#LobbyPlayerCountLabel')
	};

	constructor() {
		for (const tab of Object.keys(Tabs)) {
			this.loadTab(tab as Tab);
		}

		$.RegisterForUnhandledEvent('Drawer_UpdateLobbyButton', (imgSrc, playerCount) =>
			this.updateLobbyButton(imgSrc, playerCount)
		);
		$.RegisterForUnhandledEvent('Drawer_NavigateToTab', (tabID) => this.navigateToTab(tabID));
		$.RegisterForUnhandledEvent('Drawer_ExtendAndNavigateToTab', (tabID) => this.extendAndNavigateToTab(tabID));
		$.RegisterForUnhandledEvent('ExtendDrawer', () => this.extend());
		$.RegisterForUnhandledEvent('RetractDrawer', () => this.retract());
		$.RegisterForUnhandledEvent('ToggleDrawer', () => this.toggle());
	}

	/**
	 * Load a drawer tab
	 * @param {Object} tab The tab to load
	 */
	loadTab(tab: Tab) {
		const newPanel = $.CreatePanel('Panel', this.panels.content, tab);

		newPanel.LoadLayout('file://{resources}/layout/pages/drawer/' + Tabs[tab].layout + '.xml', false, false);

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
	navigateToTab(tab: Tab) {
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

	/** Switch to drawer tab and open it */
	extendAndNavigateToTab(tab: Tab) {
		this.navigateToTab(tab);

		if (!this.isExtended) this.extend();
	}

	/** Extend the drawer */
	extend() {
		if (this.isExtended) return;

		this.panels.drawer.AddClass('drawer--expanded');
		this.panels.mainMenuModel?.AddClass('home__modelpanel--hidden');

		this.isExtended = true;

		if (!this.activeTab) {
			$.DispatchEvent('Activated', Tabs.LobbyDrawer.button, PanelEventSource.MOUSE);
		}

		if (this.activeTab === 'LobbyDrawer') {
			$.DispatchEvent('RefreshLobbyList');
		}
	}

	/** Retract the drawer */
	retract() {
		if (!this.isExtended) return;

		this.panels.drawer.RemoveClass('drawer--expanded');
		this.panels.mainMenuModel?.RemoveClass('home__modelpanel--hidden');

		this.isExtended = false;
	}

	/** Toggle the drawer */
	toggle() {
		return this.isExtended ? this.retract() : this.extend();
	}

	/** Sets the rightnav lobby icon to the path and playercount of the current lobby */
	updateLobbyButton(imgPath: string, playerCount: number) {
		this.panels.lobbyTypeImage.SetImage(imgPath);
		this.panels.lobbyPlayerCountLabel.text = playerCount;
		this.panels.lobbyPlayerCountLabel.SetHasClass('rightnav__button-subtitle--hidden', playerCount <= 1);
	}

	// /** Open the profile tab when the main menu player card is pressed */
	// onPlayerCardPressed() {
	// 	this.extend();
	//
	// 	if (this.activeTab !== 'ProfileDrawer') {
	// 		$.DispatchEvent('Activated', Tabs.ProfileDrawer.button, PanelEventSource.MOUSE);
	// 	}
	// }
}
