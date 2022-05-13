'use strict';

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
		let items = [];

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

		let items = [];
		const isDownloading = $.GetContextPanel().isDownloading;
		const mapID = mapData.id;

		if (mapData.inLibrary) {
			if (mapData.mapFileNeedsUpdate) {
				if (isDownloading) {
					items.push({
						label: $.Localize('MOM_MapSelector_CancelDownload'),
						icon: 'file://{images}/cancel.svg',
						style: 'icon-color-red',

						jsCallback: () => $.DispatchEvent('MapSelector_ShowConfirmCancelDownload', mapID)
					});
				} else if (MapCacheAPI.MapQueuedForDownload(mapID)) {
					items.push({
						label: $.Localize('MOM_MapSelector_RemoveFromQueue'),
						icon: 'file://{images}/playlist-remove.svg',
						style: 'icon-color-red',
						jsCallback: () => $.DispatchEvent('MapSelector_RemoveMapFromDownloadQueue', mapID)
					});
				} else {
					items.push({
						label: $.Localize('MOM_MapSelector_DownloadMap'),
						icon: 'file://{images}/play.svg',
						style: 'icon-color-mid-blue',
						jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap', mapID)
					});
				}
			} else {
				items.push({
					label: $.Localize('MOM_MapSelector_StartMap'),
					icon: 'file://{images}/play.svg',
					style: 'icon-color-green',

					jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap', mapID)
				});

				// Gamemode override submenu
				items.push({
					label: $.Localize('MOM_MapSelector_StartMapOverride'),
					icon: 'file://{images}/alternative-mode.svg',
					style: 'icon-color-green',
					jsCallback: () => this.showGameModeOverrideMenu()
				});
			}

			items.push({
				label: 'Delete Map',
				icon: 'file://{images}/delete.svg',
				style: 'icon-color-red',
				jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, true, false)
			});
		} else {
			items.push({
				label: $.Localize('MOM_MapSelector_DownloadMap'),
				icon: 'file://{images}/download.svg',
				style: 'icon-color-mid-blue',
				jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap', mapID)
			});
		}

		if (mapData.isFavorited) {
			items.push({
				label: $.Localize('MOM_MapSelector_RemoveFromFavorites'),
				icon: 'file://{images}/favorite-remove.svg',
				style: 'icon-color-yellow',

				jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, false, false)
			});
		} else {
			items.push({
				label: $.Localize('MOM_MapSelector_AddToFavorites'),
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

			let icon;
			// Do G1-6 here when it's hooked up
			if (mapData.pr.rank <= 10) {
				icon = 'file://{images}/ranks/top10.svg';
			} else {
				icon = 'file://{images}/flag.svg';
			}

			pbIcon.SetImage(icon);

			let time = mapData.pr.run.time;

			if (!time.includes(':')) {
				parseInt(time) >= 10 ? (time = '0:' + time) : (time = '0:0' + time);
			}

			pbLabel.text = time.split('.')[0];

			pbPanel.SetPanelEvent('onmouseover', () => {
				UiToolkitAPI.ShowTextTooltip(
					pbPanel.id,
					`<b>PB</b>: ${time}\n<b>Rank</b>: ${mapData.pr.rank}`
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
