import { exposeToPanelContext, PanelHandler } from 'util/module-helpers';
import {
	LeaderboardListType,
	// LeaderboardRecordsFilter,
	// LeaderboardStatusType,
	LeaderboardType
	// sortLeaderboard
} from 'common/leaderboard';
import { EndOfRunShowReason } from 'common/timer';
import { TrackType } from 'common/web/enums/track-type.enum';
import { Style } from 'common/web/enums/style.enum';
import { LeaderboardRecordsFilter } from 'common/leaderboard';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { CompletionGroup } from 'common/web/enums/completion-group.enum';
import { LeaderboardRecord } from 'common/leaderboard';

// Keep in sync with entry.scss
const ENTRY_HEIGHT = 32;

// Keep in sync with the backend
const RUNS_PER_PAGE = 20;

const GROUP_BORDER_LEFT_ALIGN = -10;
const GROUP_BORDER_TOP_ALIGN = -13;

exposeToPanelContext({ LeaderboardListType, LeaderboardType, LeaderboardRecordsFilter });
@PanelHandler({ exposeToPanel: true })
export class LeaderboardsHandler {
	selectedTimesList: LeaderboardListType;
	selectedGlobalListType: LeaderboardType;
	selectedLocalListType: LeaderboardType;

	readonly panels = {
		cp: $.GetContextPanel<Leaderboards>(),
		timesList: $<Panel>('#TimesList2'),
		lobbyButton: $<Button>('#TimesListLobby'),
		timesContainer: $<Panel>('#LeaderboardTimesContainer'),
		groupPillsLayer: $<Panel>('#GroupPillsLayer'),
		emptyWarningText: $<Label>('#LeaderboardEmptyWarningText'),
		syncTrackButton: $<Button>('#SyncTrackButton'),
		stylesDropdown: $<DropDown>('#StylesDropdown'),
		around: $<Button>('#Around'),
		radioButtons: {
			global: $<RadioButton>('#TimesListGlobal'),
			friends: $<RadioButton>('#TimesListFriends'),
			lobby: $<RadioButton>('#TimesListLobby'),
			local: $<RadioButton>('#TimesListLocal')
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

	readonly state = {
		mapID: 0,
		gamemode: Gamemode.SURF,
		trackType: TrackType.MAIN,
		trackNum: 1,
		style: Style.NORMAL,
		filter: LeaderboardRecordsFilter.GLOBAL,
		page: 1,
		totalPages: 1
	};

	blockTextEntryEvent = false;
	totalCompletions: number = null;
	currentUserRank = null;
	groupBoundaries: Record<number, { group: CompletionGroup; page: number }>;

	constructor() {
		$.RegisterEventHandler('LeaderboardRecords_Loaded', this.panels.cp, (requestToken) =>
			this.updateLeaderboardsWithToken(requestToken)
		);

		// Note: Can't set radio button groups in the XML because it causes multiple leaderboard instances to interfere with eachother
		// TODO: Derive from ID
		const lbType = this.isInGameLeaderboard() ? 'TabMenu' : 'MapSelector';
		Object.entries(this.panels.radioButtons).forEach(([_, button]) => {
			button.group = lbType + 'Group';
		});

		this.panels.controls.pageSelect.SetPanelEvent('ontextentrychange', () => {
			if (this.blockTextEntryEvent) return;
			const text = this.panels.controls.pageSelect.text.trim();
			if (text === '') return;

			const parsed = +text;
			if (!Number.isNaN(parsed)) {
				this.selectPage(parsed);
			}
		});

		this.panels.stylesDropdown.visible = false;
	}

	setMapID(mapID: number) {
		this.state.mapID = mapID;
		this.state.page = 1;
		this.setTextEntry(this.state.page);
	}

	setTrack(trackType: TrackType, trackNum: number) {
		this.state.page = 1;
		this.setTextEntry(this.state.page);

		this.state.trackType = trackType;
		this.state.trackNum = trackNum;
		this.updateLeaderboards();
	}

	setGamemode(gamemode: Gamemode) {
		this.state.gamemode = gamemode;
	}

	setTotalCompletions(completions: number) {
		this.totalCompletions = completions;
	}

	setFilter(filter: LeaderboardRecordsFilter) {
		if (this.state.filter === filter) return;

		this.state.filter = filter;
		this.state.page = 1;
		this.setTextEntry(this.state.page);
		this.updateLeaderboards();
	}

	setCurrentUserRank(rank: number) {
		if (rank == null) {
			this.panels.around.enabled = false;
		} else {
			this.panels.around.enabled = true;
		}
		this.currentUserRank = rank;
	}

	showLobbyTooltip() {
		if (!this.panels.lobbyButton.enabled) {
			UiToolkitAPI.ShowTextTooltip(this.panels.lobbyButton.id, $.Localize('#Leaderboards_JoinLobbyTooltip'));
		}
	}

	// TODO: Why would this be here? Investigate later
	showEndOfRun() {
		$.DispatchEvent('EndOfRun_Show', EndOfRunShowReason.MANUALLY_SHOWN);
	}

	updateLeaderboards() {
		// When this request finishes it fires LeaderboardRecords_Loaded event
		// That event runs updateLeaderboardWithToken() using this data
		this.panels.cp.getLeaderboardRecords(
			this.state.mapID,
			this.state.gamemode,
			this.state.trackType,
			this.state.trackNum,
			this.state.style,
			this.state.filter,
			this.state.page - 1
		);
	}

	private updateLeaderboardsWithToken(requestToken: number) {
		const data = this.panels.cp.getLoadedLeaderboardRecords();
		if (data.requestToken !== requestToken) return; //superseded by a newer request;

		this.state.totalPages = data.totalPages;
		this.panels.controls.container.SetDialogVariableInt('total-pages', this.state.totalPages);

		this.groupBoundaries = this.getGroupBoundaries();

		this.panels.timesList.RemoveAndDeleteChildren();
		this.panels.groupPillsLayer.RemoveAndDeleteChildren();
		data.records.forEach((record, index) => {
			const lbEntry = $.CreatePanel('LeaderboardEntry', this.panels.timesList, '');
			if (index === 0) lbEntry.AddClass('leaderboard-entry--first');
			lbEntry.SetDialogVariableInt('rank', record.rank);
			lbEntry.SetDialogVariable('player', record.playerName);
			lbEntry.SetDialogVariableFloat('time', record.runTime);

			if (
				this.state.filter === LeaderboardRecordsFilter.FRIENDS ||
				this.state.filter === LeaderboardRecordsFilter.LOBBY
			) {
				this.createMembershipGroupIndicators(data.records, record.rank, lbEntry, index);
			} else if (this.state.filter === LeaderboardRecordsFilter.GLOBAL) {
				const matchedGroup: CompletionGroup | undefined = this.groupBoundaries[record.rank]?.group;
				this.createBoundaryGroupIndicators(matchedGroup, lbEntry, index);
			}

			const avatar = lbEntry.FindChildTraverse<AvatarImage>('LeaderboardEntryAvatarPanel');
			avatar.steamid = record.steamID;
		});
	}

	private createBoundaryGroupIndicators(matchedGroup: CompletionGroup, lbEntry: LeaderboardEntry, index: number) {
		if (matchedGroup !== undefined && matchedGroup !== CompletionGroup.WORLD_RECORD) {
			const groupName = CompletionGroup[matchedGroup];

			lbEntry.AddClass(`leaderboard-entry--group-${groupName}`);

			const borderY = (index + 1) * ENTRY_HEIGHT; // pixel Y of the border line

			const pill = $.CreatePanel('GroupPill', this.panels.groupPillsLayer, '', {
				class: 'group-pill group-pill--leaderboards-pill group-pill--solid'
			});
			pill.style.transform = `translate3d(${GROUP_BORDER_LEFT_ALIGN}px, ${borderY}px, 0px) translateY(${GROUP_BORDER_TOP_ALIGN}px)`;
			pill.handler.setGroup(matchedGroup);
		}
	}

	private createMembershipGroupIndicators(
		records: LeaderboardRecord[],
		rank: number,
		lbEntry: LeaderboardEntry,
		index: number
	) {
		const currentGroup = this.getGroupForRank(rank);
		if (currentGroup === undefined || currentGroup === CompletionGroup.WORLD_RECORD) return;

		const nextRecord = records[index + 1];

		if (nextRecord && this.getGroupForRank(nextRecord.rank) === currentGroup) {
			return;
		}

		const groupName = CompletionGroup[currentGroup];

		lbEntry.AddClass(`leaderboard-entry--group-${groupName}`);

		const borderY = (index + 1) * ENTRY_HEIGHT;

		const pill = $.CreatePanel('GroupPill', this.panels.groupPillsLayer, '', {
			class: 'group-pill group-pill--leaderboards-pill group-pill--solid'
		});

		pill.style.transform = `translate3d(${GROUP_BORDER_LEFT_ALIGN}px, ${borderY}px, 0px) translateY(${GROUP_BORDER_TOP_ALIGN}px)`;
		pill.handler.setGroup(currentGroup);
	}

	previousPage() {
		this.state.page = Math.max(this.state.page - 1, 1);
		this.setTextEntry(this.state.page);
		this.updateLeaderboards();
	}

	nextPage() {
		this.state.page = Math.min(this.state.page + 1, this.state.totalPages);
		this.setTextEntry(this.state.page);
		this.updateLeaderboards();
	}

	previousGroup() {
		if (!this.groupBoundaries) return;

		const currentPage = this.state.page;
		const boundaryPages = Object.values(this.groupBoundaries).map((b) => b.page);
		const pastPages = boundaryPages.filter((page) => page < currentPage);

		let targetPage: number;
		if (pastPages.length > 0) {
			targetPage = Math.max(...pastPages);
		} else {
			targetPage = 1;
		}

		this.selectPage(targetPage);
	}

	nextGroup() {
		if (!this.groupBoundaries) return;

		const currentPage = this.state.page;
		const boundaryPages = Object.values(this.groupBoundaries).map((b) => b.page);
		const futurePages = boundaryPages.filter((page) => page > currentPage);

		let targetPage: number;
		if (futurePages.length > 0) {
			targetPage = Math.min(...futurePages);
		} else {
			targetPage = this.state.totalPages;
		}

		this.selectPage(targetPage);
	}

	selectPage(page: number) {
		const clamped = Math.min(Math.max(1, page), this.state.totalPages);
		this.state.page = clamped;

		if (this.panels.controls.pageSelect.text !== `${clamped}`) {
			this.setTextEntry(clamped);
		}

		this.updateLeaderboards();
	}

	showAroundPage() {
		if (!this.currentUserRank) return;
		const newPage = Math.ceil(this.currentUserRank / RUNS_PER_PAGE);
		if (this.state.page !== newPage) {
			this.selectPage(newPage);
		}
	}

	private isInGameLeaderboard() {
		return this.panels.cp.id === 'TabMenuLeaderboards';
	}

	private setTextEntry(val: number) {
		this.blockTextEntryEvent = true;
		this.panels.controls.pageSelect.text = `${val}`;
		this.blockTextEntryEvent = false;
	}

	// TODO: TEMPORARY FOR TESTING
	private getGroupBoundaries(): Record<number, { group: CompletionGroup; page: number }> {
		// Helper to calculate group size based on the formula: max(SF * (totalCompletions^E), minSize)
		const calcSize = (sf: number, e: number, minSize: number): number => {
			const ax = sf * Math.pow(this.totalCompletions, e);
			return Math.max(ax, minSize);
		};

		// Helper to calculate 1-based page index assuming 20 items per page
		const calcPage = (rank: number): number => Math.ceil(rank / 20);

		// 1. Determine sizes for each bracket
		const wrSize = 1;
		const top10Size = 9; // Ranks 2 through 10

		const g1Size = Math.round(calcSize(1, 0.5, 10));
		const g2Size = Math.round(calcSize(1.5, 0.56, 45));
		const g3Size = Math.round(calcSize(2, 0.62, 125));
		const g4Size = Math.round(calcSize(2.5, 0.68, 250));

		// 2. Calculate the last rank of each group sequentially
		const wrLast = wrSize; // 1
		const top10Last = wrLast + top10Size; // 10
		const g1Last = top10Last + g1Size;
		const g2Last = g1Last + g2Size;
		const g3Last = g2Last + g3Size;
		const g4Last = g3Last + g4Size;

		// 3. Return as a direct key-value mapping with pages included
		return {
			[wrLast]: { group: CompletionGroup.WORLD_RECORD, page: calcPage(wrLast) },
			[top10Last]: { group: CompletionGroup.TOP_10, page: calcPage(top10Last) },
			[g1Last]: { group: CompletionGroup.GROUP_1, page: calcPage(g1Last) },
			[g2Last]: { group: CompletionGroup.GROUP_2, page: calcPage(g2Last) },
			[g3Last]: { group: CompletionGroup.GROUP_3, page: calcPage(g3Last) },
			[g4Last]: { group: CompletionGroup.GROUP_4, page: calcPage(g4Last) }
		};
	}

	private getGroupForRank(rank: number): CompletionGroup | undefined {
		for (const boundary in this.groupBoundaries) {
			if (rank <= Number(boundary)) {
				return this.groupBoundaries[boundary].group;
			}
		}

		return undefined;
	}
}
