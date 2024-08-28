import { PanelHandler } from 'util/module-helpers';
import * as Enum from 'util/enum';
import { Gamemode } from 'common/web';
import { GamemodeInfo } from 'common/gamemode';

@PanelHandler()
class MapEntryHandler {
	constructor() {
		$.RegisterEventHandler('MapEntry_MapDataUpdate', $.GetContextPanel(), () => this.onMapDataUpdate());
	}

	showGameModeOverrideMenu() {
		const mapData = $.GetContextPanel<MapEntry>().mapData;
		if (!mapData) {
			return;
		}

		const items = Enum.fastValuesNumeric(Gamemode).map((gamemode) => ({
			label: $.Localize(GamemodeInfo.get(gamemode)!.i18n),
			jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap_GameModeOverride', mapData.id, gamemode)
		}));

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	showContextMenu() {
		// const { mapData, userMapData, isDownloading } = $.GetContextPanel<MapEntry>();
		// if (!mapData || !userMapData) {
		// 	return;
		// }
		//
		// const items = [];
		// const mapID = mapData.id;
		//
		// if (userMapData.mapFileExists) {
		// 	items.push(
		// 		{
		// 			label: $.Localize('#Action_StartMap'),
		// 			icon: 'file://{images}/play.svg',
		// 			style: 'icon-color-green',
		// 			jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap', mapID)
		// 		},
		// 		// Gamemode override submenu
		// 		{
		// 			label: $.Localize('#Action_StartMapOverride'),
		// 			icon: 'file://{images}/alternative-mode.svg',
		// 			style: 'icon-color-green',
		// 			jsCallback: () => this.showGameModeOverrideMenu()
		// 		},
		// 		{
		// 			label: $.Localize('#Action_DeleteMap'),
		// 			icon: 'file://{images}/delete.svg',
		// 			style: 'icon-color-red',
		// 			jsCallback: () => $.DispatchEvent('MapSelector_DeleteMap', mapID)
		// 		}
		// 	);
		// } else {
		// 	if (isDownloading) {
		// 		items.push({
		// 			label: $.Localize('#Action_CancelDownload'),
		// 			icon: 'file://{images}/cancel.svg',
		// 			style: 'icon-color-red',
		// 			jsCallback: () => $.DispatchEvent('MapSelector_ShowConfirmCancelDownload', mapID)
		// 		});
		// 	} else if (MapCacheAPI.MapQueuedForDownload(mapID)) {
		// 		items.push({
		// 			label: $.Localize('#Action_RemoveFromQueue'),
		// 			icon: 'file://{images}/playlist-remove.svg',
		// 			style: 'icon-color-red',
		// 			jsCallback: () => $.DispatchEvent('MapSelector_RemoveMapFromDownloadQueue', mapID)
		// 		});
		// 	} else {
		// 		items.push({
		// 			label: $.Localize('#Action_DownloadMap'),
		// 			icon: 'file://{images}/play.svg',
		// 			style: 'icon-color-mid-blue',
		// 			jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap', mapID)
		// 		});
		// 	}
		// }
		// TODO: Isn't fetched by C++ yet, complicated to do with new map list system.
		// if (userMapData.isFavorited) {
		// 	items.push({
		// 		label: $.Localize('#Action_RemoveFromFavorites'),
		// 		icon: 'file://{images}/favorite-remove.svg',
		// 		style: 'icon-color-yellow',
		// 		jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, false)
		// 	});
		// } else {
		// 	items.push({
		// 		label: $.Localize('#Action_AddToFavorites'),
		// 		icon: 'file://{images}/star.svg',
		// 		style: 'icon-color-yellow',
		// 		jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, true)
		// 	});
		// }
		//
		// UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	tryPlayMap() {
		$.DispatchEvent('MapSelector_TryPlayMap', $.GetContextPanel<MapEntry>().mapData.id);
	}

	onMapDataUpdate() {
		const cp = $.GetContextPanel<MapEntry>();
		const mapData = cp.mapData;
		const pbPanel = cp.FindChildTraverse('MapPB');
		const pbIcon = cp.FindChildTraverse<Image>('PBIcon');
		const pbLabel = cp.FindChildTraverse<Label>('PBLabel');

		// TODO: Not passing user-specific data in yet. This is hard to do. Fucking hell!
		// if (mapData.isCompleted) {
		// 	pbPanel.RemoveClass('hide');
		//
		// 	// Do G1-6 here when it's hooked up
		// 	const icon = mapData.pr.rank <= 10 ? 'file://{images}/ranks/top10.svg' : 'file://{images}/flag.svg';
		//
		// 	pbIcon.SetImage(icon);
		//
		// 	let time = mapData.pr.run.time;
		// 	if (!time.includes(':')) time = Number.parseInt(time) >= 10 ? '0:' + time : '0:0' + time;
		//
		// 	pbLabel.text = time.split('.')[0];
		//
		// 	pbPanel.SetPanelEvent('onmouseover', () => {
		// 		UiToolkitAPI.ShowTextTooltip(
		// 			pbPanel.id,
		// 			`<b>${$.Localize('#Common_PersonalBest')}</b>: ${time}\n<b>${$.Localize('#Common_Rank')}</b>: ${
		// 				mapData.pr.rank
		// 			}`
		// 			// `Last Played: ${new Date(mapData.lastPlayed).toDateString()}` +
		// 		);
		// 	});
		// } else {
		// 	pbPanel.AddClass('hide');
		// 	pbPanel.ClearPanelEvent('onmouseover');
		// 	pbLabel.text = '';
		// }
	}
}
