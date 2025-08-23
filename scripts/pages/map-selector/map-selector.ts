import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { traverseChildren } from 'util/functions';
import {
	MapCreditType,
	MapStatus,
	MapStatuses,
	MMap,
	SteamGame,
	SteamGamesNames,
	TrackType
} from 'common/web_dontmodifyme';
import * as Maps from 'common/maps';
import * as Leaderboards from 'common/leaderboard';
import * as Time from 'util/time';
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
		info: $<Panel>('#MapInfo'),
		linearSeparator: $<Label>('#HudTabMenuLinearSeparator'),
		linearLabel: $<Label>('#HudTabMenuLinearLabel'),
		stageCountSeparator: $<Label>('#HudTabMenuStageCountSeparator'),
		stageCountLabel: $<Label>('#HudTabMenuStageCountLabel'),
		bonusCountSeparator: $<Label>('#HudTabMenuBonusCountSeparator'),
		bonusCountLabel: $<Label>('#HudTabMenuBonusCountLabel'),
		bonusesCountLabel: $<Label>('#HudTabMenuBonusesCountLabel'),
		leaderboardContainer: $<Panel>('#MapTimes'),
		descriptionContainer: $<Panel>('#MapDescriptionContainer'),
		creditsContainer: $<Panel>('#MapCreditsContainer'),
		datesContainer: $<Panel>('#MapDatesContainer'),
		credits: $<Panel>('#MapCredits'),
		submissionStatus: $<Label>('#MapSubmissionStatus'),
		changelog: $<Panel>('#MapChangelog'),
		stats: $<Panel>('#MapInfoStats'),
		websiteButton: $<Button>('#MapInfoWebsiteButton'),
		tags: $<Label>('#MapTags'),
		listTypes: {
			ranked: $<Button>('#MapListRanked'),
			unranked: $<Button>('#MapListUnranked'),
			beta: $<Button>('#MapListBeta')
		},
		refreshIcon: $<Image>('#RefreshIcon')
	};

	// Describing which data on which type of panel we want to store out to PS.
	readonly filterablePanels = {
		ToggleButton: { event: 'onactivate', properties: ['checked'] },
		NStateButton: { event: 'onactivate', properties: ['currentstate'] },
		DualSlider: { event: 'onvaluechanged', properties: ['lowerValue', 'upperValue'] }
	};

	readonly strings = {
		staged: $.Localize('#MapInfo_Type_Staged'),
		linear: $.Localize('#MapInfo_Type_Linear'),
		placeholder: $.Localize('#MapSelector_Info_Placeholder'),
		changelogVersion: $.Localize('#MapSelector_Info_Changelog_Version'),
		statuses: new Map([
			[
				MapStatus.PRIVATE_TESTING,
				{
					status: $.Localize('#MapSelector_Status_PrivateTesting'),
					tooltip: $.Localize('#MapSelector_Status_PrivateTesting_Tooltip')
				}
			],
			[
				MapStatus.CONTENT_APPROVAL,
				{
					status: $.Localize('#MapSelector_Status_ContentApproval'),
					tooltip: $.Localize('#MapSelector_Status_ContentApproval_Tooltip')
				}
			],
			[
				MapStatus.PUBLIC_TESTING,
				{
					status: $.Localize('#MapSelector_Status_PublicTesting'),
					tooltip: $.Localize('#MapSelector_Status_PublicTesting_Tooltip')
				}
			],
			[
				MapStatus.FINAL_APPROVAL,
				{
					status: $.Localize('#MapSelector_Status_FinalApproval'),
					tooltip: $.Localize('#MapSelector_Status_FinalApproval_Tooltip')
				}
			]
		]),
		credits: new Map([
			[MapCreditType.AUTHOR, '#MapSelector_Info_Authors'],
			[MapCreditType.CONTRIBUTOR, '#MapSelector_Info_Contributors'],
			[MapCreditType.SPECIAL_THANKS, '#MapSelector_Info_SpecialThanks'],
			[MapCreditType.TESTER, '#MapSelector_Info_Testers']
		])
	};

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
		$.RegisterForUnhandledEvent('MapSelector_SelectedOnlineDataUpdate', (mapData) =>
			this.onSelectedOnlineDataUpdated(mapData)
		);
		$.RegisterForUnhandledEvent('MapSelector_HideLeaderboards', () => this.toggleLeaderboards(false));

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

		this.panels.cp.applyFilters(false);
		this.panels.leaderboardContainer.SetHasClass(
			'mapselector-leaderboards--open',
			$.persistentStorage.getItem('mapSelector.leaderboardsOpen') ?? false
		);

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

		const baseImageUrl = this.parseMapImageUrl(mapData.staticData);
		this.panels.cp.applyBackgroundMapImage(mapData.staticData.thumbnail.id, baseImageUrl);

		this.updateSelectedMapInfo(mapData.staticData, mapData.userData);
		this.updateSelectedMapCredits(mapData.staticData);
		this.updateSelectedMapRequiredGames(mapData.staticData);

		// Start loading spinner on live-updateing stats panels -- MapSelector_OnSelectedOnlineDataUpdate will kill it
		this.panels.stats.AddClass('mapselector-stats--loading');
	}

	updateSelectedMapInfo(staticData: MMap, userData?: MapCacheAPI.UserData) {
		const gamemode = GameModeAPI.GetMetaGameMode();
		const mainTrackTier = Maps.getTier(staticData, gamemode);
		const numStages = Leaderboards.getNumStages(staticData);
		const numBonuses = Leaderboards.getNumBonuses(staticData);
		const isLinear = numStages <= 1;
		const info = this.panels.info;

		info.SetDialogVariable('name', staticData.name);

		info.SetDialogVariableInt('tier', mainTrackTier ?? 0);
		this.panels.linearSeparator.visible = isLinear;
		this.panels.linearLabel.visible = isLinear;
		this.panels.stageCountSeparator.visible = !isLinear;
		this.panels.stageCountLabel.visible = !isLinear;
		if (!isLinear) {
			info.SetDialogVariableInt('stageCount', numStages);
		}
		this.panels.bonusCountSeparator.visible = numBonuses > 0;
		this.panels.bonusCountLabel.visible = numBonuses === 1;
		this.panels.bonusesCountLabel.visible = numBonuses > 1;
		if (numBonuses > 0) {
			info.SetDialogVariableInt('bonusCount', numBonuses);
		}

		info.SetDialogVariable('description', staticData.info?.description);
		this.panels.descriptionContainer.SetHasClass('hide', !staticData.info?.description);

		info.SetDialogVariable('date', new Date(staticData.info?.creationDate)?.toLocaleDateString());
		this.panels.datesContainer.SetHasClass('hide', !staticData.info?.creationDate);

		const pb = Leaderboards.getUserMapDataTrack(userData, gamemode);
		info.SetDialogVariable('personal_best', pb ? Time.timetoHHMMSS(pb.time) : $.Localize('#Common_NA'));

		const inSubmission = MapStatuses.IN_SUBMISSION.includes(staticData.status);
		info.SetHasClass('mapselector-map-info--submission', inSubmission);

		if (inSubmission) {
			const { status, tooltip } = this.strings.statuses.get(staticData.status);
			this.panels.info.SetDialogVariable('status', status);
			this.panels.info.SetDialogVariable('status_tooltip', tooltip);

			this.panels.submissionStatus.visible = true;

			const hasChangelog = staticData.versions.length > 1;
			this.panels.changelog.visible = hasChangelog;
			if (hasChangelog) {
				const container = this.panels.changelog.GetChild(1);
				container.RemoveAndDeleteChildren();

				staticData.versions
					// Data doesn't seem always ordered by versionNum (?) so doing a sort
					.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
					.forEach(({ changelog }, i, arr) => {
						$.CreatePanel('Label', container, '', {
							class: 'mapselector-map-info__h3',
							text: $.Localize('#MapSelector_Info_Changelog_Version').replace(
								'%version%',
								(arr.length - i).toString()
							)
						});
						// First version doesn't necessarily have a changelog
						if (changelog) {
							$.CreatePanel('Label', container, '', {
								text: changelog,
								class: 'mapselector-map-info__changelog-text'
							});
						}
					});
			}
		} else {
			this.panels.submissionStatus.visible = false;
			this.panels.changelog.visible = false;
			this.panels.info.SetDialogVariable('status', '');
			this.panels.info.SetDialogVariable('status_tooltip', '');
		}
	}

	updateSelectedMapCredits(staticData: MMap) {
		this.panels.credits.RemoveAndDeleteChildren();

		// Panorama's buggy right-wrap behaviour makes doing layout for this with CSS very hard - just built out in JS.
		this.strings.credits
			.entries()
			// Map to collections of both regular and placeholder suggestions, filter out empty credit types
			.map(([type, heading]) => [heading, Maps.getAllCredits(staticData, type)] as const)
			.filter(([_heading, credits]) => credits.length > 0)
			.forEach(([heading, credits], i) => {
				const row =
					i % 2 === 0
						? $.CreatePanel('Panel', this.panels.credits, '', { class: 'mapselector-credits__row' })
						: this.panels.credits.Children().at(-1);

				const col = $.CreatePanel('Panel', row, '', { class: 'mapselector-credits__col' });
				$.CreatePanel('Label', col, '', { text: $.Localize(heading), class: 'mapselector-map-info__h2' });

				credits.forEach(({ alias, steamID }, i) => {
					const panel = $.CreatePanel('Panel', col, '', { class: 'mapselector-credits__credit' });

					if (steamID) {
						$.CreatePanel('AvatarImage', panel, '', {
							class: 'mapselector-credits__avatar',
							steamid: steamID
						});
					} else {
						const placeholder = $.CreatePanel('Image', panel, `Placholder${i}`, {
							class: 'mapselector-credits__placeholder',
							src: 'file://{images}/help.svg',
							textureheight: '32px'
						});
						placeholder.SetPanelEvent('onmouseover', () =>
							UiToolkitAPI.ShowTextTooltip(placeholder.id, this.strings.placeholder)
						);
						placeholder.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
					}

					const namePanel = $.CreatePanel('Label', panel, '', {
						text: alias,
						class: 'mapselector-credits__text mapselector-credits__name'
					});

					if (steamID) {
						namePanel.AddClass('mapselector-credits__name--steam');

						// This will become a player profile panel in the future
						panel.SetPanelEvent('onactivate', () => {
							UiToolkitAPI.ShowSimpleContextMenu(namePanel.id, '', [
								{
									label: $.Localize('#Action_ShowSteamProfile'),
									jsCallback: () => SteamOverlayAPI.OpenToProfileID(steamID)
								}
							]);
						});
					}
				});
			});
	}

	readonly requiredGames = [
		[$('#CSS'), SteamGame.CSS] as const,
		[$('#CSGO'), SteamGame.CSGO] as const,
		[$('#TF2'), SteamGame.TF2] as const,
		[$('#Portal2'), SteamGame.PORTAL2] as const
	];

	updateSelectedMapRequiredGames(staticData: MMap) {
		if (!staticData.info?.requiredGames) {
			this.requiredGames.forEach(([panel]) => {
				panel.AddClass('mapselector-map-info__required-game--hidden');
			});

			return;
		}

		const mountedGames = GameInterfaceAPI.GetMountedSteamApps();
		this.requiredGames.forEach(([panel, game]) => {
			const unmounted = !mountedGames.includes(game);
			panel.SetHasClass(
				'mapselector-map-info__required-game--hidden',
				!staticData.info.requiredGames.includes(game)
			);
			panel.SetHasClass('mapselector-map-info__required-game--unmounted', unmounted);

			if (unmounted) {
				panel.SetDialogVariable('game', SteamGamesNames.get(game));
				panel.SetPanelEvent('onmouseover', () => {
					// English is "Missing assets for game: "
					UiToolkitAPI.ShowTextTooltip(
						panel.id,
						'<span class="mapselector-map-info__required-game__tooltip--left">' +
							$.Localize('#MapSelector_RequiredGames_Tooltip') +
							'</span><span class="mapselector-map-info__required-game__tooltip--right">' +
							SteamGamesNames.get(game) +
							'</span>'
					);
				});
			} else {
				panel.ClearPanelEvent('onmouseover');
			}
		});
	}

	onSelectedOnlineDataUpdated(onlineMapData: MMap) {
		const statsPanel = this.panels.stats;

		statsPanel.RemoveClass('mapselector-stats--loading');

		// Removing / omitting several stats here, so we only include the stats that ACTUALLY WORK
		// - Subscriptions - No longer exists since removing map library.
		// - Downloads - No longer tracked by the backend.
		// - Plays - We *may* track this in the future but don't currently.
		// - Time Played - We don't track this *yet*.
		// Map stats is in a very WIP state at the moment and doesn't need to be perfect yet.
		statsPanel.SetDialogVariableInt('unique_completions', onlineMapData.stats.uniqueCompletions);
		statsPanel.SetDialogVariableInt('total_completions', onlineMapData.stats.completions);
		statsPanel.SetDialogVariableInt('favorites', onlineMapData.stats.favorites);

		const gamemode = GameModeAPI.GetMetaGameMode();
		const wr = onlineMapData.worldRecords?.find(
			(run) => run.gamemode === gamemode && run.trackType === TrackType.MAIN && run.style === 0
		);
		statsPanel.SetDialogVariable('world_record', wr ? Time.timetoHHMMSS(wr.time) : $.Localize('#Common_NA'));
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
	parseMapImageUrl(staticData: MMap): string | null {
		// Pick any image, check URL makes sense
		const image = staticData.images?.[0]?.small;
		if (!image || !/http.+\/[\da-z-]{36}-small.jpg/.test(image)) {
			$.Warning(`Map Selector: Invalid image URL "${image}", not opening gallery`);
			return null;
		}

		return image.split('/').slice(0, -1).join('/');
	}

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

	toggleLeaderboards(open: boolean) {
		this.panels.leaderboardContainer.SetHasClass('mapselector-leaderboards--open', open);
		$.persistentStorage.setItem('mapSelector.leaderboardsOpen', open);
	}

	openGallery() {
		if (!this.selectedMapData) return;

		const gallery = UiToolkitAPI.ShowCustomLayoutPopup<Gallery>(
			'MapSelectorGallery',
			'file://{resources}/layout/components/gallery.xml'
		);

		gallery.handler.init(
			this.panels.cp,
			this.selectedMapData.staticData.images?.map(({ id }) => id) ?? [],
			this.parseMapImageUrl(this.selectedMapData.staticData) ?? ''
		);
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
