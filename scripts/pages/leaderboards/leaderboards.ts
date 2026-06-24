import { exposeToPanelContext, PanelHandler } from 'util/module-helpers';
import {
	LeaderboardListType,
	LeaderboardRecordsFilter,
	LeaderboardStatusType,
	LeaderboardType,
	sortLeaderboard
} from 'common/leaderboard';
import { EndOfRunShowReason } from 'common/timer';
import { TrackType } from 'common/web/enums/track-type.enum';
import type { MMap } from 'common/web/types/models/models';
import { Style } from 'common/web/enums/style.enum';
import { randomInt } from 'util/functions';

exposeToPanelContext({ LeaderboardListType, LeaderboardType });

@PanelHandler()
class LeaderboardsHandler {
	selectedTimesList: LeaderboardListType;
	selectedGlobalListType: LeaderboardType;
	selectedLocalListType: LeaderboardType;

	readonly panels = {
		cp: $.GetContextPanel<Leaderboards>(),
		lobbyButton: $<Button>('#TimesListLobby'),
		timesContainer: $<Panel>('#LeaderboardTimesContainer'),
		emptyWarningText: $<Label>('#LeaderboardEmptyWarningText'),
		syncTrackButton: $<Button>('#SyncTrackButton'),
		stylesDropdown: $<DropDown>('#StylesDropdown'),
		radioButtons: {
			listTypes: {
				global: $<RadioButton>('#TimesListGlobal'),
				friends: $<RadioButton>('#TimesListFriends'),
				lobby: $<RadioButton>('#TimesListLobby'),
				local: $<RadioButton>('#TimesListLocal')
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
		},
		controls: {
			container: $<Panel>('#ControlsContainer'),
			pagePrev: $<Button>('#PagePrev'),
			pageNext: $<Button>('#PageNext'),
			groupPrev: $<Button>('#GroupPrev'),
			groupNext: $<Button>('#GroupNext'),
			pageSelect: $<TextEntry>('#PageSelect'),
			totalPages: $<Label>('#TotalPages')
		}
	};

	currentPage = 1;
	totalPages = 1;
	blockTextEntryEvent = false;

	constructor() {
		// C++ is probably sending this event 3 times per map selection slowing down leaderboards loading
		$.RegisterEventHandler('Leaderboards_TimesFiltered', this.panels.cp, (count) => this.onTimesUpdated(count));
		$.RegisterEventHandler('Leaderboards_OfficialMapLeaderboardsLoaded', this.panels.cp, (map) =>
			this.onOfficialMapLeaderboardsLoaded(map)
		);

		// DEBUG: log the loaded page whenever a getLeaderboardRecords() request completes.
		$.RegisterEventHandler('LeaderboardRecords_Loaded', this.panels.cp, (requestToken) =>
			this.debugLogLoadedRecords(requestToken)
		);

		// Note: Can't set radio button groups in the XML because it causes multiple leaderboard instances to interfere with eachother
		const lbType = this.isInGameLeaderboard() ? 'TabMenu' : 'MapSelector';
		Object.entries(this.panels.radioButtons).forEach(([group, buttons]) => {
			Object.values(buttons).forEach((button) => (button.group = lbType + group));
		});

		this.panels.controls.pageSelect.SetPanelEvent('ontextentrychange', () => {
			if (!this.blockTextEntryEvent) {
				this.selectPage(this.panels.controls.pageSelect.text as any as number);
			}
		});

		this.panels.stylesDropdown.visible = false;
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
		this.selectedTimesList = LeaderboardListType.GLOBAL;
		this.panels.radioButtons.online.top10.SetSelected(true);
	}

	getSelectedListType() {
		this.panels.radioButtons.online.top10.SetSelected(true);

		this.totalPages = randomInt(1, 2000);
		this.panels.controls.totalPages.SetDialogVariableInt('total-pages', this.totalPages);

		this.selectPage(1);

		return LeaderboardType.TOP10;
	}

	showLobbyTooltip() {
		if (!this.panels.lobbyButton.enabled) {
			UiToolkitAPI.ShowTextTooltip(this.panels.lobbyButton.id, $.Localize('#Leaderboards_JoinLobbyTooltip'));
		}
	}

	showEndOfRun() {
		$.DispatchEvent('EndOfRun_Show', EndOfRunShowReason.MANUALLY_SHOWN);
	}

	onOfficialMapLeaderboardsLoaded(map: MMap) {
		const currentMode = this.getCurrentMode();
		const currentStyle = Style.NORMAL;
		map.leaderboards
			.filter((leaderboard) => leaderboard.gamemode === currentMode && leaderboard.style === currentStyle)
			.sort(sortLeaderboard)
			.forEach((leaderboard, index) => {
				let trackStr;
				switch (leaderboard.trackType) {
					case TrackType.MAIN:
						trackStr = $.Localize('#Leaderboards_Tracks_Main');
						break;
					case TrackType.STAGE:
						trackStr = `${$.Localize('#Leaderboards_Tracks_Stage')} ${leaderboard.trackNum}`;
						break;
					case TrackType.BONUS:
						trackStr = `${$.Localize('#Leaderboards_Tracks_Bonus')} ${leaderboard.trackNum}`;
						break;
				}
			});
<<<<<<< HEAD

		// this.initTracksDropdown();

		// DEBUG: fetch and log the first page of global records for the newly selected map.
		this.debugFetchFirstPage(map);
	}

	/** DEBUG: request page 0 of the global leaderboard for the main track of the given map. */
	debugFetchFirstPage(map: MMap) {
		const currentMode = this.getCurrentMode();
		const currentStyle =
			this.panels.stylesDropdown.GetSelected()?.GetAttributeInt('value', Style.NORMAL) ?? Style.NORMAL;

		const token = this.panels.cp.getLeaderboardRecords(
			map.id,
			currentMode,
			TrackType.MAIN,
			1,
			currentStyle,
			LeaderboardRecordsFilter.GLOBAL,
			0 /* page */
		);

		$.Msg(`[LeaderboardRecords] Requested page 0 for map ${map.name} (id ${map.id}), token ${token}`);
	}

	/** DEBUG: dump a completed getLeaderboardRecords() page to the console. */
	debugLogLoadedRecords(requestToken: int32) {
		const result = this.panels.cp.getLoadedLeaderboardRecords();
		if (result.requestToken !== requestToken) return; // superseded by a newer request

		$.Msg(
			`[LeaderboardRecords] Loaded token ${requestToken}: filter=${result.filter} page=${result.page}/${result.totalPages} status=${result.status} count=${result.records.length}`
		);
		for (const r of result.records) {
			$.Msg(`  #${r.rank}  ${r.playerName}  ${r.runTime}s  ${r.steamID}`);
		}
=======
>>>>>>> cdaf35de (WIP: Add Leaderboards Part 2)
	}

	// $.Localize('#Leaderboards_Tracks_Main')
	// $.Localize('#Leaderboards_Tracks_Stage')
	// $.Localize('#Leaderboards_Tracks_Bonus')

	previousPage() {
		if (this.currentPage <= 1) this.currentPage = 1;
		else this.currentPage = +this.currentPage - 1;

		this.setTextEntry(this.currentPage);
	}

	nextPage() {
		if (this.currentPage >= this.totalPages) this.currentPage = +this.totalPages;
		else this.currentPage = +this.currentPage + 1;

		this.setTextEntry(this.currentPage);
	}

	previousGroup() {
		$.Msg('NO GROUPS YET');
	}

	nextGroup() {
		$.Msg('NO GROUPS YET');
	}

	selectPage(page: number) {
		if (page < 1) page = 1;
		if (page > this.totalPages) page = +this.totalPages;

		this.currentPage = page;

		this.setTextEntry(this.currentPage);

		//updateLeaderboards(this.currentPage);
	}

	getCurrentMode() {
		const isTabMenu = this.isInGameLeaderboard();
		if (isTabMenu) {
			return GameModeAPI.GetCurrentGameMode();
		} else {
			return GameModeAPI.GetMetaGameMode();
		}
	}

	isInGameLeaderboard() {
		return this.panels.cp.id === 'TabMenuLeaderboards';
	}

	setTextEntry(val: number) {
		this.blockTextEntryEvent = true;
		this.panels.controls.pageSelect.text = `${val}`;
		this.blockTextEntryEvent = false;
	}
}
