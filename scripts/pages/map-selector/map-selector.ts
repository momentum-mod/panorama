const TIER_MIN = 1;
const TIER_MAX = 10;

const MapSelNStateClasses = [
	'mapselector-filters__nstatebutton--off',
	'mapselector-filters__nstatebutton--include',
	'mapselector-filters__nstatebutton--exclude'
];

type FilterablePanel = ToggleButton | RadioButton | NStateButton | DualSlider;
type FilterData = { id: string | undefined } & (
	| { paneltype: 'ToggleButton' | 'RadioButton'; checked: boolean }
	| { paneltype: 'NStateButton'; currentstate: number }
	| { paneltype: 'DualSlider'; lowerValue: number; upperValue: number }
);

class MapSelection {
	static gameModeData = {};
	static filtersState: Record<string, FilterData> = {};
	static filtersToggled = false;

	static panels = {
		searchText: $<TextEntry>('#MapSearchTextEntry'),
		searchClear: $<Button>('#MapSearchClear'),
		filtersPanel: $<Panel>('#MapFilters'),
		filtersToggle: $<Button>('#FilterToggle'),
		completedFilterButton: $<NStateButton>('#MapCompletedFilterButton'),
		favoritesFilterButton: $<NStateButton>('#MapFavoritedFilterButton'),
		downloadedFilterButton: $<NStateButton>('#MapDownloadedFilterButton'),
		emptyContainer: $<Panel>('#MapListEmptyContainer'),
		tierSlider: $<DualSlider>('#TierSlider'),
		descriptionContainer: $<Panel>('#MapDescriptionContainer'),
		creditsContainer: $<Panel>('#MapCreditsContainer'),
		datesContainer: $<Panel>('#MapDatesContainer'),
		credits: $<Panel>('#MapCredits'),
		websiteButton: $<Button>('#MapInfoWebsiteButton'),
		tags: $<Label>('#MapTags')
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
			// Load the saved filters state
			const filtersChanged = this.loadFilters();

			// Initialise all the filters events
			this.initFilterSaveEventsRecursive(this.panels.filtersPanel);

			this.panels.searchText.SetPanelEvent('ontextentrychange', () =>
				this.panels.searchClear.SetHasClass('search__clearbutton--hidden', this.panels.searchText.text === '')
			);

			$.GetContextPanel<MomentumMapSelector>().ApplyFilters();

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
		// Reset every NState button
		for (const button of [
			this.panels.completedFilterButton,
			this.panels.favoritesFilterButton,
			this.panels.downloadedFilterButton
		])
			button.currentstate = 0;

		// Reset tier slider
		this.panels.tierSlider.SetValues(TIER_MIN, TIER_MAX);

		// Apply the changes
		$.GetContextPanel<MomentumMapSelector>().ApplyFilters();

		// Save persistent storage state
		this.saveAllFilters();
	}

	/**
	 * Set panel events for all filter elements.
	 * Note, we only start tracking the state once it's been changed once (i.e., it's been added to the filtersState object).
	 * If it doesn't have a storage key then it's not being tracked, just load it in its default state.
	 * @param {Panel} panel The top-level panel to search
	 */
	static initFilterSaveEventsRecursive(panel: IPanel) {
		// Ignore game mode buttons for now. They will be removed in the future.
		if (panel.id === 'GamemodeFilters') return;

		let eventType: string;
		switch (panel.paneltype) {
			case 'ToggleButton':
			case 'RadioButton':
			case 'NStateButton':
				eventType = 'onactivate';
				break;
			case 'DualSlider':
				eventType = 'onvaluechanged';
				break;
			default:
				for (const child of panel?.Children() || []) this.initFilterSaveEventsRecursive(child);
				return;
		}

		panel.SetPanelEvent(eventType, () => this.filterSaveEvent(panel as FilterablePanel));
	}

	/**
	 * An event for filters to register to save properly
	 */
	static filterSaveEvent(panel: FilterablePanel) {
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
	 * @returns If any of the filter's states were changed
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

	/** Set the state of a filter component from a filter data object */
	static setFilterData(panel: ToggleButton | RadioButton | NStateButton | DualSlider | any, data: FilterData) {
		if (panel.paneltype !== data.paneltype) {
			$.Warning(
				`MapSelection:setFilterData: paneltype mismatch. ${panel.id} was ${panel.paneltype}, ${data?.id} was ${data?.paneltype}.`
			);

			// If the paneltypes are off we're in a weird state where the panel type got changed in the XML (say ToggleButton to NStateButton), so just clear the data and return
			this.filtersState[Object.keys(this.filtersState).find((key) => this.filtersState[key] === data)] = null;
			this.saveFilters();

			// Just return true out of this, UX shouldn't be affected if this happens
			return true;
		}

		let wasEqual;
		// Would require some horrific type spaghetti to get typescript to infer this properly
		const _data = data as any;
		switch (panel.paneltype) {
			case 'ToggleButton':
			case 'RadioButton':
				wasEqual = panel.checked === _data.checked;
				panel.checked = _data.checked;
				break;
			case 'NStateButton':
				wasEqual = panel.currentstate === _data.currentstate;
				panel.currentstate = _data.currentstate;
				break;
			case 'DualSlider':
				wasEqual = panel.lowerValue === _data.lowerValue && panel.upperValue === _data.upperValue;
				panel.SetValues(_data.lowerValue, _data.upperValue);
				break;
			default:
				$.Warning('MapSelection:setFilterData: unknown paneltype ' + panel.paneltype);
				return true;
		}
		return wasEqual;
	}

	/** Get the state of a filter component as a filter data object */
	static getFilterData(panel: Panel | FilterablePanel): FilterData | null {
		switch (panel.paneltype) {
			case 'ToggleButton':
			case 'RadioButton':
				return { id: panel.id, paneltype: panel.paneltype, checked: panel.checked };
			case 'NStateButton':
				return { id: panel.id, paneltype: panel.paneltype, currentstate: panel.currentstate };
			case 'DualSlider':
				return {
					id: panel.id,
					paneltype: panel.paneltype,
					lowerValue: panel.lowerValue,
					upperValue: panel.upperValue
				};
			default:
				$.Warning('MapSelection:getFilterData: unknown paneltype');
				return null;
		}
	}

	/**
	 *  Show a popup asking the user if they want to overwrite the map,
	 * only if mom_map_download_cancel_confirm is true
	 */
	static showConfirmOverwrite(mapID: number) {
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
	 * @param mapID The map ID to overwrite
	 */
	static showConfirmCancelDownload(mapID: number) {
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
	 * @param count The number of maps returned by the filter
	 */
	static onMapsFiltered(count: number) {
		const isZero = count === 0;

		this.panels.emptyContainer.SetHasClass('mapselector__emptywarning--hidden', !isZero);

		$.persistentStorage.setItem('mapSelector.mapsFiltersYieldEmptyResults', isZero);
	}

	/*
	 *	Set all the map data for the map just selected
	 */
	static onSelectedDataUpdated() {
		const mapData = $.GetContextPanel<MomentumMapSelector>().selectedMapData;

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
		const authorCredits = mapData.credits.filter((x) => x.type === MapCreditType.AUTHOR);

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
	 * @param panelID The NState button ID
	 * @param state The state of the button (0 = off, 1 = include, 2 = exclude)
	 */
	static onNStateBtnChanged(panelID: string, state: number) {
		const panel = $.GetContextPanel().FindChildTraverse(panelID);

		for (const type of Array.from({ length: 3 }).keys())
			panel.SetHasClass(MapSelNStateClasses[type], state === type);
	}

	/**
	 * Only show the clear button if the search is not empty
	 */
	static onSearchChanged() {}

	/**
	 * Toggles the visibility of the leaderboards panel
	 */
	static toggleLeaderboards() {
		$.GetContextPanel().FindChildTraverse('Leaderboards')?.ToggleClass('mapselector-map-times__list--hidden');
	}
}
