const _ = UiToolkitAPI.GetGlobalObject();

const TIER_MIN = 1;
const TIER_MAX = 10;

const MapSelNStateClasses = [
	'mapselector-filters__nstatebutton--off',
	'mapselector-filters__nstatebutton--include',
	'mapselector-filters__nstatebutton--exclude'
];

// This types are overcomplicated, but it's a good example of how to use typescript to derive the structure we want.
// If this is a problem in the future, I've no problem with getting rid of them and casting more, but used this to get
// a feel for TypeScript + Panorama especially using PanelTagNameMap.
type FilterablePanelName = 'ToggleButton' | 'NStateButton' | 'DualSlider';
type FilterablePanel = PanelTagNameMap[FilterablePanelName];
type FilterableData = {
	[K in FilterablePanelName]: {
		// Don't have an type for these yet.
		event: string;
		// The properties we'll store values for.
		// Properties are an array of all the keys of properties for the panel in question.
		// This enforces that e.g. ToggleButton has a 'checked' property, but 'lowerValue' won't work; that's only on
		// DualSlider.
		properties: Array<keyof PanelTagNameMap[K]>;
	};
};
type Filters = {
	// Keys here are panelIDs so just strings, but map a PanelName into this object to use in inner properties:
	[PanelName in FilterablePanelName as string]: {
		paneltype: PanelName;
		properties: {
			// Properties is an object with keys being properties we're storing (which we constrain to be actual keys of the
			// properties of the given panel type), their values being the corresponding type of the value of that property.
			// Uses a conditional to constrain the property is to JsonValue, since persistent storage only allows JsonValues.
			[Property in keyof PanelTagNameMap[PanelName]]?: PanelTagNameMap[PanelName][Property] extends JsonValue
				? PanelTagNameMap[PanelName][Property]
				: never;
		};
	};
};

const FilterablePanels: FilterableData = {
	ToggleButton: { event: 'onactivate', properties: ['checked'] },
	NStateButton: { event: 'onactivate', properties: ['currentstate'] },
	DualSlider: { event: 'onvaluechanged', properties: ['lowerValue', 'upperValue'] }
};

class MapSelection {
	static filters: Filters = {};

	static panels = {
		cp: $.GetContextPanel<MomentumMapSelector>(),
		searchText: $<TextEntry>('#MapSearchTextEntry'),
		searchClear: $<Button>('#MapSearchClear'),
		filtersPanel: $<Panel>('#MapFilters'),
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
			this.loadFilters();

			// Initialise all the filters events
			this.initSaveEvents(this.panels.filtersPanel);

			this.panels.searchText.SetPanelEvent('ontextentrychange', () =>
				this.panels.searchClear.SetHasClass('search__clearbutton--hidden', this.panels.searchText.text === '')
			);

			this.panels.cp.ApplyFilters();

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
		this.panels.cp.ApplyFilters();

		// Clear persistent storage state. Nothing wrong with just resetting to a blank object; it'll mean in some cases
		// a panel's state is saved to PS but with default state (e.g. when user changes from default and back), whilst in
		// this case it's not stored in PS at all - either is fine.
		// is fine for us.
		this.filters = {};
		this.saveFilters();
	}
	/**
	 * Set panel events for all filter elements.
	 * Note, we only start tracking the state once it's been changed once (i.e., it's been added to the filtersState object).
	 * If it doesn't have a storage key then it's not being tracked, just load it in its default state.
	 */
	static initSaveEvents(panel: GenericPanel) {
		function isPanel<K extends keyof PanelTagNameMap>(panel: GenericPanel, type: K): panel is PanelTagNameMap[K] {
			return panel.paneltype === type;
		}
		if (panel.paneltype === 'ToggleButton') {
			const a = panel;
		}
		const filterable = Object.keys(FilterablePanels);
		// Find every panel of paneltype that we want to store.
		// TODO: spread not needed when we have iterator methods when on latest v8/TS
		[...traverseChildren(panel)]
			.filter(({ paneltype }) => filterable.includes(paneltype))
			.forEach((panel: FilterablePanel) =>
				panel.SetPanelEvent(FilterablePanels[panel.paneltype].event, () => {
					// When the change event is fired on this panel, get all the data for this panel that we want to store and
					// stick it on the filters object.
					this.filters[panel.id] = this.getFilterData(panel);

					// Save filters out to PS. This isn't written out until save so perf is fine.
					this.saveFilters();
				})
			);
	}

	/*
	 * Save the filter state object to persistent storage
	 */
	static saveFilters() {
		$.Msg({ filters: this.filters });
		$.persistentStorage.setItem('mapSelector.filtersState', this.filters);
	}

	/**
	 * Load the saved state of all filter components from persistent storage, and apply them to the UI
	 * @returns If any of the filter's states were changed
	 */
	static loadFilters() {
		// If the filter selection yielded empty results on last exit, clear them
		if ($.persistentStorage.getItem('mapSelector.mapsFiltersYieldEmptyResults')) {
			this.filters = {};
			return;
		}

		this.filters = $.persistentStorage.getItem('mapSelector.filtersState') ?? {};

		for (const [panelID, panelData] of Object.entries(this.filters)) {
			const panel = $.GetContextPanel().FindChildTraverse(panelID);

			try {
				if (!panel || panel.paneltype !== panelData.paneltype) {
					throw undefined;
				}
				// Set the filter's state, and if it returns that it the state changed set the value to true
				this.setFilterData(panel as FilterablePanel, this.filters[panelID]);
			} catch {
				$.Warning(`MapSelection:loadFilters: panel ${panelID} not found in filters object, resetting`);
				this.filters = {};
				this.saveFilters();
				return;
			}
		}
	}

	/** Set the state of a filter component from a filter data object */
	static setFilterData<T extends FilterablePanelName>(panel: PanelTagNameMap[T], data: Filters[T]) {
		Object.entries(data.properties).forEach(([key, value]) => {
			if (panel[key] !== value) {
				panel[key] = value;
			}
		});
	}

	/** Get the state of a filter component as a filter data object */
	static getFilterData<T extends FilterablePanelName>(panel: PanelTagNameMap[T]): Filters[T] | null {
		const props = FilterablePanels[panel?.paneltype]?.properties;
		if (!props) {
			$.Warning(`MapSelection:getFilterData: panel ${panel.id} not found in filters object`);
			return null;
		}

		const data = {
			paneltype: panel.paneltype,
			id: panel.id,
			properties: Object.fromEntries(props.map((prop) => [prop, panel[prop]]))
		};

		for (const prop of props) {
			data.properties[prop] = panel[prop];
		}

		return data;
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
