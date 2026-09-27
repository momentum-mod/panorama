import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { traverseChildren } from 'util/functions';
import { parseMapImageUrl } from 'util/functions';
import { scaleWidthToAspectRatio } from 'util/functions';
import { MapUserCompletions } from 'common/maps';
import { Style } from 'common/web/enums/style.enum';
// PRE REWORK REMOVAL
// import { MapStatus, MapStatuses } from 'common/web/enums/map-status.enum';
// import { MapCreditType } from 'common/web/enums/map-credit-type.enum';
// import * as Maps from 'common/maps';
// import * as Leaderboards from 'common/leaderboard';
import { handlePlayMap } from 'common/maps';

const REFRESH_COOLDOWN = 1000 * 10; // 10 seconds

enum NStateButtonState {
	OFF = 0,
	INCLUDE = 1,
	EXCLUDE = 2
}

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
		leftContainer: $<Panel>('#MapSelectorLeftContainer'),
		trackSelectorColumn: $<Panel>('#MapSelectorTrackSelectorColumn'),
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
		listTypes: {
			ranked: $<Button>('#MapListRanked'),
			unranked: $<Button>('#MapListUnranked'),
			beta: $<Button>('#MapListBeta')
		},
		refreshIcon: $<Image>('#RefreshIcon'),

		//This is incredibly ugly. It would be better to define main menu handler as a global object and get it from there
		blurPanel: $.GetContextPanel().GetParent().GetParent().GetParent().GetParent().GetFirstChild() as BaseBlurTarget
	};

	/**
	 * Control Flow:
	 * Map Selector connects the Track Selector to Leaderboards - This is required since those components are reused in Tab Menu
	 * Map Selector sends selected map data to Map Info and Track Selector
	 * Track Selector forwards the data to Leaderboards
	 */
	readonly components = {
		mapInfo: $<MapInfo>('#MapInfo'),
		trackSelector: $<TrackSelector>('#TrackSelector'),
		styleSelector: $<StyleSelector>('#StyleSelector'),
		leaderboards: $<Leaderboards>('#Leaderboards')
	};

	// Describing which data on which type of panel we want to store out to PS.
	readonly filterablePanels = {
		ToggleButton: { event: 'onactivate', properties: ['checked'] },
		NStateButton: { event: 'onactivate', properties: ['currentstate'] },
		DualSlider: { event: 'onvaluechanged', properties: ['lowerValue', 'upperValue'] }
	};

	// PRE REWORK REMOVAL
	// readonly strings = {
	// 	staged: $.Localize('#MapInfo_Type_Staged'),
	// 	linear: $.Localize('#MapInfo_Type_Linear'),
	// 	placeholder: $.Localize('#MapSelector_Info_Placeholder'),
	// 	changelogVersion: $.Localize('#MapSelector_Info_Changelog_Version'),
	// 	statuses: new Map([
	// 		[
	// 			MapStatus.PRIVATE_TESTING,
	// 			{
	// 				status: $.Localize('#MapSelector_Status_PrivateTesting'),
	// 				tooltip: $.Localize('#MapSelector_Status_PrivateTesting_Tooltip')
	// 			}
	// 		],
	// 		[
	// 			MapStatus.CONTENT_APPROVAL,
	// 			{
	// 				status: $.Localize('#MapSelector_Status_ContentApproval'),
	// 				tooltip: $.Localize('#MapSelector_Status_ContentApproval_Tooltip')
	// 			}
	// 		],
	// 		[
	// 			MapStatus.PUBLIC_TESTING,
	// 			{
	// 				status: $.Localize('#MapSelector_Status_PublicTesting'),
	// 				tooltip: $.Localize('#MapSelector_Status_PublicTesting_Tooltip')
	// 			}
	// 		],
	// 		[
	// 			MapStatus.FINAL_APPROVAL,
	// 			{
	// 				status: $.Localize('#MapSelector_Status_FinalApproval'),
	// 				tooltip: $.Localize('#MapSelector_Status_FinalApproval_Tooltip')
	// 			}
	// 		]
	// 	]),
	// };

	readonly nStateButtonClasses: ReadonlyMap<NStateButtonState, string> = new Map([
		[NStateButtonState.OFF, 'mapselector-filters__nstatebutton--off'],
		[NStateButtonState.INCLUDE, 'mapselector-filters__nstatebutton--include'],
		[NStateButtonState.EXCLUDE, 'mapselector-filters__nstatebutton--exclude']
	]);

	readonly tierMin = 1;
	readonly tierMax = 10;

	selectedMapData: MapCacheAPI.MapData | null = null;

	constructor() {
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmCancelDownload', (mapID) =>
			this.showConfirmCancelDownload(mapID)
		);
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmOverwrite', (mapID) => this.showConfirmOverwrite(mapID));
		$.RegisterForUnhandledEvent('MapSelector_MapsFiltered', (count) => this.onMapsFiltered(count));
		$.RegisterForUnhandledEvent('MapSelector_SelectedDataUpdate', (mapData) => this.onSelectedDataUpdated(mapData));
		$.RegisterForUnhandledEvent('MapCache_CompletionsUpdate', (completions) =>
			this.onCompletionsUpdate(completions)
		);

		this.panels.nStateButtons.forEach((panel) =>
			$.RegisterEventHandler('NStateButtonStateChanged', panel, (panelID, state) =>
				this.onNStateBtnChanged(panelID, state as NStateButtonState)
			)
		);

		this.updateAspectScaledWidths();

		// Applying video settings is what changes the aspect ratio in game. The engine may not have
		// switched mode by the time the event fires, so rescale again shortly after -- the call only
		// assigns widths, so running it twice is harmless.
		$.RegisterForUnhandledEvent('ApplyVideoSettings', () => {
			this.updateAspectScaledWidths();
			$.Schedule(0.25, () => this.updateAspectScaledWidths());
		});

		this.components.trackSelector.handler.setBlurPanel(this.panels.blurPanel);
		this.components.trackSelector.handler.connectLeaderboards(this.components.leaderboards);
		this.components.trackSelector.handler.connectStyleSelector(this.components.styleSelector);
		this.components.trackSelector.handler.setPlayButtonVisible(false);
		this.components.styleSelector.handler.setStyleChangedCallback((style) => this.onStyleSelected(style));
		this.panels.blurPanel.AddBlurPanel(this.components.styleSelector);
		// Populate before any map is selected, so the selector isn't empty on first open. Don't push
		// the style to C++ here: this constructor runs from inside the map selector panel's own
		// construction, before its filter panels are bound. Nothing to sync anyway - C++ falls back
		// to the meta mode's default style, which is exactly what setGamemode just selected.
		this.components.styleSelector.handler.setGamemode(GameModeAPI.GetMetaGameMode());
		this.components.mapInfo.handler.setBlurPanel(this.panels.blurPanel);
		this.components.mapInfo.handler.setMapSelector(this.panels.cp);
	}

	/**
	 * Widths of the two columns sized in px rather than percentages -- percentages land the track
	 * panels' 1px right border on a fractional pixel, which drops it at some resolutions. Being fixed
	 * px, they have to be rescaled by hand for the current aspect ratio: taller ratios get a narrower
	 * layout, so a 16:9 width would otherwise crowd out the leaderboard at 16:10 and 4:3.
	 */
	private updateAspectScaledWidths() {
		this.panels.leftContainer.style.width = `${scaleWidthToAspectRatio(820)}px`;
		this.panels.trackSelectorColumn.style.width = `${scaleWidthToAspectRatio(429)}px`;
	}

	onPanelLoad() {
		// Load any saved filter state from persistent storage
		this.loadFilters();

		// Initialise all the filters events
		this.setupFilterSaveEvents(this.panels.filtersPanel);

		this.panels.searchText.SetPanelEvent('ontextentrychange', () =>
			this.panels.searchClear.SetHasClass('search__clearbutton--hidden', this.panels.searchText.text === '')
		);

		this.panels.cp.applyFilters(false);

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
		this.panels.cp.applyFilters(false);

		// Clear persistent storage state. Nothing wrong with just resetting to a blank object. This will mean that in
		// some cases a panel's state is saved to PS but with default state (e.g. when user changes from default and
		// back), whilst in this case it's not stored in PS at all - either is fine.
		this.saveFiltersToPS({});
	}

	/** Set up panel events to update filter panel properties in persistent storage whenever they change. */
	setupFilterSaveEvents(panel: GenericPanel) {
		// Find every panel of paneltype that we want to store
		traverseChildren(panel)
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
	 * only if mom_map_download_cancel_confirmation is true
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

		if (GameInterfaceAPI.GetSettingBool('mom_map_download_cancel_confirmation')) {
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

	/** Set all the map data for the map just selected */
	onSelectedDataUpdated(mapData: MapCacheAPI.MapData) {
		if (!mapData) {
			this.selectedMapData = null;
			return;
		}

		this.selectedMapData = mapData;

		const baseImageUrl = parseMapImageUrl(mapData.staticData);
		this.panels.cp.applyBackgroundMapImage(mapData.staticData.thumbnail.id, baseImageUrl);

		this.components.mapInfo.handler.updateMapInfo(mapData);
		this.components.trackSelector.handler.updateMapData(mapData.staticData);

		// Styles are per-gamemode, so the selector rebuilds (and resets to the mode's default style)
		// whenever the meta mode changes. Otherwise it keeps whatever the user last picked.
		const gamemode = GameModeAPI.GetMetaGameMode();
		this.components.styleSelector.handler.setGamemode(gamemode);
		this.syncSelectedStyle();

		// Render the cached completions immediately, then refresh rank/total from online if stale.
		// Updates (a late fetch, GetMap populating PB times, or a new PB) arrive via
		// MapCache_CompletionsUpdate.
		const style = this.components.styleSelector.handler.style;
		this.components.leaderboards.handler.setStyle(style);
		this.components.trackSelector.handler.updateTrackData(
			MapCacheAPI.GetCompletions(mapData.staticData.id, gamemode, style)
		);
		MapCacheAPI.RefreshCompletions(mapData.staticData.id, gamemode, style);

		// PRE REWORK REMOVAL
		// Start loading spinner on live-updateing stats panels -- MapSelector_OnSelectedOnlineDataUpdate will kill it
		// this.panels.stats.AddClass('mapselector-stats--loading');
	}

	/** Re-render the completion table when the selected map's completions change (fetch or new PB). */
	onCompletionsUpdate(completions: MapUserCompletions) {
		if (!this.selectedMapData || completions.mapID !== this.selectedMapData.staticData.id) return;

		// Only apply updates for the mode + style we're currently showing.
		if (
			completions.gamemode !== GameModeAPI.GetMetaGameMode() ||
			completions.style !== this.components.styleSelector.handler.style
		) {
			return;
		}

		this.components.trackSelector.handler.updateTrackData(completions);
	}

	/** Switch the leaderboard, and the tracks' times/ranks, over to a newly picked style. */
	onStyleSelected(style: Style) {
		this.components.leaderboards.handler.setStyle(style);

		// Before the early-out below: the completed filter applies to the whole map list, so it has
		// to follow the style whether or not a map happens to be selected.
		this.syncSelectedStyle();

		if (!this.selectedMapData) return;

		const mapID = this.selectedMapData.staticData.id;
		const gamemode = GameModeAPI.GetMetaGameMode();

		this.components.trackSelector.handler.updateTrackData(MapCacheAPI.GetCompletions(mapID, gamemode, style));
		MapCacheAPI.RefreshCompletions(mapID, gamemode, style);
	}

	/**
	 * Push the style on show down to C++, which owns the completed filter and picks the style it
	 * dispatches completion updates for. Needed after any style change, including the silent reset
	 * {@link StyleSelectorHandler.setGamemode} does - it deliberately doesn't fire the change callback.
	 */
	private syncSelectedStyle() {
		this.panels.cp.setSelectedStyle(this.components.styleSelector.handler.style);
	}

	onActionButtonPressed() {
		if (!this.selectedMapData) return;

		handlePlayMap(this.selectedMapData);
	}

	/**
	 * Figure out the base CDN URL from the map images.
	 *
	 * Data returned from the backend is a bit unwieldy (would be better to just return the CDN url and array of the
	 * image IDs), don't want to spend the time refactoring.
	 */

	openInSteamOverlay() {
		const mapData = $.GetContextPanel<MomentumMapSelector>().selectedMapData;
		const frontendUrl = GameInterfaceAPI.GetSettingString('mom_api_url_frontend');
		if (mapData && frontendUrl) {
			SteamOverlayAPI.OpenURL(`${frontendUrl}/maps/${mapData.staticData.name}`);
		}
	}

	/** When a NState button is pressed, update its styling classes */
	onNStateBtnChanged(panelID: string, state: NStateButtonState) {
		const panel = this.panels.cp.FindChildTraverse(panelID);
		this.nStateButtonClasses.entries().forEach(([i, className]) => panel.SetHasClass(className, state === i));
	}

	checkingUpdates = false;
	lastUpdateCheck = 0;

	checkForUpdates() {
		if (this.checkingUpdates || this.lastUpdateCheck + REFRESH_COOLDOWN > Date.now()) {
			return;
		}

		this.lastUpdateCheck = Date.now();

		this.panels.refreshIcon.AddClass('spin-clockwise');

		// Has to handle both private and static map updates, where we only need private if we're in the beta, and we
		// could need 0, 1 or 2 static updates, depending on the response from the version check. So logic gets quite
		// complicated, all for one loading spinner. I want RxJS!
		let updatesNeeded = 0;
		let fetchedStaticVersions = false;
		let errored = false;
		if (this.panels.listTypes.beta.IsSelected()) {
			updatesNeeded++;

			const privHandle = $.RegisterForUnhandledEvent('MapCache_PrivateMapsUpdate', (success: boolean) => {
				$.UnregisterForUnhandledEvent('MapCache_PrivateMapsUpdate', privHandle);

				if (!success) {
					errored = true;
				}

				updatesNeeded--;

				if (updatesNeeded === 0 && fetchedStaticVersions) {
					this.onFinishUpdate(errored, '#MapSelector_Updates_Updated', ToastAPI.ToastStyle.SUCCESS);
				}
			});

			MapCacheAPI.FetchPrivateMaps();
		}

		const versionsHandle = $.RegisterForUnhandledEvent(
			'MapCache_StaticCacheVersionChecked',
			(staticUpdatesNeeded) => {
				$.UnregisterForUnhandledEvent('MapCache_StaticCacheVersionChecked', versionsHandle);

				fetchedStaticVersions = true;

				if (staticUpdatesNeeded === 0) {
					if (updatesNeeded === 0) {
						this.onFinishUpdate(errored, '#MapSelector_Updates_UpToDate', ToastAPI.ToastStyle.INFO);
					}
					return;
				}

				updatesNeeded += staticUpdatesNeeded;
				let staticUpdates = 0;
				const staticHandle = $.RegisterForUnhandledEvent('MapCache_StaticCacheUpdate', (_type, success) => {
					if (!success) {
						errored = true;
					}

					staticUpdates++;
					if (staticUpdates === staticUpdatesNeeded) {
						$.UnregisterForUnhandledEvent('MapCache_StaticCacheUpdate', staticHandle);
					}

					--updatesNeeded;
					if (updatesNeeded === 0) {
						this.onFinishUpdate(errored, '#MapSelector_Updates_Updated', ToastAPI.ToastStyle.SUCCESS);
					}
				});
			}
		);

		this.checkingUpdates = true;
		MapCacheAPI.CheckForUpdates();
	}

	onFinishUpdate(errored: boolean, toastMessage: string, toastStyle: ToastAPI.ToastStyle) {
		// If we errored at any point, C++ will show a toast. Even if some requests were successful, don't show
		// both success and error toasts, would be confusing.
		if (!errored) {
			ToastAPI.CreateToast('', '', toastMessage, ToastAPI.ToastLocation.RIGHT, 10, '', toastStyle);
		}

		this.panels.refreshIcon.RemoveClass('spin-clockwise');
		this.checkingUpdates = false;
	}
}
