'use strict';

class MainMenuSettings {
	static settingsTabs = {
		InputSettings: {
			xml: 'settings_input',
			radioid: 'InputRadio',
			children: {
				MouseSubSection: 'MouseRadio',
				KeybindSubSection: 'KeybindRadio'
			}
		},
		AudioSettings: {
			xml: 'settings_audio',
			radioid: 'AudioRadio',
			children: {
				VolumeSubSection: 'VolumeRadio',
				AudioDeviceSubSection: 'AudioDeviceRadio'
			}
		},
		VideoSettings: {
			xml: 'settings_video',
			radioid: 'VideoRadio',
			children: {
				VideoSubSection: 'VideoSubRadio',
				AdvancedVideoSubSection: 'AdvancedVideoRadio'
			}
		},
		OnlineSettings: {
			xml: 'settings_online',
			radioid: 'OnlineRadio',
			children: {
				OnlineGhostSubSection: 'OnlineGhostRadio',
				GhostSubSection: 'GhostRadio',
				RichPresenceSubSection: 'RichPresenceRadio'
			}
		},
		GameplaySettings: {
			xml: 'settings_gameplay',
			radioid: 'GameplayRadio',
			children: {
				GameplayGeneralSubSection: 'GameplayGeneralRadio',
				PaintSubSection: 'PaintRadio',
				SafeguardsSubSection: 'SafeguardsRadio',
				TimerSubSection: 'TimerRadio',
				RocketJumpSubSection: 'RocketJumpRadio',
				StickyJumpSubSection: 'StickyJumpRadio',
				ConcSubSection: 'ConcRadio'
			}
		},
		InterfaceSettings: {
			xml: 'settings_interface',
			radioid: 'InterfaceRadio',
			children: {
				UISubSection: 'UIRadio',
				SpeedometerSubSection: 'SpeedometerRadio',
				CrosshairSubSection: 'CrosshairRadio',
				KeypressSubSection: 'KeypressRadio',
				StrafeSyncSubSection: 'StrafeSyncRadio'
			}
		},
		SearchSettings: {
			xml: 'settings_search'
		}
	};

	static activeTab = null;
	static prevTab = null;
	static contentPanel = $('#SettingsContent');

	static navPanel = $('#SettingsNav');
	static navExpand = $('#SettingsNavCollapseIcon');
	static navCollapse = $('#SettingsNavExpandIcon');

	static infoPanel = $('#SettingsInfo');
	static infoPanelTitle = $('#SettingsInfoTitle');
	static infoPanelMessage = $('#SettingsInfoMessage');
	static infoPanelConvar = $('#SettingsInfoConvar');
	static infoPanelDocsButton = $('#SettingsInfoDocsButton');
	static currentInfo = null;

	static spacerHeight = null;
	static shouldLimitScroll = false;

	static {
		// Load every tab immediately, otherwise search won't be guaranteed to find everything.
		Object.keys(this.settingsTabs).forEach((tab) => this.loadTab(tab));

		// Default to input settings page
		this.navigateToTab('InputSettings');

		// Set nav panel to correct collapse state
		this.updateNavCollapse();

		// Set up event listeners
		// Switch to a settings panel - search uses this
		$.RegisterForUnhandledEvent('SettingsNavigateToPanel', this.navigateToSettingPanel);

		// Save to file whenever the settings page gets closed
		$.RegisterForUnhandledEvent('MainMenuTabHidden', (tab) => tab === 'Settings' && this.saveSettings());

		// Handle the settings save event
		$.RegisterForUnhandledEvent('SettingsSave', this.saveSettings);
	}

	static navigateToTab(tab) {
		// If a we have a active tab and it is different from the selected tab hide it, then show the selected tab
		if (this.activeTab !== tab) {
			// If the tab exists then hide it
			if (this.activeTab) {
				// Hide the nav menu children of the active tab if we're in collapse mode
				if (this.activeTab !== 'SearchSettings') this.setNavItemCollapsed(this.activeTab, $.persistentStorage.getItem('settings.collapseNav') ?? true);

				// Hide the active tab
				$.GetContextPanel().FindChildInLayoutFile(this.activeTab).RemoveClass('settings-page--active');
			}

			// Show selected tab, store previous
			this.prevTab = this.activeTab;
			this.activeTab = tab;

			// Activate the tab
			const activePanel = $.GetContextPanel().FindChildInLayoutFile(tab);
			activePanel.AddClass('settings-page--active');

			// Force a reload of any resources since we're about to display the panel
			activePanel.visible = true;
			activePanel.SetReadyForDisplay(true);

			// Hide the info panel if it was displaying something on the previous page
			this.hideInfo();

			if (tab !== 'SearchSettings') {
				// Call onPageScrolled to set the checked nav subsection to the page's scroll position
				this.onPageScrolled(tab, activePanel.FindChildTraverse('SettingsPageContainer'));

				// Show the nav menu children of the selected tab
				this.setNavItemCollapsed(tab, false);

				// Check the radiobutton for cases where this is called from JS. CSGO Panorama fires an Activated event to the radiobutton instead but I hate that.
				$.GetContextPanel().FindChildTraverse(MainMenuSettings.settingsTabs[tab].radioid).checked = true;
			}

			SettingsShared.onChangedTab(this.activeTab);
		}
	}

	static loadTab(tab) {
		const newPanel = $.CreatePanel('Panel', this.contentPanel, tab);

		// Load XML file for the page
		newPanel.LoadLayout('file://{resources}/layout/settings/' + this.settingsTabs[tab].xml + '.xml', false, false);

		// Set the --odd/--even classes all the children
		this.styleAlternatingItems(newPanel);

		// Setup all the events for all the children
		this.initPanelsRecursive(newPanel);

		const container = newPanel.FindChildTraverse('SettingsPageContainer');

		// Register the page scroll event with onPageScrolled
		if (tab !== 'SearchSettings') {
			$.RegisterEventHandler(
				'Scroll',
				container,
				// The default arg that gets passed here is the panel's ID, override with the panel itself so we don't have to do a traversal find later on
				() => this.onPageScrolled(tab, container)
			);
		}

		// Handler that catches OnPropertyTransitionEndEvent event for this panel and closes it
		// This ensures the panel is unloaded when it's done animating
		$.RegisterEventHandler('PropertyTransitionEnd', newPanel, (panelName, propertyName) => {
			// Only handle the opacity transition
			if (newPanel.id === panelName && propertyName === 'opacity') {
				// Panel is visible and fully transparent
				if (newPanel.visible === true && newPanel.IsTransparent()) {
					// Set visibility to false and unload resources
					newPanel.visible = false;
					newPanel.SetReadyForDisplay(false);
					return true;
				}
			}
			return false;
		});

		// Start the new panel off as invisible
		newPanel.visible = false;
	}

	static navigateToSubsection(tab, section) {
		// Just find the section panel,then use navigateToSettingPanel
		this.navigateToSettingPanel(tab, $.GetContextPanel().FindChildTraverse(section));
	}

	static navigateToSettingPanel(tab, panel) {
		// Switch to the page containing the setting
		if (tab !== this.activeTab) {
			MainMenuSettings.navigateToTab(tab);
		}

		// Scroll to the location of the setting
		panel.ScrollParentToMakePanelFit(1, false);

		// Don't run the scroll position detection until scrolling has definitely finished - there may be an event for this...
		MainMenuSettings.limitScrollCheck(1.0);

		// Apply highlight anim
		panel.AddClass('settings-group--highlight');

		// I really hate this way of animating, but it ensures the --highlight class gets removed
		let kfs = panel.CreateCopyOfCSSKeyframes('SettingsGroupHighlight');
		panel.UpdateCurrentAnimationKeyframes(kfs);
	}

	// Set the shouldLimitScroll bool for a specific amount of time
	static limitScrollCheck(duration) {
		MainMenuSettings.shouldLimitScroll = true;
		$.Schedule(duration, () => (MainMenuSettings.shouldLimitScroll = false));
	}

	static onPageScrolled(tab, panel) {
		// Panorama can fire this event A LOT, so we throttle it
		if (MainMenuSettings.shouldLimitScroll) {
			return;
		} else {
			// Don't run again for 0.05 seconds
			this.limitScrollCheck(0.05);
		}

		// This is 0 on initial load for some reason
		if (!this.spacerHeight > 0) {
			this.spacerHeight = $.GetContextPanel().FindChildrenWithClassTraverse('settings-page__spacer')[0].actuallayoutheight;
		}

		// Calculate proportion of the way scrolled down the page
		const scrollOffset = -panel.scrolloffset_y; // scrolloffset_y is always negative
		const containerHeight = panel.contentheight;
		const containerScreenHeight = panel.actuallayoutheight;
		const proportionScrolled = scrollOffset / (containerHeight - containerScreenHeight);

		// Loop through each group until we find the one that scroll proportion fits within. If scrollOffset is 0 break in the first case
		// Think of it of partitioning [0, 1] into sections based on each section's height and seeing which partion bounds the scroll proportion
		for (let child of panel.FindChildrenWithClassTraverse('settings-group')) {
			if (
				(child.actualyoffset / containerHeight <= proportionScrolled &&
					proportionScrolled <= (child.actualyoffset + child.actuallayoutheight + this.spacerHeight) / containerHeight) ||
				scrollOffset === 0
			) {
				this.navPanel.FindChildTraverse(this.settingsTabs[tab].children[child.id]).checked = true;
				break;
			}
		}
	}

	static invertNavCollapse() {
		// Invert state
		$.persistentStorage.setItem('settings.collapseNav', !$.persistentStorage.getItem('settings.collapseNav'));

		// Update the panel
		this.updateNavCollapse();
	}

	static updateNavCollapse() {
		// Get state from PS
		let shouldCollapse = $.persistentStorage.getItem('settings.collapseNav');

		// Set to true if not set by user
		if (typeof shouldCollapse === typeof null) {
			$.persistentStorage.setItem('settings.collapseNav', true);
			shouldCollapse = true;
		}

		// Show the corresponding button icon
		this.navExpand.SetHasClass('hide', !shouldCollapse);
		this.navCollapse.SetHasClass('hide', shouldCollapse);

		// Update all the items
		Object.keys(this.settingsTabs)
			.filter((tab) => tab !== 'SearchSettings' && tab !== this.activeTab)
			.forEach((tab) => this.setNavItemCollapsed(tab, shouldCollapse));
	}

	// Set the collapsed state of a nav item
	static setNavItemCollapsed(tab, shouldCollapse) {
		this.navPanel
			.FindChild(this.settingsTabs[tab].radioid)
			.FindChildrenWithClassTraverse('settings-nav__subsection')[0]
			.SetHasClass('settings-nav__subsection--hidden', shouldCollapse);
	}

	static initPanelsRecursive(panel) {
		// Initalise info panel event handlers
		if (this.isSettingsPanel(panel)) {
			this.setPanelInfoEvents(panel);
		}

		// Initialise all the settings using persistent storage
		// Only Enum and EnumDropDown are currently supported, others can be added when/if needed
		const psVar = panel.GetAttributeString('psvar', '');
		if (psVar) {
			if (panel.paneltype === 'ChaosSettingsEnum') {
				this.initPersistentStorageEnum(panel, psVar);
			} else if (panel.paneltype === 'ChaosSettingsEnumDropDown') {
				this.initPersistentStorageEnumDropdown(panel, psVar);
			}
		}

		// Search all children
		panel.Children?.().forEach((child) => {
			this.initPanelsRecursive(child);
		});
	}

	static initPersistentStorageEnum(panel, storageKey) {
		panel
			.FindChildTraverse('values')
			.Children()
			.forEach((child) => {
				// Get the value of enum (usually 0: off, 1: on but they can have more values)
				const value = child.GetAttributeInt('value', -1);

				if (value === -1) return;

				// 0 if not already set, let the places using the var handle setting a default value
				const storedValue = $.persistentStorage.getItem(storageKey) ?? 0;

				// Check the button if the value matches the stored value
				child.checked = storedValue === value;

				// Extra attribute to allow us to still specify onactivate events in XML
				const overrideString = child.GetAttributeString('activateoverride', '');

				// Create function from XML string
				const activateFn = new Function(overrideString);

				// Setter
				child.SetPanelEvent('onactivate', () => {
					$.persistentStorage.setItem(storageKey, value);
					// Call override function if it exists
					if (overrideString) activateFn();
				});
			});
	}

	static initPersistentStorageEnumDropdown(panel, storageKey) {
		const dropdown = panel.FindChildTraverse('DropDown');

		// Set the selected dropdown to the one stored in PS. Same as above, default to 0
		dropdown.SetSelectedIndex($.persistentStorage.getItem(storageKey) ?? 0);

		// Event overrides, same as above
		const overrideString = panel.GetAttributeString('submitoverride', '');
		const submitFn = new Function(overrideString);

		// Setter + override (if exists)
		panel.SetPanelEvent('oninputsubmit', () => {
			$.persistentStorage.setItem(storageKey, dropdown.GetSelected().GetAttributeInt('value', -1));
			if (overrideString) submitFn();
		});
	}

	static setPanelInfoEvents(panel) {
		const message = panel.GetAttributeString('infomessage', '');
		// Default to true if not set
		const hasDocs = !(panel.GetAttributeString('hasdocspage', '') === 'false');
		panel.SetPanelEvent('onmouseover', () => {
			// Set onmouseover events for all settings panels
			MainMenuSettings.showInfo(
				// If a panel has a specific title use that, if not use the panel's name. Child ID names vary between panel types, blame Valve
				panel.GetAttributeString('infotitle', '') || panel.FindChildTraverse('Title')?.text || panel.FindChildTraverse('title')?.text,
				message,
				panel.convar ?? panel.bind,
				hasDocs,
				panel.paneltype
			);
		});
	}

	static showInfo(title, message, convar, hasDocs, paneltype) {
		// Check we're mousing over a different panel than before, i.e. the title, message and convar aren't all equal
		if (title + message + convar === this.currentInfo) return;

		this.currentInfo = title + message + convar;

		// Get convar display option from PS
		const showConvar = $.persistentStorage.getItem('settings.infoPanelConvars') === 1 && convar;
		const isKeybinder = paneltype === 'ChaosSettingsKeyBinder';

		// If the panel has a message OR a convar and the convar display option is on, show the info panel
		if (message || showConvar) {
			let switchDelay = 0;

			// If the info panel is closed, open it. If it's already open, play the switch animation
			if (this.infoPanel.HasClass('settings-info--hidden')) {
				this.infoPanel.RemoveClass('settings-info--hidden');
			} else {
				switchDelay = 0.05; // This should always be half the duration of settings-info--switch

				this.infoPanel.AddClass('settings-info--switch');
				let kfs = this.infoPanel.CreateCopyOfCSSKeyframes('BlurFadeInOut');
				this.infoPanel.UpdateCurrentAnimationKeyframes(kfs);
			}

			// Delay changing the properties even we've just played the switch animation,
			// to be half the length of animation, so text changes at apex of the animation
			$.Schedule(switchDelay, () => {
				if (message) {
					this.infoPanelTitle.text = $.Localize(title);
					this.infoPanelMessage.text = $.Localize(message);
					this.infoPanelTitle.RemoveClass('hide');
					this.infoPanelMessage.RemoveClass('hide');
				} else {
					this.infoPanelTitle.AddClass('hide');
					this.infoPanelMessage.AddClass('hide');
				}

				if (showConvar) {
					this.infoPanelConvar.text = `<i>${isKeybinder ? 'Command' : 'Convar'}: <b>${convar}</b></i>`;
					this.infoPanelConvar.RemoveClass('hide');
					this.infoPanelDocsButton.SetHasClass('hide', !hasDocs || isKeybinder);
					// Shouldn't need to clear the panel event here as it's hidden or gets overwritten
					this.infoPanelDocsButton.SetPanelEvent('onactivate', () => SteamOverlayAPI.OpenURLModal(`https://docs.momentum-mod.org/var/${convar}`));
				} else {
					this.infoPanelConvar.AddClass('hide');
					this.infoPanelDocsButton.AddClass('hide');
				}
			});
		} else {
			this.hideInfo();
		}
	}

	static hideInfo() {
		// Hide the info panel
		this.infoPanel.AddClass('settings-info--hidden');
	}

	static styleAlternatingItems(page) {
		// Search all groups on the page
		page.FindChildrenWithClassTraverse('settings-group').forEach((group) => {
			let n = 0;
			const styleItem = (item) => item.AddClass(n++ % 2 === 0 ? '--odd' : '--even');

			const search = (panel) => {
				panel.Children?.().forEach((child) => {
					// If it's a settings panel or a combo panel, style it
					if (this.isSettingsPanel(child) || child.HasClass('settings-group__combo')) {
						styleItem(child);
					}
					// Otherwise if it's a ConVarEnabler search all its children
					else if (child.paneltype === 'ConVarEnabler') {
						child.Children().forEach((grandchild) => search(grandchild));
					} else {
						search(child);
					}
				});
			};

			search(group);
		});
	}

	static saveSettings() {
		$.Msg('Writing settings to file...');
		GameInterfaceAPI.ConsoleCommand('host_writeconfig');
	}

	static isSettingsPanel(panel) {
		return ['ChaosSettingsEnum', 'ChaosSettingsSlider', 'ChaosSettingsEnumDropDown', 'ChaosSettingsKeyBinder', 'ChaosSettingsToggle'].includes(panel.paneltype);
	}
}
