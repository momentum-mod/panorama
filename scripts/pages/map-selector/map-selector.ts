import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { traverseChildren } from 'util/functions';
import { MapCreditType } from 'common/web';

enum NStateButtonState {
	OFF = 0,
	INCLUDE = 1,
	EXCLUDE = 2
}

const NStateButtonClasses: ReadonlyMap<NStateButtonState, string> = new Map([
	[NStateButtonState.OFF, 'mapselector-filters__nstatebutton--off'],
	[NStateButtonState.INCLUDE, 'mapselector-filters__nstatebutton--include'],
	[NStateButtonState.EXCLUDE, 'mapselector-filters__nstatebutton--exclude']
]);

/**
 *  Structure of the data from filter panels we store to persistent storage, e.g.
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

@PanelHandler()
class MapSelectorHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<MomentumMapSelector>(),
		searchText: $<TextEntry>('#MapSearchTextEntry'),
		searchClear: $<Button>('#MapSearchClear'),
		filtersPanel: $<Panel>('#MapFilters'),
		nStateButtons: [
			$<NStateButton>('#MapCompletedFilterButton'),
			$<NStateButton>('#MapFavoritedFilterButton'),
			$<NStateButton>('#MapDownloadedFilterButton')
		],
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
	readonly filterablePanels = {
		ToggleButton: { event: 'onactivate', properties: ['checked'] },
		NStateButton: { event: 'onactivate', properties: ['currentstate'] },
		DualSlider: { event: 'onvaluechanged', properties: ['lowerValue', 'upperValue'] }
	};

	readonly tierMin = 1;
	readonly tierMax = 1;

	constructor() {
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmCancelDownload', (mapID) =>
			this.showConfirmCancelDownload(mapID)
		);
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmOverwrite', (mapID) => this.showConfirmOverwrite(mapID));
		$.RegisterForUnhandledEvent('MapSelector_MapsFiltered', (count) => this.onMapsFiltered(count));
		$.RegisterForUnhandledEvent('MapSelector_SelectedDataUpdate', () => this.onSelectedDataUpdated());

		this.panels.nStateButtons.forEach((panel) =>
			$.RegisterEventHandler('NStateButtonStateChanged', panel, (panelID, state) =>
				this.onNStateBtnChanged(panelID, state as NStateButtonState)
			)
		);
	}

	onPanelLoad() {
		// Load any saved filter state from persistent storage
		this.loadFilters();

		// Initialise all the filters events
		this.setupFilterSaveEvents(this.panels.filtersPanel);

		this.panels.searchText.SetPanelEvent('ontextentrychange', () =>
			this.panels.searchClear.SetHasClass('search__clearbutton--hidden', this.panels.searchText.text === '')
		);

		this.panels.cp.ApplyFilters();

		$.DispatchEvent('MapSelector_OnLoaded');
	}

	/**
	 * Temporary way of requesting a map list update
	 */
	requestMapUpdate() {
		this.panels.searchText.Submit();
		UiToolkitAPI.ShowCustomLayoutTooltip('MapFilters', '', 'file://{resources}/layout/modals/tooltips/test.xml');
	}

	/**
	 * Clear the search bar.
	 */
	clearSearch() {
		this.panels.searchText.text = '';
	}

	/**
	 * Clear all the filters, resetting to the default state
	 */
	clearFilters() {
		// Reset every NState button
		for (const button of this.panels.nStateButtons) {
			button.currentstate = 0;
		}

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
	setupFilterSaveEvents(panel: GenericPanel) {
		// Find every panel of paneltype that we want to store
		// TODO: spread not needed when we have iterator methods when on latest v8/TS
		[...traverseChildren(panel)]
			.filter(({ paneltype }) => Object.keys(this.filterablePanels).includes(paneltype))
			.forEach((panel) => {
				const paneltype = panel.paneltype as keyof typeof this.filterablePanels;
				panel.SetPanelEvent(this.filterablePanels[paneltype].event, () => {
					// When the change event is fired on this panel, get all the data for this panel that we want to
					// store, and update the stored filters in PS.
					const propertiesToStore = this.filterablePanels[paneltype]?.properties;
					if (!propertiesToStore) {
						return;
					}

					const storedFilters = this.getFiltersFromPS();
					if (!storedFilters) {
						return;
					}

					storedFilters[panel.id] = {
						paneltype,
						// Pick properties we defined in filterablePanels. Not bothering with complicated types for this.
						properties: Object.fromEntries(
							propertiesToStore.map((prop) => [prop, panel[prop as keyof typeof panel]])
						) as any
					};

					this.saveFiltersToPS(storedFilters);
				});
			});
	}

	/** Load the saved state of all filter components from persistent storage, and apply them to the UI */
	loadFilters() {
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
						if (panel[key as keyof typeof panel] !== value) {
							(panel[key as keyof typeof panel] as any) = value; // Cba to prove this only non-readonly properties
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

	getFiltersFromPS(): StoredFilters {
		return $.persistentStorage.getItem('mapSelector.filtersState') ?? {};
	}

	saveFiltersToPS(filters: StoredFilters) {
		$.persistentStorage.setItem('mapSelector.filtersState', filters);
	}

	/**
	 *  Show a popup asking the user if they want to overwrite the map,
	 * only if mom_map_download_cancel_confirm is true
	 */
	showConfirmOverwrite(mapID: number) {
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
	showConfirmCancelDownload(mapID: number) {
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
	onMapsFiltered(count: number) {
		const isZero = count === 0;

		this.panels.emptyContainer.SetHasClass('mapselector__emptywarning--hidden', !isZero);

		$.persistentStorage.setItem('mapSelector.mapsFiltersYieldEmptyResults', isZero);
	}

	/*
	 *	Set all the map data for the map just selected
	 */
	onSelectedDataUpdated() {
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

	/** When a NState button is pressed, update its styling classes */
	onNStateBtnChanged(panelID: string, state: NStateButtonState) {
		const panel = this.panels.cp.FindChildTraverse(panelID);

		// TODO: Iterator method when on latest v8/TS
		[...NStateButtonClasses.entries()].forEach(([i, className]) =>
			$(`#${panelID}`).SetHasClass(className, state === i)
		);
	}

	/**
	 * Toggles the visibility of the leaderboards panel
	 */
	toggleLeaderboards() {
		this.panels.cp.FindChildTraverse('Leaderboards')?.ToggleClass('mapselector-map-times__list--hidden');
	}
}
