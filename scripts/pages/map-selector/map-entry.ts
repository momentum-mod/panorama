import { PanelHandler } from 'util/module-helpers';
import * as Enum from 'util/enum';
import { Gamemode, TrackType } from 'common/web';
import { GamemodeInfo } from 'common/gamemode';
import { getUserMapDataTrack } from '../../common/leaderboard';
import { timetoHHMMSS } from '../../util/time';

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
			jsCallback: () => $.DispatchEvent('MapSelector_TryPlayMap_GameModeOverride', mapData.static.id, gamemode)
		}));

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	showContextMenu() {
		const { mapData, isDownloading } = $.GetContextPanel<MapEntry>();
		if (!mapData) {
			return;
		}

		const items = [];
		const mapID = mapData.static.id;

		if (mapData.mapFileExists) {
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
				},
				{
					label: $.Localize('#Action_DeleteMap'),
					icon: 'file://{images}/delete.svg',
					style: 'icon-color-red',
					jsCallback: () => $.DispatchEvent('MapSelector_DeleteMap', mapID)
				}
			);
		} else {
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
		}
		if (mapData.user?.inFavorites) {
			items.push({
				label: $.Localize('#Action_RemoveFromFavorites'),
				icon: 'file://{images}/favorite-remove.svg',
				style: 'icon-color-yellow',
				jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, false)
			});
		} else {
			items.push({
				label: $.Localize('#Action_AddToFavorites'),
				icon: 'file://{images}/star.svg',
				style: 'icon-color-yellow',
				jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapStatus', mapID, true)
			});
		}

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	tryPlayMap() {
		$.DispatchEvent('MapSelector_TryPlayMap', $.GetContextPanel<MapEntry>().mapData.static.id);
	}

	onMapDataUpdate() {
		const cp = $.GetContextPanel<MapEntry>();
		const mapData = cp.mapData;
		const pbPanel = cp.FindChildTraverse('MapPB');
		const pbIcon = cp.FindChildTraverse<Image>('PBIcon');
		const pbLabel = cp.FindChildTraverse<Label>('PBLabel');
		const gamemode = GameModeAPI.GetMetaGameMode();
		const track = getUserMapDataTrack(mapData.user, gamemode);
		if (track && track.time > 0) {
			pbPanel.RemoveClass('hide');

			// Current system doesn't know user ranks
			const icon = /* track.pr.rank <= 10 ? 'file://{images}/ranks/top10.svg' : */ 'file://{images}/flag.svg';

			pbIcon.SetImage(icon);

			pbLabel.text = timetoHHMMSS(track.time);

			pbPanel.SetPanelEvent('onmouseover', () => {
				UiToolkitAPI.ShowTextTooltip(
					pbPanel.id,
					`<b>${$.Localize('#Common_PersonalBest')}</b>: ${track.time}\n` +
						`<b>${$.Localize('#Common_LastPlayed')}</b>: ${new Date(mapData.user.lastPlayed).toDateString()}`
				);
			});
		} else {
			pbPanel.AddClass('hide');
			pbPanel.ClearPanelEvent('onmouseover');
			pbLabel.text = '';
		}
	}
}
