export const Globals = UiToolkitAPI.GetGlobalObject() as Globals;

/** Structure of the data from filter panels we store to persistent storage, e.g.
 * {
 * 		TierSlider: {
 * 			paneltype: "DualSlider",
 * 			properties: {
 * 				checked: true
 * 			}
 * 		}
 * }
 */
type StoredFilters = {
	[panelID: string]:
		| { paneltype: 'ToggleButton'; properties: { checked: boolean } }
		| { paneltype: 'NStateButton'; properties: { currentstate: int32 } }
		| { paneltype: 'DualSlider'; properties: { lowerValue: float; upperValue: float } };
};

class MapSelector {
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

	// Describing which data on which type of panel we want to store out to PS.
	static readonly filterablePanels = {
		ToggleButton: { event: 'onactivate', properties: ['checked'] },
		NStateButton: { event: 'onactivate', properties: ['currentstate'] },
		DualSlider: { event: 'onvaluechanged', properties: ['lowerValue', 'upperValue'] }
	};

	static readonly tierMin = 1;
	static readonly tierMax = 1;

	static {
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmCancelDownload', this.showConfirmCancelDownload.bind(this));
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmOverwrite', this.showConfirmOverwrite.bind(this));
		$.RegisterForUnhandledEvent('MapSelector_MapsFiltered', this.onMapsFiltered.bind(this));
		$.RegisterForUnhandledEvent('MapSelector_SelectedDataUpdate', this.onSelectedDataUpdated.bind(this));

		$.RegisterEventHandler('NStateButtonStateChanged', this.panels.completedFilterButton, this.onNStateBtnChanged);
		$.RegisterEventHandler('NStateButtonStateChanged', this.panels.favoritesFilterButton, this.onNStateBtnChanged);
		$.RegisterEventHandler('NStateButtonStateChanged', this.panels.downloadedFilterButton, this.onNStateBtnChanged);

		$.RegisterEventHandler('PanelLoaded', $.GetContextPanel(), () => {
			// Load any saved filter state from persistent storage
			this.loadFilters();

			// Initialise all the filters events
			this.setupFilterSaveEvents(this.panels.filtersPanel);

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
		this.panels.tierSlider.SetValues(this.tierMin, this.tierMax);

		// Apply the changes
		this.panels.cp.ApplyFilters();

		// Clear persistent storage state. Nothing wrong with just resetting to a blank object. This will mean that in
		// some cases a panel's state is saved to PS but with default state (e.g. when user changes from default and
		// back), whilst in this case it's not stored in PS at all - either is fine.
		this.saveFiltersToPS({});
	}

	/** Set up panel events to update filter panel properties in persistent storage whenever they change. */
	static setupFilterSaveEvents(panel: GenericPanel) {
		// Find every panel of paneltype that we want to store
		// TODO: spread not needed when we have iterator methods when on latest v8/TS
		[...Globals.Util.traverseChildren(panel)]
			.filter(({ paneltype }) => Object.keys(this.filterablePanels).includes(paneltype))
			.forEach((panel: PanelTagNameMap[keyof typeof this.filterablePanels]) =>
				panel.SetPanelEvent(this.filterablePanels[panel.paneltype].event, () => {
					// When the change event is fired on this panel, get all the data for this panel that we want to
					// store, and update the stored filters in PS.
					const propertiesToStore = this.filterablePanels[panel?.paneltype]?.properties;
					if (!propertiesToStore) {
						return;
					}

					const storedFilters = this.getFiltersFromPS();
					if (!storedFilters) {
						return;
					}

					storedFilters[panel.id] = {
						paneltype: panel.paneltype,
						// Pick properties we defined in filterablePanels. Not bothering with complicated types for this.
						properties: Object.fromEntries(propertiesToStore.map((prop) => [prop, panel[prop]])) as any
					};

					this.saveFiltersToPS(storedFilters);
				})
			);
	}

	/** Load the saved state of all filter components from persistent storage, and apply them to the UI */
	static loadFilters() {
		// If the filter selection yielded empty results on last exit, clear them
		if ($.persistentStorage.getItem('mapSelector.mapsFiltersYieldEmptyResults')) {
			return;
		}

		const filters = $.persistentStorage.getItem('mapSelector.filtersState') as StoredFilters | null;
		if (!filters) {
			return;
		}

		for (const [panelID, panelData] of Object.entries(filters)) {
			const panel = $.GetContextPanel().FindChildTraverse(panelID);

			try {
				if (!panel || panel.paneltype !== panelData.paneltype) {
					throw undefined;
				} else {
					for (const [key, value] of Object.entries(panelData.properties)) {
						if (panel[key] !== value) {
							panel[key] = value;
						}
					}
				}
			} catch {
				// If anything goes wrong here, just reset filters to their default state - they're not precious.
				$.Warning(`MapSelection:loadFilters: panel ${panelID} not found in filters object, resetting`);
				$.persistentStorage.setItem('mapSelector.filtersState', {});
				return;
			}
		}
	}

	static getFiltersFromPS(): StoredFilters {
		return $.persistentStorage.getItem('mapSelector.filtersState') ?? {};
	}

	static saveFiltersToPS(filters: StoredFilters) {
		$.persistentStorage.setItem('mapSelector.filtersState', filters);
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
		const authorCredits = mapData.credits.filter((x) => x.type === Globals.Web.MapCreditType.AUTHOR);

		const hasCredits = authorCredits.length > 0;

		this.panels.creditsContainer.SetHasClass('hide', !hasCredits);

		if (hasCredits) {
			// Add them to the panel
			for (const [i, credit] of authorCredits.entries()) {
				const namePanel = $.CreatePanel('Label', this.panels.credits, '', {
					text: credit.user.alias,
					class: 'mapselector-credits__text mapselector-credits__name'
				});

				if (credit.user.steamID !== '0') {
					namePanel.AddClass('mapselector-credits__name--steam');

					// This will become a player profile panel in the future
					namePanel.SetPanelEvent('onactivate', () => {
						UiToolkitAPI.ShowSimpleContextMenu(namePanel.id, '', [
							{
								label: $.Localize('#Action_ShowSteamProfile'),
								jsCallback: () => SteamOverlayAPI.OpenToProfileID(credit.user.steamID)
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
	 */
	static onNStateBtnChanged(panelID: string, state: 0 | 1 | 2) {
		const panel = $.GetContextPanel().FindChildTraverse(panelID);

		// TODO: Iterator method when on latest v8/TS
		[
			...[
				'mapselector-filters__nstatebutton--off',
				'mapselector-filters__nstatebutton--include',
				'mapselector-filters__nstatebutton--exclude'
			].entries()
		].forEach(([i, className]) => panel.SetHasClass(className, state === i));
	}

	/**
	 * Toggles the visibility of the leaderboards panel
	 */
	static toggleLeaderboards() {
		$.GetContextPanel().FindChildTraverse('Leaderboards')?.ToggleClass('mapselector-map-times__list--hidden');
	}
}
