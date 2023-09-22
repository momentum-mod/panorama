class MapEntry {
	static {
		$.RegisterEventHandler('MapEntry_MapDataUpdate', $.GetContextPanel(), this.onMapDataUpdate.bind(this));
	}

	static showGameModeOverrideMenu() {
		const mapData = $.GetContextPanel().mapData;
		if (!mapData) {
			return;
		}

		const mapID = mapData.id;
		const items = [];

		for (let i = 1; i < GameModeAPI.GetGameModeCount(); i++) {
			items.push({
				label: $.Localize(GameModeAPI.GetGameModeName(i)),
				jsCallback: () => {
					$.DispatchEvent('MapSelector_TryPlayMap_GameModeOverride', mapID, i);
				}
			});
		}

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	static showContextMenu() {
		const mapData = $.GetContextPanel().mapData;
		if (!mapData) return;

		const items = [];
		const isDownloading = $.GetContextPanel().isDownloading;
		const mapID = mapData.id;

		if (mapData.inLibrary) {
			if (mapData.mapFileNeedsUpdate) {
				if (isDownloading) {
					items.push({
						label: $.Localize('#Action_CancelDownload'),
						icon: 'file://{images}/cancel.svg',
						style: 'icon-color-red',

						jsCallback: () => $.DispatchEvent('MapSelector_ShowConfirmCancelDownload', mapID)
					});
				} else if (MapCacheAPI.MapQueuedForDownload(mapID)) {
					items.push({
						label: $.Localize('#Action_RemoveFromQueue'),
						icon: 'file://{images}/playlist-remove.svg',
						style: 'icon-color-red',
						jsCallback: () => $.DispatchEvent('MapSelector_RemoveMapFromDownloadQueue', mapID)
					});
				} else {
					items.push({
						label: $.Localize('#Action_DownloadMap'),
						icon: 'file://{images}/play.svg',
						style: 'icon-color-mid-blue',
						jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap', mapID)
					});
				}
			} else {
				items.push(
					{
						label: $.Localize('#Action_StartMap'),
						icon: 'file://{images}/play.svg',
						style: 'icon-color-green',

						jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap', mapID)
					},

					// Gamemode override submenu
					{
						label: $.Localize('#Action_StartMapOverride'),
						icon: 'file://{images}/alternative-mode.svg',
						style: 'icon-color-green',
						jsCallback: () => this.showGameModeOverrideMenu()
					}
				);
			}

			items.push({
				label: $.Localize('#Action_DeleteMap'),
				icon: 'file://{images}/delete.svg',
				style: 'icon-color-red',
				jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, true, false)
			});
		} else {
			items.push({
				label: $.Localize('#Action_DownloadMap'),
				icon: 'file://{images}/download.svg',
				style: 'icon-color-mid-blue',
				jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap', mapID)
			});
		}

		if (mapData.isFavorited) {
			items.push({
				label: $.Localize('#Action_RemoveFromFavorites'),
				icon: 'file://{images}/favorite-remove.svg',
				style: 'icon-color-yellow',

				jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, false, false)
			});
		} else {
			items.push({
				label: $.Localize('#Action_AddToFavorites'),
				icon: 'file://{images}/star.svg',
				style: 'icon-color-yellow',
				jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, false, true)
			});
		}

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	static tryPlayMap() {
		$.DispatchEvent('MapSelector_TryPlayMap', $.GetContextPanel().mapData.id);
	}

	static onMapDataUpdate() {
		const mapData = $.GetContextPanel().mapData;
		const pbPanel = $.GetContextPanel().FindChildTraverse('MapPB');
		const pbIcon = $.GetContextPanel().FindChildTraverse('PBIcon');
		const pbLabel = $.GetContextPanel().FindChildTraverse('PBLabel');

		if (mapData.isCompleted) {
			pbPanel.RemoveClass('hide');

			// Do G1-6 here when it's hooked up
			const icon = mapData.pr.rank <= 10 ? 'file://{images}/ranks/top10.svg' : 'file://{images}/flag.svg';

			pbIcon.SetImage(icon);

			let time = mapData.pr.run.time;
			if (!time.includes(':')) time = Number.parseInt(time) >= 10 ? '0:' + time : '0:0' + time;

			pbLabel.text = time.split('.')[0];

			pbPanel.SetPanelEvent('onmouseover', () => {
				UiToolkitAPI.ShowTextTooltip(
					pbPanel.id,
					`<b>${$.Localize('#Common_PersonalBest')}</b>: ${time}\n<b>${$.Localize('#Common_Rank')}</b>: ${
						mapData.pr.rank
					}`
					// `Last Played: ${new Date(mapData.lastPlayed).toDateString()}` +
				);
			});
		} else {
			pbPanel.AddClass('hide');
			pbPanel.ClearPanelEvent('onmouseover');
			pbLabel.text = '';
		}
	}
}
