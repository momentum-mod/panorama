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

	static navigateToTab(tab) {
		const parentPanel = $.GetContextPanel().FindChildTraverse('MainMenuDrawerContent');

		if (!parentPanel.FindChildInLayoutFile(tab)) {
			const newPanel = $.CreatePanel('Panel', parentPanel, tab);
			newPanel.LoadLayout('file://{resources}/layout/drawer/' + Drawer.drawerTabs[tab].layout + '.xml', false, false);
		}

		if (Drawer.activeTab !== tab) {
			if (Drawer.activeTab !== undefined) {
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
		$.GetContextPanel().FindChildTraverse('MainMenuModel')?.AddClass('homecontent__modelpanel--hidden');

		Drawer.isExtended = true;

		$.DispatchEvent('RefreshLobbyList');
	}

	static retract() {
		$.GetContextPanel().FindChildTraverse('MainMenuDrawerPanel').RemoveClass('drawer--expanded');
		$.GetContextPanel().FindChildTraverse('MainMenuModel')?.RemoveClass('homecontent__modelpanel--hidden');

		Drawer.isExtended = false;
	}

	static toggle() {
		Drawer.isExtended ? Drawer.retract() : Drawer.extend();
	}

	static extendAndSwitch(tab) {
		Drawer.navigateToTab(tab);

		if (!Drawer.isExtended) Drawer.extend();
	}

	static setLobbyButtonImage(path) {
		$.GetContextPanel().FindChildTraverse('LobbyButtonImage').SetImage(path);
	}
}

(function () {
	Drawer.navigateToTab('LobbyDrawer');
	$.RegisterEventHandler('OnLobbyButtonImageChange', $.GetContextPanel(), Drawer.setLobbyButtonImage);
	$.RegisterEventHandler('RetractDrawer', $.GetContextPanel(), Drawer.retract);
})();
