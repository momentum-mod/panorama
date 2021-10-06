'use strict';

const LeaderboardEntryType = {
	INVALID: -1,
	LOCAL: 0,
	ONLINE: 1,
	ONLINE_CACHED: 2
};

class LeaderboardEntry {
	static avatarPanel = $('#LeaderboardEntryAvatarPanel');

	static {
		$.RegisterEventHandler('LeaderboardEntry_TimeDataUpdated', $.GetContextPanel(), LeaderboardEntry.timeDataUpdate);
	}

	static timeDataUpdate() {
		const timeData = $.GetContextPanel().timeData;

		if (!timeData) return;

		if (timeData.type === LeaderboardEntryType.LOCAL || timeData.type === LeaderboardEntryType.ONLINE_CACHED) {
			const index = $.GetContextPanel().GetAttributeInt('item_index', 0);
			$.GetContextPanel().SetDialogVariableInt('rank', index + 1);
		}

		LeaderboardEntry.avatarPanel.steamid = timeData.steamID;

		$.GetContextPanel().SetHasClass('leaderboard-entry--localplayer', timeData.steamID === UserAPI.GetXUID() && timeData.type === LeaderboardEntryType.ONLINE);
	}

	static tryDeleteReplay(index) {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#MOM_Leaderboards_DeleteReplay'),
			$.Localize('#MOM_MB_DeleteRunConfirmation'),
			'ok-cancel-popup',
			() => $.DispatchEvent('LeaderboardEntry_DeleteReplay', index),
			() => {}
		);
	}

	static showContextMenu() {
		const timeData = $.GetContextPanel().timeData;
		if (!timeData) return;

		let items = [];
		const index = $.GetContextPanel().GetAttributeInt('item_index', 0);
		const isValid = timeData.type !== LeaderboardEntryType.INVALID;
		if (isValid) {
			items.push({
				label: $.Localize('#MOM_Leaderboards_WatchReplay'),
				icon: 'file://{images}/replay-open.svg',
				style: 'icon-color-mid-blue',
				jsCallback: () => {
					$.DispatchEvent('LeaderboardEntry_PlayReplay', index);
				}
			});
		}

		if (timeData.type === LeaderboardEntryType.LOCAL || timeData.type === LeaderboardEntryType.ONLINE_CACHED) {
			$.GetContextPanel().SetDialogVariableInt('rank', index + 1);
			items.push({
				label: $.Localize('#MOM_Leaderboards_DeleteReplay'),
				icon: 'file://{images}/delete.svg',
				style: 'icon-color-red',
				jsCallback: () => {
					this.tryDeleteReplay(index);
				}
			});
		}

		if (timeData.type === LeaderboardEntryType.ONLINE || timeData.type == LeaderboardEntryType.ONLINE_CACHED || !isValid) {
			items.push({
				label: 'Steam Profile',
				icon: 'file://{images}/steam.svg',
				style: 'icon-color-steam-online',
				jsCallback: () => {
					SteamOverlayAPI.OpenToProfileID(timeData.steamID);
				}
			});
		}

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}
}
