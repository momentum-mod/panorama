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

	static panels = {
		/** @type {Panel} @static */
		subtypeButtons: $('#FilterButtonsSubtype'),
		/** @type {Button} @static */
		lobbyButton: $('#TimesListLobby'),
		/** @type {Panel} @static */
		timesContainer: $('#LeaderboardTimesContainer'),
		/** @type {Label} @static */
		emptyWarningText: $('#LeaderboardEmptyWarningText'),
		/** @type {Button} @static */
		endOfRunButton: $('#EndOfRunButton')
	};

	static {
		$.RegisterEventHandler('Leaderboards_TimesFiltered', $.GetContextPanel(), this.onTimesUpdated.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Show', this.onShowEndOfRun.bind(this));
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', this.onMapLoad.bind(this));

		// Default to Top 10
		this.setSelectedTimesList(TIME_LIST_TYPE.LIST_GLOBAL);
		this.setSelectedListType(TIME_LIST_TYPE.LIST_GLOBAL, LEADERBOARD_TYPE.TIMES_TOP10);
		this.setSelectedListType(TIME_LIST_TYPE.LIST_LOCAL, LEADERBOARD_TYPE.TIMES_LOCAL);
	}

	static onTimesUpdated(count) {
		const currentListType = this.getSelectedListType();

		let statusType = null;
		if (currentListType) {
			statusType = $.GetContextPanel().getTimesListStatus(currentListType);
		} else {
			$.Warning('Warning: Current leaderboard list type is undefined!');
		}

		this.panels.timesContainer.RemoveClass('leaderboard-times__main--loading');
		this.panels.timesContainer.RemoveClass('leaderboard-times__main--empty');

		if (statusType == LEADERBOARD_STATUS_TYPE.STATUS_TIMES_LOADING) {
			this.panels.timesContainer.AddClass('leaderboard-times__main--loading');
		} else if (count == 0) {
			// TODO: Use dialog vars here! Christ!
			switch (statusType) {
				case LEADERBOARD_STATUS_TYPE.STATUS_NO_TIMES_RETURNED:
					if (this.getSelectedListType() == LEADERBOARD_TYPE.TIMES_FRIENDS) {
						this.panels.emptyWarningText.text = 'None of your friends have set times on this map!';
					} else if (this.getSelectedListType() == LEADERBOARD_TYPE.TIMES_LOCAL) {
						this.panels.emptyWarningText.text = 'You have no local replays of this map!';
					} else if (this.getSelectedListType() == LEADERBOARD_TYPE.TIMES_LOCAL_DOWNLOADED) {
						this.panels.emptyWarningText.text = 'You have no downloaded replays of this map!';
					} else if (this.getSelectedListType() == LEADERBOARD_TYPE.TIMES_LOBBY) {
						this.panels.emptyWarningText.text = 'Nobody in the lobby has set a time on this map!';
					} else {
						this.panels.emptyWarningText.text = 'This map has no completions!';
					}
					this.panels.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_NO_PB_SET:
					this.panels.emptyWarningText.text = "You don't have any completions of this map!";
					this.panels.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_NO_FRIENDS:
					this.panels.emptyWarningText.text = "You don't have any friends, precious...";
					this.panels.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_UNAUTHORIZED_FRIENDS_LIST:
					this.panels.emptyWarningText.text = 'Your friends list is private!';
					this.panels.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_SERVER_ERROR:
					this.panels.emptyWarningText.text = 'Error fetching map times! Shit!!';
					this.panels.timesContainer.AddClass('leaderboard-times__main--empty');
					break;
				case LEADERBOARD_STATUS_TYPE.STATUS_TIMES_LOADED:
					$.Warning('Error: getTimesListStatus returned STATUS_TIMES_LOADED, with no times!');
					break;
				default:
					$.Warning('Error: getTimesListStatus returned unknown StatusType ' + statusType);
			}
		}
	}

	static setSelectedTimesList(timesList) {
		this.panels.subtypeButtons.SetHasClass('leaderboard-filter-buttons__subtypes--online', timesList === TIME_LIST_TYPE.LIST_GLOBAL);
		this.panels.subtypeButtons.SetHasClass('leaderboard-filter-buttons__subtypes--lobby', timesList === TIME_LIST_TYPE.LIST_LOBBY);

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
		if (!this.panels.lobbyButton.enabled) {
			UiToolkitAPI.ShowTextTooltip(this.panels.lobbyButton.id, 'Join a Lobby to see Lobby times!');
		}
	}

	static showEndOfRun() {
		$.DispatchEvent('EndOfRun_Show', EOR_SHOW_REASON.MANUALLY_SHOWN);
	}

	/**
	 * Show the button to go to the end of run page.
	 * Should only be shown if you're completing a run in the current session on the current map.
	 * @param {EOR_SHOW_REASON} showReason - Why the end of run panel is being shown. See EOR_SHOW_REASON for reasons.
	 */
	static onShowEndOfRun(showReason) {
		if (showReason === EOR_SHOW_REASON.PLAYER_FINISHED_RUN) {
			this.panels.endOfRunButton.visible = true;
		}
	}

	/**
	 * Hide the button to go to the end of run page.
	 */
	static onMapLoad(_isOfficial) {
		this.panels.endOfRunButton.visible = false;
	}
}
