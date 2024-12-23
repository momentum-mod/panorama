import { exposeToPanelContext, PanelHandler } from 'util/module-helpers';
import { LeaderboardListType, LeaderboardStatusType, LeaderboardType } from 'common/leaderboard';
import { EndOfRunShowReason } from 'common/timer';
import { MMap, TrackType } from 'common/web';

exposeToPanelContext({ LeaderboardListType, LeaderboardType });

@PanelHandler()
class LeaderboardsHandler {
	selectedTimesList: LeaderboardListType;
	selectedGlobalListType: LeaderboardType;
	selectedLocalListType: LeaderboardType;

	readonly panels = {
		cp: $.GetContextPanel<Leaderboards>(),
		subtypeButtons: $<Panel>('#FilterButtonsSubtype'),
		lobbyButton: $<Button>('#TimesListLobby'),
		timesContainer: $<Panel>('#LeaderboardTimesContainer'),
		emptyWarningText: $<Label>('#LeaderboardEmptyWarningText'),
		endOfRunButton: $<Button>('#EndOfRunButton'),
		tracksDropdown: $<DropDown>('#TracksDropdown')
	};

	constructor() {
		$.RegisterEventHandler('Leaderboards_TimesFiltered', $.GetContextPanel(), (count) =>
			this.onTimesUpdated(count)
		);
		$.RegisterForUnhandledEvent('EndOfRun_Show', (reason) => this.onShowEndOfRun(reason));
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.onMapLoad(isOfficial));
		$.RegisterForUnhandledEvent('Leaderboards_MapLeaderboardsLoaded', (map) => this.onMapLeaderboardsLoad(map));

		// Default to Top 10
		this.setSelectedTimesList(LeaderboardListType.GLOBAL);
		this.setSelectedListType(LeaderboardListType.GLOBAL, LeaderboardType.TOP10);
		this.setSelectedListType(LeaderboardListType.LOCAL, LeaderboardType.LOCAL);
	}

	onTimesUpdated(count: number) {
		const currentListType = this.getSelectedListType();

		let statusType = null;
		if (currentListType !== undefined) {
			statusType = this.panels.cp.getTimesListStatus(currentListType);
		} else {
			$.Warning('Warning: Current leaderboard list type is undefined!');
		}

		this.panels.timesContainer.RemoveClass('leaderboard-times__main--loading');
		this.panels.timesContainer.RemoveClass('leaderboard-times__main--empty');

		if (statusType === LeaderboardStatusType.TIMES_LOADING) {
			this.panels.timesContainer.AddClass('leaderboard-times__main--loading');
		} else if (count === 0) {
			let warningText = null;
			switch (statusType) {
				case LeaderboardStatusType.NO_TIMES_RETURNED:
					switch (this.getSelectedListType()) {
						case LeaderboardType.FRIENDS:
							warningText = '#Leaderboards_Error_NoFriendTimes';
							break;
						case LeaderboardType.LOCAL:
							warningText = '#Leaderboards_Error_NoLocalReplays';
							break;
						case LeaderboardType.LOCAL_DOWNLOADED:
							warningText = '#Leaderboards_Error_NoDownloadedReplays';
							break;
						case LeaderboardType.LOBBY:
							warningText = '#Leaderboards_Error_NoLobbyTimes';
							break;
						default:
							warningText = '#Leaderboards_Error_NoCompletions';
							break;
					}
					break;
				case LeaderboardStatusType.NO_PB_SET:
					warningText = '#Leaderboards_Error_NoPB';
					break;
				case LeaderboardStatusType.NO_FRIENDS:
					warningText = '#Leaderboards_Error_NoFriends';
					break;
				case LeaderboardStatusType.UNAUTHORIZED_FRIENDS_LIST:
					warningText = '#Leaderboards_Error_FriendsPrivate';
					break;
				case LeaderboardStatusType.SERVER_ERROR:
					warningText = '#Leaderboards_Error_ServerError';
					break;
				case LeaderboardStatusType.TIMES_LOADED:
					$.Warning('Error: getTimesListStatus returned LOADED, with no times!');
					break;
				default:
					$.Warning('Error: getTimesListStatus returned unknown StatusType ' + statusType);
					break;
			}
			if (warningText) {
				$.GetContextPanel().SetDialogVariable('empty-warning', $.Localize(warningText));
				this.panels.timesContainer.AddClass('leaderboard-times__main--empty');
			}
		}
	}

	setSelectedTimesList(timesList: LeaderboardListType) {
		this.panels.subtypeButtons.SetHasClass(
			'leaderboard-filter-buttons__subtypes--online',
			timesList === LeaderboardListType.GLOBAL
		);
		this.panels.subtypeButtons.SetHasClass(
			'leaderboard-filter-buttons__subtypes--lobby',
			timesList === LeaderboardListType.LOBBY
		);

		this.selectedTimesList = timesList;
	}

	setSelectedListType(timesList: LeaderboardListType, listType: LeaderboardType) {
		if (timesList === LeaderboardListType.LOCAL) {
			this.selectedLocalListType = listType;
		} else if (timesList === LeaderboardListType.GLOBAL) {
			this.selectedGlobalListType = listType;
		}
	}

	getSelectedListType() {
		if (this.selectedTimesList === LeaderboardListType.LOCAL) {
			return this.selectedLocalListType;
		} else if (this.selectedTimesList === LeaderboardListType.GLOBAL) {
			return this.selectedGlobalListType;
		} else {
			return LeaderboardType.LOBBY;
		}
	}

	showLobbyTooltip() {
		if (!this.panels.lobbyButton.enabled) {
			UiToolkitAPI.ShowTextTooltip(this.panels.lobbyButton.id, $.Localize('#Leaderboards_JoinLobbyTooltip'));
		}
	}

	showEndOfRun() {
		$.DispatchEvent('EndOfRun_Show', EndOfRunShowReason.MANUALLY_SHOWN);
	}

	/**
	 * Show the button to go to the end of run page.
	 * Should only be shown if you're completing a run in the current session on the current map.
	 */
	onShowEndOfRun(showReason: EndOfRunShowReason) {
		if (showReason === EndOfRunShowReason.PLAYER_FINISHED_RUN) {
			this.panels.endOfRunButton.visible = true;
		}
	}

	/**
	 * Hide the button to go to the end of run page.
	 */
	onMapLoad(_isOfficial: boolean) {
		this.panels.endOfRunButton.visible = false;
	}

	onMapLeaderboardsLoad(map: MMap) {
		this.panels.tracksDropdown.RemoveAllOptions();

		const isTabMenu = $.GetContextPanel().id === 'TabMenuLeaderboard';
		const currentMode = isTabMenu ? GameModeAPI.GetCurrentGameMode() : GameModeAPI.GetMetaGameMode();
		map.leaderboards
			.filter((leaderboard) => leaderboard.gamemode === currentMode)
			.forEach((leaderboard, index) => {
				let trackStr;
				if (leaderboard.trackType === 0) {
					trackStr = $.Localize('#Leaderboards_Tracks_Main');
				} else if (leaderboard.trackType === 1) {
					trackStr = `${$.Localize('#Leaderboards_Tracks_Stage')} ${leaderboard.trackNum}`;
				} else {
					trackStr = `${$.Localize('#Leaderboards_Tracks_Bonus')} ${leaderboard.trackNum}`;
				}

				const item = $.CreatePanel('Label', this.panels.tracksDropdown, trackStr, {
					text: trackStr,
					value: index
				});
				item.SetAttributeInt('trackNum', leaderboard.trackNum);
				item.SetAttributeInt('trackType', leaderboard.trackType);

				this.panels.tracksDropdown.AddOption(item);
			});

		this.panels.tracksDropdown.SetSelectedIndex(0);
		this.panels.tracksDropdown.SetPanelEvent('onuserinputsubmit', () => {
			const selected = this.panels.tracksDropdown.GetSelected();
			this.panels.cp.selectTrack(
				selected.GetAttributeInt('trackType', TrackType.MAIN as number),
				selected.GetAttributeInt('trackNum', 1)
			);
		});
	}
}
