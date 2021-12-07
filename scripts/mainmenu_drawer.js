'use strict';

class Drawer {
	static drawerTabs = {
		ProfileDrawer: {
			layout: 'profile',
			button: 'ProfileButton'
		},
		LobbyDrawer: {
			layout: 'lobby',
			button: 'LobbyButton'
		},
		StatsDrawer: {
			layout: 'stats',
			button: 'StatsButton'
		},
		ChangelogDrawer: {
			layout: 'changelog',
			button: 'ChangelogButton'
		}
	};

	static activeTab;
	static isExtended = false;
	static lobbyTypeImage = $('#LobbyButtonImage');
	static lobbyPlayerCountLabel = $('#LobbyPlayerCountLabel');

	static {
		Drawer.navigateToTab('LobbyDrawer');

		$.RegisterEventHandler('Drawer_UpdateLobbyButton', $.GetContextPanel(), Drawer.updateLobbyButton);
		$.RegisterEventHandler('RetractDrawer', $.GetContextPanel(), Drawer.retract);
	}

	static navigateToTab(tab) {
		const parentPanel = $.GetContextPanel().FindChildTraverse('MainMenuDrawerContent');

		if (!parentPanel.FindChildInLayoutFile(tab)) {
			const newPanel = $.CreatePanel('Panel', parentPanel, tab);
			newPanel.LoadLayout('file://{resources}/layout/drawer/' + Drawer.drawerTabs[tab].layout + '.xml', false, false);
		}

		if (Drawer.activeTab !== tab) {
			if (Drawer.activeTab) {
				const panelToHide = $.GetContextPanel().FindChildInLayoutFile(Drawer.activeTab);
				panelToHide.RemoveClass('Active');
			}

			Drawer.activeTab = tab;
			const activePanel = $.GetContextPanel().FindChildInLayoutFile(tab);
			activePanel.AddClass('Active');

			activePanel.visible = true;
			activePanel.SetReadyForDisplay(true);
		}
	}

	static extend() {
		$.GetContextPanel().FindChildTraverse('MainMenuDrawerPanel').AddClass('drawer--expanded');
		$.GetContextPanel().FindChildTraverse('MainMenuModel')?.AddClass('home__modelpanel--hidden');

		Drawer.isExtended = true;

		$.DispatchEvent('RefreshLobbyList');
	}

	static retract() {
		$.GetContextPanel().FindChildTraverse('MainMenuDrawerPanel').RemoveClass('drawer--expanded');
		$.GetContextPanel().FindChildTraverse('MainMenuModel')?.RemoveClass('home__modelpanel--hidden');

		Drawer.isExtended = false;
	}

	static toggle() {
		Drawer.isExtended ? Drawer.retract() : Drawer.extend();
	}

	static extendAndSwitch(tab) {
		Drawer.navigateToTab(tab);

		if (!Drawer.isExtended) Drawer.extend();
	}

	/**
	 * Sets the rightnav lobby icon to the path and playercount of the current lobby
	 * @param {string} imgPath
	 * @param {number} playerCount
	 */
	static updateLobbyButton(imgPath, playerCount) {
		Drawer.lobbyTypeImage.SetImage(imgPath);
		Drawer.lobbyPlayerCountLabel.text = playerCount;
		Drawer.lobbyPlayerCountLabel.SetHasClass('rightnav__button-subtitle--hidden', playerCount <= 1);
	}
}
