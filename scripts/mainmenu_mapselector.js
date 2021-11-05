'use strict';

class MapSelection {
	static gameModeData = {
		0: {
			name: 'Unknown',
			prefix: '',
			filterButton: null
		},
		1: {
			name: 'Surf',
			prefix: 'surf_',
			filterButton: $('#SurfFilterButton')
		},
		2: {
			name: 'Bhop',
			prefix: 'Bhop_',
			filterButton: $('#BhopFilterButton')
		},
		3: {
			name: 'Climb',
			prefix: 'climb_',
			filterButton: $('#ClimbFilterButton')
		},
		4: {
			name: 'Rocket Jump',
			prefix: 'rj_',
			filterButton: $('#RJFilterButton')
		},
		5: {
			name: 'Sticky Jump',
			prefix: 'sj_',
			filterButton: $('#SJFilterButton')
		},
		6: {
			name: 'Tricksurf',
			prefix: 'tsurf_',
			filterButton: $('#TricksurfFilterButton')
		},
		7: {
			name: 'Accelerated Hop',
			prefix: 'ahop_',
			filterButton: $('#AhopFilterButton')
		},
		8: {
			name: 'Parkour',
			prefix: 'pk_',
			filterButton: $('#ParkourFilterButton')
		},
		9: {
			name: 'Conc',
			prefix: 'conc_',
			filterButton: $('#ConcFilterButton')
		},
		10: {
			name: 'Defrag',
			prefix: 'df_',
			filterButton: $('#DefragFilterButton')
		}
	};

	static searchTextEntry = $('#MapSearchTextEntry');
	static filtersPanel = $('#MapFilters');
	static completedFilterButton = $('#MapCompletedFilterButton');
	static favoritesFilterButton = $('#MapFavoritedFilterButton');
	static downloadedFilterButton = $('#MapDownloadedFilterButton');
	static tierSlider = $('#TierSlider');

	static filtersToggled = false;
	static timesModeButtonsUnchecked = 0;

	static {
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmCancelDownload', MapSelection.showConfirmCancelDownload);
		$.RegisterForUnhandledEvent('MapSelector_ShowConfirmOverwrite', MapSelection.showConfirmOverwrite);
		$.RegisterForUnhandledEvent('MapSelector_MapsFiltered', MapSelection.mapsFiltered);

		$.DispatchEvent('LoadMapSelector');

		Object.keys(MapSelection.gameModeData).forEach((mode) => {
			const filterButton = MapSelection.gameModeData[mode].filterButton;
			if (filterButton === null) return;

			filterButton.SetPanelEvent('oncontextmenu', () => MapSelection.clearOtherModes(mode));
			filterButton.SetPanelEvent('onactivate', () => MapSelection.onModeButtonPressed(mode));
		});
	}

	static areAllOtherModesUnchecked(selectedMode) {
		const modes = this.gameModeData;
		for (let i = 0; i < Object.keys(modes).length; i++) {
			const curMode = modes[i];
			if (curMode.filterButton !== null) {
				if (curMode.filterButton.checked && curMode !== modes[selectedMode]) return false;
			}
		}
		return true;
	}
	
	static clearOtherModes(selectedMode) {
		// Hardcode unchecked counter to -1, if you're using this you've got the hang of it, no more popups for you!
		this.timesModeButtonsUnchecked = -1;

		const modes = MapSelection.gameModeData;

		const selectedModeButton = modes[selectedMode].filterButton;

		// No matter what, we want our selected button to be checked
		if (!selectedModeButton.checked) {
			selectedModeButton.SetSelected(true);
		}

		const areOthersUnchecked = this.areAllOtherModesUnchecked(selectedMode);

		Object.keys(modes)
			.slice(1)
			.filter((mode) => mode !== selectedMode)
			.forEach((mode) => {
				const filterButton = modes[mode].filterButton;
				if (areOthersUnchecked) {
					// Others ARE all unchecked, so let's toggle them all back on
					filterButton.SetSelected(true);
				} else {
					// Others are NOT all unchecked, so we want to uncheck them if not already
					if (filterButton.checked) {
						filterButton.SetSelected(false);
					}
				}
			});

		$.GetContextPanel().ApplyFilters();
	}

	static onModeButtonPressed(mode) {
		if (this.timesModeButtonsUnchecked === -1)
			// They already right clicked. TODO: Use a convar here as well!!
			return;

		const button = MapSelection.gameModeData[mode].filterButton;
		// If button was unchecked then increment the counter
		if (!button.checked) {
			this.timesModeButtonsUnchecked++;

			// Show tooltip if times unchecked equal to all the modes minus the last remaining mode and the null mode
			if (this.timesModeButtonsUnchecked == Object.keys(MapSelection.gameModeData).length - 2) {
				UiToolkitAPI.ShowTitleImageTextTooltipStyled(
					button.id,
					'',
					'file://{images}/info.svg',
					'Tip: Use right-click to deselect all other modes!',
					'tooltip--notitle'
				);
				$.Schedule(3.0, () => UiToolkitAPI.HideTitleImageTextTooltip());
				this.timesModeButtonsUnchecked = 0; // Reset the counter
			}
			// If a mode was just checked, reset the counter (bound to >= 0, counter can be negative when unchecked through code done asyncronously)
			// } else if (this.timesModeButtonsUnchecked > 0) {
			// 	this.timesModeButtonsUnchecked = 0;
		} else this.timesModeButtonsUnchecked--;
	}

	static clearSearch() {
		this.searchTextEntry.text = '';
	}

	static toggleFilters() {
		this.filtersToggled = !this.filtersToggled;
		this.filtersToggled ? this.filtersPanel.AddClass('filters--filters-extended') : this.filtersPanel.RemoveClass('filters--filters-extended');
	}

	static clearFilters() {
		this.clearSearch();

		Object.keys(MapSelection.gameModeData).forEach((mode) => {
			let button = MapSelection.gameModeData[mode].filterButton;
			if (button && !button.checked) {
				button.SetSelected(true);
			}
		});

		[this.completedFilterButton, this.favoritesFilterButton, this.downloadedFilterButton].forEach((button) => {
			if (button.checked) {
				button.SetSelected(false);
			}
		});

		this.tierSlider.SetValues(0, 10);

		$.GetContextPanel().ApplyFilters();
	}

	static showConfirmOverwrite(mapID) {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#MOM_MapSelector_ConfirmOverwrite'),
			$.Localize('#MOM_MapSelector_ConfirmOverwriteMsg'),
			'ok-cancel-popup',
			() => $.DispatchEvent('MapSelector_ConfirmOverwrite', mapID),
			() => {}
		);
	}

	static showConfirmCancelDownload(mapID) {
		const cancel = () => $.DispatchEvent('MapSelector_ConfirmCancelDownload', mapID);

		if (GameInterfaceAPI.GetSettingBool('mom_map_download_cancel_confirm')) {
			UiToolkitAPI.ShowGenericPopupOkCancel(
				$.Localize('#MOM_MapSelector_ConfirmCancel'),
				$.Localize('#MOM_MapSelector_ConfirmCancelMsg'),
				'ok-cancel-popup',
				cancel,
				() => {}
			);
		} else {
			cancel();
		}
	}

	static mapsFiltered(count) {
		const emptyContainer = $.GetContextPanel().FindChildTraverse('MapListEmptyContainer');
		count > 0 ? emptyContainer.AddClass('mapselector__emptywarning--hidden') : emptyContainer.RemoveClass('mapselector__emptywarning--hidden');
	}
}
