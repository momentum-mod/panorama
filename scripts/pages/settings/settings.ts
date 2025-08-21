import { getHandlerInstance, OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { traverseChildren } from 'util/functions';
import { isSettingsPanel, SettingsTab, SettingsTabs, SettingsTabWithoutSearch } from 'common/settings';
import './search';



@PanelHandler()
export class SettingsHandler {
	activeTab: SettingsTab = null;
	prevTab: SettingsTab = null;

	readonly panels = {
		content: $<Panel>('#SettingsContent'),
		nav: $<Panel>('#SettingsNav'),
		navExpand: $<Image>('#SettingsNavCollapseIcon'),
		navCollapse: $<Image>('#SettingsNavExpandIcon'),
		info: $<Panel>('#SettingsInfo'),
		infoTitle: $<Label>('#SettingsInfoTitle'),
		infoMessage: $<Label>('#SettingsInfoMessage'),
		infoConvar: $<Label>('#SettingsInfoConvar'),
		infoDocsButton: $<Button>('#SettingsInfoDocsButton')
	};

	currentInfo: string = null;
	spacerHeight = 0;
	shouldLimitScroll = false;

	constructor() {
		// Load every tab immediately, otherwise search won't be guaranteed to find everything.
		Object.keys(SettingsTabs).forEach((tab) => this.loadTab(tab as SettingsTab));

		// Default to input settings page
		this.navigateToTab('InputSettings');

		// Set nav panel to correct collapse state
		this.updateNavCollapse();

		// Set up event listeners
		// Switch to a settings panel - search uses this
		$.RegisterForUnhandledEvent('SettingsNavigateToPanel', (tabID, panel) =>
			this.navigateToSettingPanel(tabID, panel)
		);

		// Save to file whenever the settings page gets closed
		$.RegisterForUnhandledEvent('MainMenuPageHidden', (tab) => tab === 'Settings' && this.saveSettings());

		// Handle the settings save event
		$.RegisterForUnhandledEvent('SettingsSave', () => this.saveSettings());
	}

	navigateToTab(tab: SettingsTab) {
		// If we have an active tab and it is different from the selected tab hide it, then show the selected tab
		if (this.activeTab !== tab) {
			// If the tab exists then hide it
			if (this.activeTab) {
				// Hide the nav menu children of the active tab if we're in collapse mode
				if (this.activeTab !== 'SearchSettings')
					this.setNavItemCollapsed(
						this.activeTab,
						$.persistentStorage.getItem('settings.collapseNav') ?? true
					);

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
				$.GetContextPanel().FindChildTraverse(SettingsTabs[tab].radioid).checked = true;
			}

			getHandlerInstance(SettingsPage).onChangedTab(this.activeTab);
		}
	}

	loadTab(tab: SettingsTab) {
		const newPanel = $.CreatePanel('Panel', this.panels.content, tab);

		// Load XML file for the page
		newPanel.LoadLayout('file://{resources}/layout/pages/settings/' + SettingsTabs[tab].xml + '.xml', false, false);

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
			if (
				newPanel.id === panelName &&
				propertyName === 'opacity' && // Panel is visible and fully transparent
				newPanel.visible === true &&
				newPanel.IsTransparent()
			) {
				// Set visibility to false and unload resources
				newPanel.visible = false;
				newPanel.SetReadyForDisplay(false);
				return true;
			}
			return false;
		});

		// Start the new panel off as invisible
		newPanel.visible = false;
	}

	navigateToSubsection(tab: SettingsTab, section: string) {
		// Just find the section panel,then use navigateToSettingPanel
		this.navigateToSettingPanel(tab, $.GetContextPanel().FindChildTraverse(section));
	}

	navigateToSettingPanel(tab: SettingsTab, panel: GenericPanel) {
		// Switch to the page containing the setting
		if (tab !== this.activeTab) {
			this.navigateToTab(tab);
		}

		// Scroll to the location of the setting
		panel.ScrollParentToMakePanelFit(1, false);

		// Don't run the scroll position detection until scrolling has definitely finished - there may be an event for this...
		this.limitScrollCheck(1);

		// Apply highlight anim
		panel.TriggerClass('settings-group--highlight');
	}

	// Set the shouldLimitScroll bool for a specific amount of time
	limitScrollCheck(duration: number) {
		this.shouldLimitScroll = true;
		$.Schedule(duration, () => (this.shouldLimitScroll = false));
	}

	onPageScrolled(tab: SettingsTab, panel: GenericPanel) {
		// Panorama can fire this event A LOT, so we throttle it
		if (this.shouldLimitScroll) {
			return;
		} else {
			// Don't run again for 0.05 seconds
			this.limitScrollCheck(0.05);
		}

		// This is 0 on initial load for some reason
		if (this.spacerHeight === 0) {
			this.spacerHeight =
				$.GetContextPanel().FindChildrenWithClassTraverse('settings-page__spacer')[0].actuallayoutheight;
		}

		// Calculate proportion of the way scrolled down the page
		const scrollOffset = -panel.scrolloffset_y; // scrolloffset_y is always negative
		const containerHeight = panel.contentheight;
		const containerScreenHeight = panel.actuallayoutheight;
		const proportionScrolled = scrollOffset / (containerHeight - containerScreenHeight);

		// Loop through each group until we find the one that scroll proportion fits within. If scrollOffset is 0 break in the first case
		// Think of it of partitioning [0, 1] into sections based on each section's height and seeing which partition bounds the scroll proportion
		for (const child of panel.FindChildrenWithClassTraverse('settings-group')) {
			if (
				(child.actualyoffset / containerHeight <= proportionScrolled &&
					proportionScrolled <=
						(child.actualyoffset + child.actuallayoutheight + this.spacerHeight) / containerHeight) ||
				scrollOffset === 0
			) {
				// Would need do some crazy mapping over type unions here, fuck it
				this.panels.nav.FindChildTraverse((SettingsTabs[tab] as any).children[child.id]).checked = true;
				break;
			}
		}
	}

	invertNavCollapse() {
		// Invert state
		$.persistentStorage.setItem('settings.collapseNav', !$.persistentStorage.getItem('settings.collapseNav'));

		// Update the panel
		this.updateNavCollapse();
	}

	updateNavCollapse() {
		// Get state from PS
		let shouldCollapse = $.persistentStorage.getItem<boolean>('settings.collapseNav');

		// Set to true if not set by user
		if (typeof shouldCollapse === typeof null) {
			$.persistentStorage.setItem('settings.collapseNav', true);
			shouldCollapse = true;
		}

		// Show the corresponding button icon
		this.panels.navExpand.SetHasClass('hide', !shouldCollapse);
		this.panels.navCollapse.SetHasClass('hide', shouldCollapse);

		// Update all the items
		Object.keys(SettingsTabs)
			.filter((tab) => tab !== 'SearchSettings' && tab !== this.activeTab)
			.forEach((tab) => this.setNavItemCollapsed(tab as SettingsTabWithoutSearch, shouldCollapse));
	}

	// Set the collapsed state of a nav item
	setNavItemCollapsed(tab: SettingsTabWithoutSearch, shouldCollapse: boolean) {
		this.panels.nav
			.FindChild(SettingsTabs[tab].radioid)
			.FindChildrenWithClassTraverse('settings-nav__subsection')[0]
			.SetHasClass('settings-nav__subsection--hidden', shouldCollapse);
	}

	initPanelsRecursive(panel: GenericPanel) {
		for (const child of traverseChildren(panel)) {
			// Initialise info panel event handlers
			if (isSettingsPanel(child) || this.isSpeedometerPanel(child)) {
				this.setPanelInfoEvents(child);
			}

			// Initialise all the settings using persistent storage
			// Only Enum and EnumDropDown are currently supported, others can be added when/if needed
			const psVar = child.GetAttributeString('psvar', '');
			if (psVar) {
				if (child.paneltype === 'SettingsEnum') {
					this.initPersistentStorageEnum(child, psVar);
				} else if (child.paneltype === 'SettingsEnumDropDown') {
					this.initPersistentStorageEnumDropdown(child, psVar);
				}
			}
		}
	}

	initPersistentStorageEnum(panel: SettingsEnum, storageKey: string) {
		for (const child of panel.FindChildTraverse('values').Children()) {
			// Get the value of enum (usually 0: off, 1: on but they can have more values)
			const value = child.GetAttributeInt('value', -1);

			if (value === -1) continue;

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
		}
	}

	initPersistentStorageEnumDropdown(panel: SettingsEnumDropDown, storageKey: string) {
		const dropdown = panel.FindChildTraverse<DropDown>('DropDown');

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

	setPanelInfoEvents(panel: SettingsPanel | GenericPanel) {
		const message = panel.GetAttributeString('infomessage', '');
		// Default to true if not set
		const hasDocs = !(panel.GetAttributeString('hasdocspage', '') === 'false');
		panel.SetPanelEvent('onmouseover', () => {
			// Set onmouseover events for all settings panels
			this.showInfo(
				// If a panel has a specific title use that, if not use the panel's name. Child ID names vary between panel types, blame Valve
				panel.GetAttributeString('infotitle', '') ||
					panel.FindChildTraverse<Label>('Title')?.text ||
					panel.FindChildTraverse<Label>('title')?.text,
				message,
				hasDocs,
				panel.paneltype,
				(panel as SettingsEnum | SettingsEnumDropDown | SettingsSlider).convar ??
					(panel as SettingsKeyBinder)?.bind
			);
		});
	}

	showInfo(title: string, message: string, hasDocs: boolean, paneltype: keyof PanelTagNameMap, convar?: string) {
		// Check we're mousing over a different panel than before, i.e. the title, message and convar aren't all equal
		if (title + message + convar === this.currentInfo) return;

		this.currentInfo = title + message + convar;

		// Get convar display option from PS
		const showConvar = Boolean(convar);
		const isKeybinder = paneltype === 'SettingsKeyBinder';

		// If the panel has a message OR a convar and the convar display option is on, show the info panel
		if (message || showConvar) {
			let switchDelay = 0;

			// If the info panel is closed, open it. If it's already open, play the switch animation
			if (this.panels.info.HasClass('settings-info--hidden')) {
				this.panels.info.RemoveClass('settings-info--hidden');
			} else {
				switchDelay = 0.05; // This should always be half the duration of settings-info--switch

				this.panels.info.TriggerClass('settings-info--switch');
			}

			// Delay changing the properties even we've just played the switch animation,
			// to be half the length of animation, so text changes at apex of the animation
			$.Schedule(switchDelay, () => {
				if (message) {
					this.panels.infoTitle.text = $.Localize(title);
					// I don't want localisation people having to fuss with HTML tags too much so replacing newlines with <br>
					// does linebreaks for us without requiring any <p> tags.
					this.panels.infoMessage.text = $.Localize(message).replaceAll(/\r\n|\r|\n/g, '<br><br>');
					this.panels.infoTitle.RemoveClass('hide');
					this.panels.infoMessage.RemoveClass('hide');
				} else {
					this.panels.infoTitle.AddClass('hide');
					this.panels.infoMessage.AddClass('hide');
				}

				if (showConvar) {
					this.panels.infoConvar.text = `<i>${
						isKeybinder ? $.Localize('#Settings_General_Command') : $.Localize('#Settings_General_Convar')
					}: <b>${convar}</b></i>`;
					this.panels.infoConvar.RemoveClass('hide');
					this.panels.infoDocsButton.SetHasClass('hide', !hasDocs || isKeybinder);
					// Shouldn't need to clear the panel event here as it's hidden or gets overwritten
					this.panels.infoDocsButton.SetPanelEvent('onactivate', () =>
						SteamOverlayAPI.OpenURL(`https://docs.momentum-mod.org/var/${convar}`)
					);
				} else {
					this.panels.infoConvar.AddClass('hide');
					this.panels.infoDocsButton.AddClass('hide');
				}
			});
		} else {
			this.hideInfo();
		}
	}

	hideInfo() {
		// Hide the info panel
		this.panels.info.AddClass('settings-info--hidden');
	}

	styleItem(item: GenericPanel, n: number) {
		item.AddClass(n % 2 === 0 ? '--odd' : '--even');
	}

	styleAlternatingItems(page: Panel) {
		// Search all groups on the page
		for (const group of page.FindChildrenWithClassTraverse('settings-group')) {
			let n = 1; // Start odd

			const search = (panel: GenericPanel) => {
				for (const child of panel?.Children() || []) {
					// If it's a settings panel or a combo panel, style it
					if (isSettingsPanel(child) || child.HasClass('settings-group__combo')) {
						this.styleItem(child, n);
						n++;
					} else {
						search(child);
					}
				}
			};

			search(group);
		}
	}

	saveSettings() {
		$.Msg('Writing settings to file...');
		GameInterfaceAPI.ConsoleCommand('host_writeconfig');
	}

	isSpeedometerPanel(panel: GenericPanel) {
		return ['SpeedometersContainer', 'RangeColorProfilesContainer'].includes(panel.id);
	}
}

	showImportExportDialogue(localeString: string, panelID: string) {
		const section = $.GetContextPanel().FindChildTraverse(panelID);

		const cvars = traverseChildren(section)
			.filter((panel) => isSettingsPanel(panel) && panel.paneltype !== 'SettingsKeyBinder')
			.map((panel) => panel.convar)
			.toArray();

		let cvarParams = '';
		for (const [i, cvar] of cvars.entries()) cvarParams += (i !== 0 ? '&' : '') + 'cvar' + (i + 1) + '=' + cvar;

		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/import-export-settings.xml',
			`${cvarParams}&name=${localeString}`
		);
	}
}
