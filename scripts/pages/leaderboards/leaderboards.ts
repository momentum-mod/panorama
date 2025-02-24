import { exposeToPanelContext, PanelHandler } from 'util/module-helpers';
import { LeaderboardListType, LeaderboardStatusType, LeaderboardType, sortLeaderboard } from 'common/leaderboard';
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
		syncTrackButton: $<Button>('#SyncTrackButton'),
		endOfRunButton: $<Button>('#EndOfRunButton'),
		tracksDropdown: $<DropDown>('#TracksDropdown'),
		radioButtons: {
			listTypes: {
				global: $<RadioButton>('#TimesListGlobal'),
				local: $<RadioButton>('#TimesListLocal'),
				lobby: $<RadioButton>('#TimesListLobby')
			},
			local: {
				runs: $<RadioButton>('#LocalTypeRuns'),
				downloaded: $<RadioButton>('#LocalTypeDownloaded')
			},
			online: {
				top10: $<RadioButton>('#OnlineTypeTop10'),
				around: $<RadioButton>('#OnlineTypeAround'),
				friends: $<RadioButton>('#OnlineTypeFriends')
			}
		}
	};

	constructor() {
		$.RegisterEventHandler('Leaderboards_TimesFiltered', this.panels.cp, (count) => this.onTimesUpdated(count));
		$.RegisterEventHandler('EndOfRun_Show', this.panels.cp, (reason) => this.onShowEndOfRun(reason));
		$.RegisterEventHandler('Leaderboards_OfficialMapLeaderboardsLoaded', this.panels.cp, (map) =>
			this.onOfficialMapLeaderboardsLoaded(map)
		);
		$.RegisterEventHandler('Leaderboards_LocalMapLeaderboardsLoaded', this.panels.cp, () =>
			this.onLocalMapLeaderboardsLoaded()
		);

		// Note: Can't set radio button groups in the XML because it causes multiple leaderboard instances to interfere with eachother
		const lbType = this.panels.cp.id === 'TabMenuLeaderboards' ? 'TabMenu' : 'MapSelector';
		Object.entries(this.panels.radioButtons).forEach(([group, buttons]) => {
			Object.values(buttons).forEach((button) => (button.group = lbType + group));
		});

		this.panels.radioButtons.listTypes.global.SetSelected(true);
		this.panels.radioButtons.local.runs.SetSelected(true);
		this.panels.radioButtons.online.top10.SetSelected(true);

		// Default to Top 10
		this.setSelectedTimesList(LeaderboardListType.GLOBAL);
		this.setSelectedListType(LeaderboardListType.GLOBAL, LeaderboardType.TOP10);
		this.setSelectedListType(LeaderboardListType.LOCAL, LeaderboardType.LOCAL);

		this.panels.tracksDropdown.RemoveAllOptions();
		this.panels.tracksDropdown.visible = false;

		this.panels.endOfRunButton.visible = false;
		this.panels.syncTrackButton.visible = false;
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
				this.panels.cp.SetDialogVariable('empty-warning', $.Localize(warningText));
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

	syncTrackWithLeaderboard() {
		const selected = this.panels.tracksDropdown.GetSelected();
		const trackType = selected.GetAttributeInt('trackType', TrackType.MAIN as number);
		const trackNum = selected.GetAttributeInt('trackNum', 1);

		switch (trackType) {
			case TrackType.MAIN:
				GameInterfaceAPI.ConsoleCommand('mom_main');
				break;
			case TrackType.STAGE:
				GameInterfaceAPI.ConsoleCommand(`mom_stage ${trackNum}`);
				break;
			case TrackType.BONUS:
				GameInterfaceAPI.ConsoleCommand(`mom_bonus ${trackNum}`);
				break;
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

	onOfficialMapLeaderboardsLoaded(map: MMap) {
		this.panels.tracksDropdown.RemoveAllOptions();

		const isTabMenu = this.panels.cp.id === 'TabMenuLeaderboard';
		const currentMode = isTabMenu ? GameModeAPI.GetCurrentGameMode() : GameModeAPI.GetMetaGameMode();
		map.leaderboards
			.filter((leaderboard) => leaderboard.gamemode === currentMode)
			.sort(sortLeaderboard)
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

		this.initTracksDropdown();
	}

	onLocalMapLeaderboardsLoaded() {
		this.panels.tracksDropdown.RemoveAllOptions();

		// Try to load tracks from local zones
		const mapZoneData = MomentumTimerAPI.GetActiveZoneDefs();
		if (mapZoneData) {
			// Main track
			{
				const trackStr = $.Localize('#Leaderboards_Tracks_Main');
				const item = $.CreatePanel('Label', this.panels.tracksDropdown, trackStr, {
					text: trackStr,
					value: 0
				});
				item.SetAttributeInt('trackNum', 1);
				item.SetAttributeInt('trackType', TrackType.MAIN);

				this.panels.tracksDropdown.AddOption(item);
			}

			// Stage tracks
			const segments = mapZoneData.tracks.main.zones.segments;
			if (segments.length > 1) {
				segments.forEach((_, index) => {
					const trackStr = `${$.Localize('#Leaderboards_Tracks_Stage')} ${index + 1}`;
					const item = $.CreatePanel('Label', this.panels.tracksDropdown, trackStr, {
						text: trackStr,
						value: index + 1
					});
					item.SetAttributeInt('trackNum', index + 1);
					item.SetAttributeInt('trackType', TrackType.STAGE);

					this.panels.tracksDropdown.AddOption(item);
				});
			}

			// Bonus tracks
			const bonuses = mapZoneData.tracks.bonuses;
			if (bonuses) {
				bonuses.forEach((_, index) => {
					const trackStr = `${$.Localize('#Leaderboards_Tracks_Bonus')} ${index + 1}`;
					const item = $.CreatePanel('Label', this.panels.tracksDropdown, trackStr, {
						text: trackStr,
						value: index + 1
					});
					item.SetAttributeInt('trackNum', index + 1);
					item.SetAttributeInt('trackType', TrackType.BONUS);

					this.panels.tracksDropdown.AddOption(item);
				});
			}
		}

		this.initTracksDropdown();
	}

	initTracksDropdown() {
		if (this.panels.tracksDropdown.AccessDropDownMenu().GetChildCount() === 0) {
			this.panels.tracksDropdown.visible = false;
			return;
		}

		// Allow player to sync their current track to the value selected in the dropdown
		if (this.panels.cp.id === 'TabMenuLeaderboards') {
			this.panels.syncTrackButton.visible = true;
		}

		this.panels.tracksDropdown.visible = true;
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
