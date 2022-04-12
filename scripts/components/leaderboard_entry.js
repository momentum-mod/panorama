'use strict';

const LEADERBOARD_ENTRY_TYPE = {
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

		if (timeData.type === LEADERBOARD_ENTRY_TYPE.LOCAL || timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE_CACHED) {
			const index = $.GetContextPanel().GetAttributeInt('item_index', 0);
			$.GetContextPanel().SetDialogVariableInt('rank', index + 1);
		}

		LeaderboardEntry.avatarPanel.steamid = timeData.steamID;

		$.GetContextPanel().SetHasClass('leaderboard-entry--localplayer', timeData.steamID === UserAPI.GetXUID() && timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE);
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
		const isValid = timeData.type !== LEADERBOARD_ENTRY_TYPE.INVALID;
		if (isValid) {
			items.push({
				label: $.Localize('#MOM_Leaderboards_WatchReplay'),
				icon: 'file://{images}/movie-open-outline.svg',
				style: 'icon-color-mid-blue',
				jsCallback: () => {
					$.DispatchEvent('LeaderboardEntry_PlayReplay', index);
				}
			});
		}

		if (timeData.type === LEADERBOARD_ENTRY_TYPE.LOCAL || timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE_CACHED) {
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

		if (timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE || timeData.type == LEADERBOARD_ENTRY_TYPE.ONLINE_CACHED || !isValid) {
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
