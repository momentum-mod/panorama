import { PanelHandler } from 'util/module-helpers';
import { LeaderboardEntryType } from 'common/leaderboard';

@PanelHandler()
class LeaderboardEntryHandler {
	avatarPanel = $<AvatarImage>('#LeaderboardEntryAvatarPanel');

	constructor() {
		$.RegisterEventHandler('LeaderboardEntry_TimeDataUpdated', $.GetContextPanel(), this.timeDataUpdate);
	}

	timeDataUpdate() {
		const timeData = $.GetContextPanel<LeaderboardEntry>().timeData;

		if (!timeData) return;

		if (timeData.type === LeaderboardEntryType.LOCAL || timeData.type === LeaderboardEntryType.ONLINE_CACHED) {
			const index = $.GetContextPanel().GetAttributeInt('item_index', 0);
			$.GetContextPanel().SetDialogVariableInt('rank', index + 1);
		}

		this.avatarPanel.steamid = timeData.steamID;

		$.GetContextPanel().SetHasClass(
			'leaderboard-entry--localplayer',
			timeData.steamID === UserAPI.GetXUID() && timeData.type === LeaderboardEntryType.ONLINE
		);
	}

	tryDeleteReplay(index: number) {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#Action_DeleteReplay'),
			$.Localize('#Action_DeleteReplay_Confirm'),
			'ok-cancel-popup',
			() => $.DispatchEvent('LeaderboardEntry_DeleteReplay', index),
			() => {}
		);
	}

	showContextMenu() {
		const timeData = $.GetContextPanel<LeaderboardEntry>().timeData;
		if (!timeData) return;

		const items = [];
		const index = $.GetContextPanel().GetAttributeInt('item_index', 0);
		const isValid = timeData.type !== LeaderboardEntryType.INVALID;
		if (isValid) {
			items.push({
				label: $.Localize('#Action_WatchReplay'),
				icon: 'file://{images}/movie-open-outline.svg',
				style: 'icon-color-mid-blue',
				jsCallback: () => {
					$.DispatchEvent('LeaderboardEntry_PlayReplay', index);
				}
			});
		}

		if (timeData.type === LeaderboardEntryType.ONLINE || timeData.type === LeaderboardEntryType.ONLINE_CACHED) {
			items.push({
				label: $.Localize('#Action_ViewOnWebsite'),
				icon: 'file://{images}/online/publiclobby.svg',
				style: 'icon-color-blue',
				jsCallback: () => {
					SteamOverlayAPI.OpenURLModal(`https://momentum-mod.org/dashboard/runs/${timeData.replayID}`);
				}
			});
		}

		if (timeData.type === LeaderboardEntryType.LOCAL || timeData.type === LeaderboardEntryType.ONLINE_CACHED) {
			$.GetContextPanel().SetDialogVariableInt('rank', index + 1);
			items.push({
				label: $.Localize('#Action_DeleteReplay'),
				icon: 'file://{images}/delete.svg',
				style: 'icon-color-red',
				jsCallback: () => {
					this.tryDeleteReplay(index);
				}
			});
		}

		if (
			timeData.type === LeaderboardEntryType.ONLINE ||
			timeData.type === LeaderboardEntryType.ONLINE_CACHED ||
			!isValid
		) {
			items.push({
				label: $.Localize('#Action_ShowSteamProfile'),
				icon: 'file://{images}/social/steam.svg',
				style: 'icon-color-steam-online',
				jsCallback: () => {
					SteamOverlayAPI.OpenToProfileID(timeData.steamID);
				}
			});
		}

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}
}
