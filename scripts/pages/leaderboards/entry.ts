const LEADERBOARD_ENTRY_TYPE = {
	INVALID: -1,
	LOCAL: 0,
	ONLINE: 1,
	ONLINE_CACHED: 2
};

class LeaderboardEntry {
	static avatarPanel = $('#LeaderboardEntryAvatarPanel');

	static {
		$.RegisterEventHandler(
			'LeaderboardEntry_TimeDataUpdated',
			$.GetContextPanel(),
			LeaderboardEntry.timeDataUpdate
		);
	}

	static timeDataUpdate() {
		const timeData = $.GetContextPanel().timeData;

		if (!timeData) return;

		if (timeData.type === LEADERBOARD_ENTRY_TYPE.LOCAL || timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE_CACHED) {
			const index = $.GetContextPanel().GetAttributeInt('item_index', 0);
			$.GetContextPanel().SetDialogVariableInt('rank', index + 1);
		}

		LeaderboardEntry.avatarPanel.steamid = timeData.steamID;

		$.GetContextPanel().SetHasClass(
			'leaderboard-entry--localplayer',
			timeData.steamID === UserAPI.GetXUID() && timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE
		);
	}

	static tryDeleteReplay(index) {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			$.Localize('#Action_DeleteReplay'),
			$.Localize('#Action_DeleteReplay_Confirm'),
			'ok-cancel-popup',
			() => $.DispatchEvent('LeaderboardEntry_DeleteReplay', index),
			() => {}
		);
	}

	static showContextMenu() {
		const timeData = $.GetContextPanel().timeData;
		if (!timeData) return;

		const items = [];
		const index = $.GetContextPanel().GetAttributeInt('item_index', 0);
		const isValid = timeData.type !== LEADERBOARD_ENTRY_TYPE.INVALID;
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

		if (timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE || timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE_CACHED) {
			items.push({
				label: $.Localize('#Action_ViewOnWebsite'),
				icon: 'file://{images}/online/publiclobby.svg',
				style: 'icon-color-blue',
				jsCallback: () => {
					SteamOverlayAPI.OpenURLModal(`https://momentum-mod.org/dashboard/runs/${timeData.replayID}`);
				}
			});
		}

		if (timeData.type === LEADERBOARD_ENTRY_TYPE.LOCAL || timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE_CACHED) {
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
			timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE ||
			timeData.type === LEADERBOARD_ENTRY_TYPE.ONLINE_CACHED ||
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
