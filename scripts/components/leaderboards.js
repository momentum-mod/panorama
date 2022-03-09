'use strict';

const TIME_LIST_TYPE = {
	LIST_LOCAL: 0,
	LIST_GLOBAL: 1,
	LIST_LOBBY: 2
};

const LEADERBOARD_TYPE = {
	TIMES_LOCAL: 0,
	TIMES_LOCAL_DOWNLOADED: 1,
	TIMES_TOP10: 2,
	TIMES_FRIENDS: 3,
	TIMES_AROUND: 4,
	TIMES_LOBBY: 5
};

const LEADERBOARD_STATUS_TYPE = {
	STATUS_TIMES_LOADED: 0,
	STATUS_TIMES_LOADING: 1,
	STATUS_NO_TIMES_RETURNED: 2,
	STATUS_SERVER_ERROR: 3,
	STATUS_NO_PB_SET: 4,
	STATUS_NO_FRIENDS: 5,
	STATUS_UNAUTHORIZED_FRIENDS_LIST: 6
};

class Leaderboards {
	static selectedTimesList;
	static selectedGlobalListType;
	static selectedLocalListType;

	static subtypeButtons = $('#FilterButtonsSubtype');
	static lobbyButton = $('#TimesListLobby');
	static localButton = $('#TimesListLocal');
	static timesContainer = $('#LeaderboardTimesContainer');
	static emptyWarningText = $('#LeaderboardEmptyWarningText');

	static {
		$.RegisterEventHandler( 'Leaderboards_TimesFiltered', $.GetContextPanel(), Leaderboards.onTimesUpdated );

		// Default to Top 10
		this.setSelectedTimesList(TIME_LIST_TYPE.LIST_GLOBAL);
		this.setSelectedListType(TIME_LIST_TYPE.LIST_GLOBAL, LEADERBOARD_TYPE.TIMES_TOP10);
		this.setSelectedListType(TIME_LIST_TYPE.LIST_LOCAL, LEADERBOARD_TYPE.TIMES_LOCAL);
	}

	static onTimesUpdated(count) {
		const currentListType = Leaderboards.getSelectedListType();

		let statusType = null;
		if ( currentListType ) {
			statusType = $.GetContextPanel().getTimesListStatus(currentListType);
		}
		else {
			$.Msg('Warning: Current leaderboard list type is undefined!!');
		}

		Leaderboards.timesContainer.RemoveClass('leaderboard-times__main--loading');
		Leaderboards.timesContainer.RemoveClass('leaderboard-times__main--empty');

		if (statusType == LEADERBOARD_STATUS_TYPE.STATUS_TIMES_LOADING) {
			Leaderboards.timesContainer.AddClass('leaderboard-times__main--loading');
		} else if (count == 0) {
			switch (statusType) {
				case LEADERBOARD_STATUS_TYPE.STATUS_NO_TIMES_RETURNED:
					if (Leaderboards.getSelectedListType() == LEADERBOARD_TYPE.TIMES_FRIENDS) {
						Leaderboards.emptyWarningText.text = 'None of your friends have set times on this map!';
					}
					else if (Leaderboards.getSelectedListType() == LEADERBOARD_TYPE.TIMES_LOCAL) {
						Leaderboards.emptyWarningText.text = 'You have no local replays of this map!';
					}
					else if (Leaderboards.getSelectedListType() == LEADERBOARD_TYPE.TIMES_LOCAL_DOWNLOADED) {
						Leaderboards.emptyWarningText.text = 'You have no downloaded replays of this map!';
					}
					else if (Leaderboards.getSelectedListType() == LEADERBOARD_TYPE.TIMES_LOBBY) {
						Leaderboards.emptyWarningText.text = 'Nobody in the lobby has set a time on this map!';
					}
					else {
						Leaderboards.emptyWarningText.text = 'This map has no completions!';
					}
					Leaderboards.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_NO_PB_SET:
					Leaderboards.emptyWarningText.text = "You don't have any completions of this map!";
					Leaderboards.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_NO_FRIENDS:
					Leaderboards.emptyWarningText.text = "You don't have any friends, precious...";
					Leaderboards.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_UNAUTHORIZED_FRIENDS_LIST:
					Leaderboards.emptyWarningText.text = 'Your friends list is private!';
					Leaderboards.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_SERVER_ERROR:
					Leaderboards.emptyWarningText.text = 'Error fetching map times! Shit!!';
					Leaderboards.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_TIMES_LOADED:
					$.Msg('Error: getTimesListStatus returned STATUS_TIMES_LOADED, with no times!!');
					break;
				default:
					$.Msg('Error: getTimesListStatus returned unknown StatusType ' + statusType);
			}
		}
	}

	static setSelectedTimesList(timesList) {
		this.subtypeButtons.SetHasClass('leaderboard-filter-buttons__subtypes--online', timesList === TIME_LIST_TYPE.LIST_GLOBAL);
		this.subtypeButtons.SetHasClass('leaderboard-filter-buttons__subtypes--lobby', timesList === TIME_LIST_TYPE.LIST_LOBBY);

		this.selectedTimesList = timesList;
	}

	static setSelectedListType(timesList, listType) {
		if (timesList === TIME_LIST_TYPE.LIST_LOCAL) {
			this.selectedLocalListType = listType;
		} else if (timesList === TIME_LIST_TYPE.LIST_GLOBAL) {
			this.selectedGlobalListType = listType;
		}
	}

	static getSelectedListType() {
		if (this.selectedTimesList === TIME_LIST_TYPE.LIST_LOCAL) {
			return this.selectedLocalListType;
		} else if (this.selectedTimesList === TIME_LIST_TYPE.LIST_GLOBAL) {
			return this.selectedGlobalListType;
		} else {
			return LEADERBOARD_TYPE.TIMES_LOBBY;
		}
	}

	static showLobbyTooltip() {
		if (!this.lobbyButton.enabled) {
			UiToolkitAPI.ShowTextTooltip(this.lobbyButton.id, 'Join a Lobby to see Lobby times!');
		}
	}
}
