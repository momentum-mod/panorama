import { PanelHandler } from 'util/module-helpers';
import * as Enum from 'util/enum';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { MapStatus, MapStatuses } from 'common/web/enums/map-status.enum';
import { GamemodeInfo } from 'common/gamemode';
import { getUserMapDataTrack } from 'common/leaderboard';
import { getTier, handlePlayMap } from 'common/maps';
import { Role } from 'common/web/enums/role.enum';

const NEW_MAP_BANNER_CUTOFF = 1000 * 60 * 60 * 24 * 5; // 5 days

@PanelHandler()
class MapEntryHandler {
	constructor() {
		$.RegisterEventHandler('MapEntry_MapDataUpdate', $.GetContextPanel(), () => this.update());
		$.RegisterEventHandler('MapEntry_MapLobbiesUpdated', $.GetContextPanel(), (playerCount: number) =>
			this.updatePlayerCount(playerCount)
		);

		this.panels.lobbyContainer.visible = false;
	}

	panels = {
		cp: $.GetContextPanel<MapEntry>(),
		pbPanel: $<Panel>('#MapEntryPB')!,
		pbLabel: $<Label>('#MapEntryPBLabel')!,
		pbIcon: $<Image>('#MapEntryPBIcon')!,
		tier: $<Label>('#MapEntryTier')!,
		lobbyContainer: $<Panel>('#MapEntryLobbyContainer')!
	};

	strings = {
		bannerNew: $.Localize('#MapSelector_Banner_New'),
		bannerPrivate: $.Localize('#MapSelector_Banner_Private')
	};

	onActionButtonPressed() {
		handlePlayMap($.GetContextPanel<MapEntry>().mapData);
	}

	showGameModeOverrideMenu() {
		const items = Enum.fastValuesNumeric(Gamemode).map((gamemode) => ({
			label: $.Localize(GamemodeInfo.get(gamemode)!.i18n),
			jsCallback: () => handlePlayMap($.GetContextPanel<MapEntry>().mapData, gamemode)
		}));

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	showContextMenu() {
		const { mapData, isDownloading } = $.GetContextPanel<MapEntry>();

		const items: UiToolkitAPI.SimpleContextMenuItem[] = [];
		const mapID = mapData.staticData.id;

		if (mapData.mapFileExists) {
			items.push(
				{
					label: $.Localize('#Action_StartMap'),
					icon: 'file://{images}/play.svg',
					style: 'icon-color-green',
					jsCallback: () => handlePlayMap(mapData)
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

		if ((MomentumAPI.GetLocalUserData().roles & Role.LIMITED) === 0) {
			if (mapData.userData?.inFavorites) {
				items.push({
					label: $.Localize('#Action_RemoveFromFavorites'),
					icon: 'file://{images}/favorite-remove.svg',
					style: 'icon-color-yellow',
					jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapFavorite', mapID, false)
				});
			} else {
				items.push({
					label: $.Localize('#Action_AddToFavorites'),
					icon: 'file://{images}/star.svg',
					style: 'icon-color-yellow',
					jsCallback: () => $.DispatchEvent('MapSelector_ToggleMapFavorite', mapID, true)
				});
			}
		}

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	update() {
		// Images and favorite and action buttons are handled in C++.
		const cp = this.panels.cp;
		const { staticData, userData } = this.panels.cp.mapData;
		const gamemode = GameModeAPI.GetMetaGameMode();
		const inSubmission = MapStatuses.IN_SUBMISSION.includes(staticData.status);

		cp.SetDialogVariable('name', staticData.name);
		cp.SetHasClass('map-entry--submission', inSubmission);

		// If we're in submission, use the tier of suggested by the submitter, if exists
		const tier = getTier(staticData, gamemode);
		cp.SetHasClass('map-entry--has-tier', Boolean(tier));
		if (tier) {
			cp.SetDialogVariableInt('tier', tier);
		}

		const userTrackData = getUserMapDataTrack(userData, gamemode);
		cp.SetHasClass('map-entry--completed', userTrackData?.completed ?? false);

		if (userData && userTrackData && userTrackData.time > 0) {
			cp.SetDialogVariableFloat('time', userTrackData.time);
			// Current system doesn't know user ranks
			const icon = /* track.pr.rank <= 10 ? 'file://{images}/ranks/top10.svg' : */ 'file://{images}/flag.svg';
			this.panels.pbIcon.SetImage(icon);
			this.panels.pbLabel.SetTextWithDialogVariables('{g:time:time}'); // BUG: This is already set in the XML, but for some reason this is needed for the time to always display

			let tooltip = `<b>${$.Localize('#Common_PersonalBest')}</b>: {g:time:time}`;
			if (userData.lastPlayed > 0) {
				// Derived from C time() function (unix time in seconds, JS is in milliseconds), so * 1000
				const lastPlayed = new Date(userData.lastPlayed * 1000).toLocaleDateString();
				tooltip += `<br><b>${$.Localize('#Common_LastPlayed')}</b>: ${lastPlayed}`;
			}

			this.panels.pbPanel.SetPanelEvent('onmouseover', () =>
				UiToolkitAPI.ShowTextTooltip(this.panels.pbPanel.id, tooltip)
			);
		} else {
			this.panels.pbLabel.text = '';
			this.panels.pbIcon.SetImage('');
			this.panels.pbPanel.ClearPanelEvent('onmouseover');
		}

		const isPrivate = MapStatuses.PRIVATE.includes(staticData.status);
		const isNew =
			staticData.status === MapStatus.APPROVED &&
			Date.now() - new Date(staticData.info.approvedDate).getTime() < NEW_MAP_BANNER_CUTOFF;

		if (isPrivate) {
			cp.SetDialogVariable('banner', this.strings.bannerPrivate);
			cp.SetHasClass('map-entry--private', true);
			cp.SetHasClass('map-entry--new', false);
		} else if (isNew) {
			cp.SetDialogVariable('banner', this.strings.bannerNew);
			cp.SetHasClass('map-entry--private', false);
			cp.SetHasClass('map-entry--new', true);
		} else {
			cp.SetHasClass('map-entry--private', false);
			cp.SetHasClass('map-entry--new', false);
		}
	}

	// Update map lobby player count
	updatePlayerCount(playerCount: number) {
		const panel = this.panels.lobbyContainer;
		if (playerCount > 0) {
			panel.visible = true;
			panel.SetDialogVariableInt('player_count', playerCount);
			panel.SetPanelEvent('onmouseover', () =>
				UiToolkitAPI.ShowTextTooltip(
					panel.id,
					playerCount > 1 ? '#Lobby_MapLobby_Count_Plural' : '#Lobby_MapLobby_Count_Singular'
				)
			);
		} else {
			panel.visible = false;
		}
	}
}
