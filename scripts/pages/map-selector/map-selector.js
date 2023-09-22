const TIER_MIN = 1;
const TIER_MAX = 10;

const MapSelNStateClasses = [
	'mapselector-filters__nstatebutton--off',
	'mapselector-filters__nstatebutton--include',
	'mapselector-filters__nstatebutton--exclude'
];

class MapSelection {
	static gameModeData = {};
	static filtersState = {};
	static timesModeButtonsUnchecked = 0;

	static panels = {
		/** @type {TextEntry} @static */
		searchText: $('#MapSearchTextEntry'),
		/** @type {Button} @static */
		searchClear: $('#MapSearchClear'),
		/** @type {Panel} @static */
		filtersPanel: $('#MapFilters'),
		/** @type {Button} @static */
		filtersToggle: $('#FilterToggle'),
		/** @type {Button} @static */
		completedFilterButton: $('#MapCompletedFilterButton'),
		/** @type {Button} @static */
		favoritesFilterButton: $('#MapFavoritedFilterButton'),
		/** @type {Button} @static */
		downloadedFilterButton: $('#MapDownloadedFilterButton'),
		/** @type {Panel} @static */
		emptyContainer: $('#MapListEmptyContainer'),
		/** @type {DualSlider} @static */
		tierSlider: $('#TierSlider'),
		/** @type {Panel} @static */
		descriptionContainer: $('#MapDescriptionContainer'),
		/** @type {Panel} @static */
		creditsContainer: $('#MapCreditsContainer'),
		/** @type {Panel} @static */
		datesContainer: $('#MapDatesContainer'),
		/** @type {Panel} @static */
		credits: $('#MapCredits'),
		/** @type {Button} @static */
		websiteButton: $('#MapInfoWebsiteButton'),
		/** @type {Label} @static */
		tags: $('#MapTags')
	};

	static {
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmCancelDownload', this.showConfirmCancelDownload.bind(this));
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmOverwrite', this.showConfirmOverwrite.bind(this));
		$.RegisterForUnhandledEvent('MapSelector_MapsFiltered', this.onMapsFiltered.bind(this));
		$.RegisterForUnhandledEvent('MapSelector_SelectedDataUpdate', this.onSelectedDataUpdated.bind(this));

		$.RegisterEventHandler('NStateButtonStateChanged', this.panels.completedFilterButton, this.onNStateBtnChanged);
		$.RegisterEventHandler('NStateButtonStateChanged', this.panels.favoritesFilterButton, this.onNStateBtnChanged);
		$.RegisterEventHandler('NStateButtonStateChanged', this.panels.downloadedFilterButton, this.onNStateBtnChanged);

		$.RegisterEventHandler('PanelLoaded', $.GetContextPanel(), () => {
			// Populate the gameModeData object, finding all the filter buttons
			this.gameModeData = { ...GameModeInfoWithNull };

			for (const mode of Object.keys(this.gameModeData))
				this.gameModeData[mode].filterButton = $(`#${this.gameModeData[mode].idName}FilterButton`);

			// Load the saved filters state
			const filtersChanged = this.loadFilters();

			// Initialise all the filters events
			this.initFilterSaveEventsRecursive(this.panels.filtersPanel);

			this.timesModeButtonsUnchecked = 0;

			// Set this event here rather than XML to avoid error on reload (???)
			this.panels.searchText.SetPanelEvent('ontextentrychange', this.onSearchChanged.bind(this));

			// Initialise the gamemode button events
			this.initGamemodeButtons();

			$.GetContextPanel().ApplyFilters();

			if (($.persistentStorage.getItem('mapSelector.filtersToggled') ?? false) || filtersChanged) {
				$.DispatchEvent('Activated', this.panels.filtersToggle, 'mouse');
			}

			$.DispatchEvent('MapSelector_OnLoaded');
		});
	}

	/**
	 * Temporary way of requesting a map list update
	 */
	static requestMapUpdate() {
		this.panels.searchText.Submit();
		UiToolkitAPI.ShowCustomLayoutTooltip('MapFilters', '', 'file://{resources}/layout/modals/tooltips/test.xml');
	}

	/**
	 *  Set the panel events for gamemode buttons
	 */
	static initGamemodeButtons() {
		for (const [mode, values] of Object.entries(this.gameModeData)) {
			const filterButton = values.filterButton;
			if (filterButton === null) continue;

			filterButton.SetPanelEvent('oncontextmenu', () => this.clearOtherModes(mode));
			filterButton.SetPanelEvent('onactivate', () => {
				this.onModeButtonPressed(mode);
				this.filterSaveEvent(filterButton);
			});
		}
	}

	/**
	 * Check whether all the other gamemode buttons are unchecked
	 * @param {Object} selectedMode A gamemodeData Object
	 * @returns {Boolean} If all other modes are unchecked
	 */
	static areAllOtherModesUnchecked(selectedMode) {
		return Object.entries(this.gameModeData)
			.filter(([mode, _]) => mode !== selectedMode)
			.every(([_, modeData]) => !(modeData.filterButton && modeData.filterButton.checked));
	}

	/**
	 * The behaviour when right-clicking gamemode buttons.
	 * Right-clicking a checked button will clear all other buttons, and right-clicking a checked button
	 * will activate all other buttons.
	 * @param {Object} selectedMode A gamemodeData Object
	 */
	static clearOtherModes(selectedMode) {
		// Set unchecked counter to -1, if you're using this you've got the hang of it, no more popups for you!
		this.timesModeButtonsUnchecked = -1;

		const selectedModeButton = this.gameModeData[selectedMode].filterButton;

		// No matter what, we want our selected button to be checked
		if (!selectedModeButton.checked) {
			selectedModeButton.SetSelected(true);
		}

		const areOthersUnchecked = this.areAllOtherModesUnchecked(selectedMode);

		for (const [_, modeData] of Object.entries(this.gameModeData).filter(
			([mode, modeData]) => mode !== selectedMode && modeData.filterButton
		)) {
			const filterButton = modeData.filterButton;
			if (areOthersUnchecked) {
				// Others ARE all unchecked, so let's toggle them all back on
				filterButton.SetSelected(true);
			} else {
				// Others are NOT all unchecked, so we want to uncheck them if not already
				if (filterButton.checked) {
					filterButton.SetSelected(false);
				}
			}
		}

		$.GetContextPanel().ApplyFilters();

		this.saveAllFilters();
	}

	/**
	 * Fired when a gamemode button is pressed. Tracks the number of presses
	 * and shows a tooltip if you manually unchecked too many.
	 * @param {Object} selectedMode A gamemodeData Object
	 */
	static onModeButtonPressed(mode) {
		if (this.timesModeButtonsUnchecked === -1)
			// They've already right clicked
			return;

		const button = this.gameModeData[mode].filterButton;

		// If button was unchecked then increment the counter
		if (!button.checked) {
			this.timesModeButtonsUnchecked++;

			// Show tooltip if times unchecked equal to all the modes minus the last remaining mode and the null mode
			if (this.timesModeButtonsUnchecked === Object.keys(this.gameModeData).length - 2) {
				UiToolkitAPI.ShowTextTooltipStyled(
					button.id,
					$.Localize('#MapSelector_Filters_RightClickTip'),
					'tooltip--positive'
				);
				$.Schedule(3, () => UiToolkitAPI.HideTextTooltip());
				this.timesModeButtonsUnchecked = 0; // Reset the counter
			}
			// If a mode was just checked, reset the counter (bound to >= 0, counter can be negative when unchecked through code done asyncronously)
			// } else if (this.timesModeButtonsUnchecked > 0) {
			// 	this.timesModeButtonsUnchecked = 0;
		} else this.timesModeButtonsUnchecked--;
	}

	/**
	 * Clear the search bar.
	 */
	static clearSearch() {
		this.panels.searchText.text = '';
	}

	/**
	 * Toggles the filters panel. Tracks state in persistent storage.
	 */
	static toggleFilterCollapse() {
		this.filtersToggled = !this.filtersToggled;

		$.persistentStorage.setItem('mapSelector.filtersToggled', this.filtersToggled);

		this.panels.filtersPanel.SetHasClass('mapselector-filters--filters-extended', this.filtersToggled);
	}

	/**
	 * Clear all the filters, resetting to the default state
	 */
	static clearFilters() {
		// Uncheck every checked gamemode button
		for (const modeData of Object.values(this.gameModeData)) {
			const button = modeData.filterButton;
			if (button && !button.checked) button.SetSelected(true);
		}

		// Reset every NState button
		for (const button of [
			this.panels.completedFilterButton,
			this.panels.favoritesFilterButton,
			this.panels.downloadedFilterButton
		])
			button.currentstate = 0;

		// Reset tier slider
		this.panels.tierSlider.SetValues(TIER_MIN, TIER_MAX);

		this.timesModeButtonsUnchecked = 0;

		// Apply the changes
		$.GetContextPanel().ApplyFilters();

		// Save persistent storage state
		this.saveAllFilters();
	}

	/**
	 * Set panel events for all filter elements.
	 * Note, we only start tracking the state once it's been changed once (i.e., it's been added to the filtersState object).
	 * If it doesn't have a storage key then it's not being tracked, just load it in its default state.
	 * @param {Panel} panel The top-level panel to search
	 */
	static initFilterSaveEventsRecursive(panel) {
		if (['ToggleButton', 'RadioButton', 'NStateButton', 'DualSlider'].includes(panel.paneltype)) {
			let eventType;
			switch (panel.paneltype) {
				case 'ToggleButton':
				case 'RadioButton':
				case 'NStateButton':
					eventType = 'onactivate';
					break;
				case 'DualSlider':
					eventType = 'onvaluechanged';
					break;
			}

			panel.SetPanelEvent(eventType, () => this.filterSaveEvent(panel));
		} else {
			for (const child of panel?.Children() || []) this.initFilterSaveEventsRecursive(child);
		}
	}

	/**
	 * An event for filters to register to save properly
	 * @param {Panel} panel The panel that triggered the event
	 */
	static filterSaveEvent(panel) {
		this.filtersState[panel.id] = this.getFilterData(panel);

		// Just saving this every time as ps only writes on quit so setItem should be cheap
		this.saveFilters();
	}

	/**
	 * Search all the filters we're storing and get their current state, then save them to PS
	 */
	static saveAllFilters() {
		if (!this.filtersState) return;

		for (const panelID of Object.keys(this.filtersState)) {
			const panel = $.GetContextPanel().FindChildTraverse(panelID);

			if (panel) this.filtersState[panelID] = this.getFilterData(panel);
		}

		this.saveFilters();
	}

	/*
	 * Save the filter state object to persistent storage
	 */
	static saveFilters() {
		$.persistentStorage.setItem('mapSelector.filtersState', this.filtersState);
	}

	/**
	 * Load the saved state of all filter components from persistent storage, and apply them to the UI
	 * @returns {Boolean} If any of the filter's states were changed
	 */
	static loadFilters() {
		// If the filter selection yielded empty results on last exit, clear them
		if ($.persistentStorage.getItem('mapSelector.mapsFiltersYieldEmptyResults')) {
			this.filtersState = {};
			return;
		}

		this.filtersState = $.persistentStorage.getItem('mapSelector.filtersState') ?? {};

		let filtersChanged = false;
		for (const panelID of Object.keys(this.filtersState)) {
			const panel = $.GetContextPanel().FindChildTraverse(panelID);

			// Set the filter's state, and if it returns that it the state changed set the value to true
			if (panel && !this.setFilterData(panel, this.filtersState[panelID])) {
				filtersChanged = true;
			}
		}

		return filtersChanged;
	}

	/**
	 * Set the state of a filter component from a filter data object
	 * @param {Panel} panel The filter component
	 * @param {Object} filterData The filter data object to set the state from
	 * @return {Boolean} Whether the data matched the default filter state
	 */
	static setFilterData(panel, data) {
		if (panel.paneltype !== data.paneltype) {
			$.Warning(
				`MapSelection:setFilterData: paneltype mismatch. ${panel.id} was ${panel.paneltype}, ${data.id} was ${data.paneltype}.`
			);

			// If the paneltypes are off we're in a weird state where the panel type got changed in the XML (say ToggleButton to NStateButton), so just clear the data and return
			this.filtersState[Object.keys(this.filtersState).find((key) => this.filtersState[key] === data)] = null;
			this.saveFilters();

			// Just return true out of this, UX shouldn't be affected if this happens
			return true;
		}

		let wasEqual;
		switch (panel.paneltype) {
			case 'ToggleButton':
			case 'RadioButton':
				wasEqual = panel.checked === data.checked;
				panel.checked = data.checked;
				break;
			case 'NStateButton':
				wasEqual = panel.currentstate === data.currentstate;
				panel.currentstate = data.currentstate;
				break;
			case 'DualSlider':
				wasEqual = panel.lowerValue === data.lowerValue && panel.upperValue === data.upperValue;
				panel.SetValues(data.lowerValue, data.upperValue);
				break;
			default:
				$.Warning('MapSelection:setFilterData: unknown paneltype ' + panel.paneltype);
				return true;
		}
		return wasEqual;
	}

	/**
	 *	Get the state of a filter component as a filter data object
	 *	@param {Panel} panel The filter component
	 *	@return {Object} The filter data object
	 */
	static getFilterData(panel) {
		switch (panel.paneltype) {
			case 'ToggleButton':
			case 'RadioButton':
				return { paneltype: panel.paneltype, checked: panel.checked };
			case 'NStateButton':
				return { paneltype: panel.paneltype, currentstate: panel.currentstate };
			case 'DualSlider':
				return { paneltype: panel.paneltype, lowerValue: panel.lowerValue, upperValue: panel.upperValue };
			default:
				$.Warning('MapSelection:getFilterData: unknown paneltype');
				return null;
		}
	}

	/**
	 * Show a popup asking the user if they want to overwrite the map, only if mom_map_download_cancel_confirm is true
	 * @param {String} mapID The map ID to overwrite
	 */
	static showConfirmOverwrite(mapID) {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#Action_ConfirmOverwrite'),
			$.Localize('#Action_ConfirmOverwrite_Message'),
			'ok-cancel-popup',
			() => $.DispatchEvent('MapSelector_ConfirmOverwrite', mapID),
			() => {}
		);
	}

	/**
	 * Show a popup asking the user if they want to cancel an ongoing map download
	 * @param {String} mapID The map ID to overwrite
	 */
	static showConfirmCancelDownload(mapID) {
		const cancel = () => $.DispatchEvent('MapSelector_ConfirmCancelDownload', mapID);

		if (GameInterfaceAPI.GetSettingBool('mom_map_download_cancel_confirm')) {
			UiToolkitAPI.ShowGenericPopupOkCancel(
				$.Localize('#Action_ConfirmCancel'),
				$.Localize('#Action_ConfirmCancel_Message'),
				'ok-cancel-popup',
				cancel,
				() => {}
			);
		} else {
			cancel();
		}
	}

	/**
	 * Listens to filter changes, if no maps are returned shows the empty warning and tracks in persistent storage
	 * @param {number} count The number of maps returned by the filter
	 */
	static onMapsFiltered(count) {
		const isZero = count === 0;

		this.panels.emptyContainer.SetHasClass('mapselector__emptywarning--hidden', !isZero);

		$.persistentStorage.setItem('mapSelector.mapsFiltersYieldEmptyResults', isZero);
	}

	/*
	 *	Set all the map data for the map just selected
	 */
	static onSelectedDataUpdated() {
		const mapData = $.GetContextPanel().selectedMapData;

		if (!mapData) return;

		// Set the description and creation date text
		$.GetContextPanel().SetDialogVariable('description', mapData.info?.description);
		this.panels.descriptionContainer.SetHasClass('hide', !mapData.info?.description);

		const date = new Date(mapData.info?.creationDate);

		$.GetContextPanel().SetDialogVariable('date', date.toLocaleDateString());
		this.panels.datesContainer.SetHasClass('hide', !mapData.info?.creationDate);

		// Clear the credits from the last map
		this.panels.credits.RemoveAndDeleteChildren();

		// Find all authors
		const authorCredits = mapData.credits.filter((x) => x.type === 'author');

		const hasCredits = authorCredits.length > 0;

		this.panels.creditsContainer.SetHasClass('hide', !hasCredits);

		if (hasCredits) {
			// Add them to the panel
			for (const [i, credit] of authorCredits.entries()) {
				const namePanel = $.CreatePanel('Label', this.panels.credits, '', {
					text: credit.user.alias,
					class: 'mapselector-credits__text mapselector-credits__name'
				});

				if (credit.user.xuid !== '0') {
					namePanel.AddClass('mapselector-credits__name--steam');

					// This will become a player profile panel in the future
					namePanel.SetPanelEvent('onactivate', () => {
						UiToolkitAPI.ShowSimpleContextMenu(namePanel.id, '', [
							{
								label: $.Localize('#Action_ShowSteamProfile'),
								jsCallback: () => SteamOverlayAPI.OpenToProfileID(credit.user.xuid)
							}
						]);
					});
				}

				if (i < authorCredits.length - 1) {
					const commaPanel = $.CreatePanel('Label', this.panels.credits, '');
					commaPanel.AddClass('mapselector-credits__text');
					commaPanel.text = ',  ';
				}
			}
		}

		// Set the website button link
		this.panels.websiteButton.SetPanelEvent('onactivate', () =>
			SteamOverlayAPI.OpenURL(`https://momentum-mod.org/dashboard/maps/${mapData.id}`)
		);
	}

	/**
	 * When a NState button is pressed, update its styling classes
	 * @param {string} panelID The NState button ID
	 * @param {number} state The state of the button (0 = off, 1 = include, 2 = exclude)
	 */
	static onNStateBtnChanged(panelID, state) {
		const panel = $.GetContextPanel().FindChildTraverse(panelID);

		for (const type of Array.from({ length: 3 }).keys())
			panel.SetHasClass(MapSelNStateClasses[type], state === type);
	}

	/**
	 * Only show the clear button if the search is not empty
	 */
	static onSearchChanged() {
		this.panels.searchClear.SetHasClass('search__clearbutton--hidden', this.panels.searchText.text === '');
	}

	/**
	 * Toggles the visibility of the leaderboards panel
	 */
	static toggleLeaderboards() {
		$.GetContextPanel().FindChildTraverse('Leaderboards')?.ToggleClass('mapselector-map-times__list--hidden');
	}
}
