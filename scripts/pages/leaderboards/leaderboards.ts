import { exposeToPanelContext, PanelHandler } from 'util/module-helpers';
import { formatTimeAgoString } from 'util/dates';
import {
	LeaderboardListType,
	LeaderboardRecord,
	LeaderboardRecordsFilter,
	LeaderboardStatusType,
	type LoadedLeaderboardRecords,
	LeaderboardType,
	LEADERBOARD_RECORDS_PER_PAGE
} from 'common/leaderboard';
import { TrackType } from 'common/web/enums/track-type.enum';
import { Style } from 'common/web/enums/style.enum';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { CompletionGroup } from 'common/web/enums/completion-group.enum';
import { getRankGroupEnds, getCompletionGroup } from 'common/web/consts/rank-groups.const';

// Keep in sync with entry.scss
const ENTRY_HEIGHT = 32;
const PILL_VERTICAL_ADJUSTMENT = 2;

// Offsets for the group pills
const GROUP_BORDER_LEFT_ALIGN = -10;
const GROUP_BORDER_TOP_ALIGN = -13;

// Search tokens for the rank groups shown on the global leaderboard.
const SEARCH_GROUP_TAGS: Readonly<Record<string, CompletionGroup>> = {
	'@top10': CompletionGroup.TOP_10,
	'@g1': CompletionGroup.GROUP_1,
	'@g2': CompletionGroup.GROUP_2,
	'@g3': CompletionGroup.GROUP_3,
	'@g4': CompletionGroup.GROUP_4,
	'@g5': CompletionGroup.GROUP_5,
	'@g6': CompletionGroup.GROUP_6
};

// Show the loading spinner if the request takes longer than this in seconds
const LOADING_SPINNER_DELAY = 0.2;

// Wait for typing to pause before searching
const SEARCH_DEBOUNCE = 0.35;

// Each page is one backend request, so cap how many a single search may download
const SEARCH_MAX_PAGES = 50;

// How long downloaded pages can be reused by later searches, in milliseconds
const SEARCH_CACHE_LIFETIME = 60_000;

exposeToPanelContext({ LeaderboardListType, LeaderboardType, LeaderboardRecordsFilter });

interface SearchLeaderboardRecord {
	record: LeaderboardRecord;
	page: number;
	index: number;
}

interface LeaderboardRecordAction {
	page: number;
	record: LeaderboardRecord;
	type: 'watch' | 'compare' | 'delete';
}

@PanelHandler({ exposeToPanel: true })
export class LeaderboardsHandler {
	selectedTimesList: LeaderboardListType;
	selectedGlobalListType: LeaderboardType;
	selectedLocalListType: LeaderboardType;

	readonly panels = {
		cp: $.GetContextPanel<Leaderboards>(),
		timesList: $<Panel>('#TimesList'),
		lobbyButton: $<Button>('#TimesListLobby'),
		timesContainer: $<Panel>('#LeaderboardTimesContainer'),
		groupPillsLayer: $<Panel>('#GroupPillsLayer'),
		emptyWarningText: $<Label>('#LeaderboardEmptyWarningText'),
		syncTrackButton: $<Button>('#SyncTrackButton'),
		aroundTooltip: $<TooltipPanel>('#AroundTooltip'),
		around: $<Button>('#Around'),
		tools: $<Panel>('#LeaderboardTools'),
		radioButtons: {
			global: $<RadioButton>('#TimesListGlobal'),
			friends: $<RadioButton>('#TimesListFriends'),
			lobby: $<RadioButton>('#TimesListLobby'),
			local: $<RadioButton>('#TimesListLocal')
		},
		search: {
			textEntry: $<TextEntry>('#LeaderboardSearchTextEntry'),
			clearButton: $<Button>('#LeaderboardSearchClear')
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
	groupEnds: number[];
	private searchGroups: CompletionGroup[] = [];
	private searchText = '';
	private searchRank: number | null = null;
	private searchResults: SearchLeaderboardRecord[] = [];
	private searchScanning = false;
	/** Downloaded pages (0-based) of the leaderboard identified by {@link searchCacheKey}. */
	private readonly searchCache = new Map<number, LoadedLeaderboardRecords>();
	private searchCacheKey = '';
	private searchCacheTime = 0;
	/** The 0-based page asked for most recently. */
	private requestedPage = 0;
	/** Identifies the rows currently on screen, so they're only rebuilt when they change. */
	private renderedSearchRows: string | null = null;
	private loadedRecordsPage: number | null = null;
	private pendingRecordAction: LeaderboardRecordAction | null = null;

	/** handles loading spinner for quick leaderboard requests */
	private loadingHandle: number = null;
	/** Debounces search input so we don't request a page on every keystroke. */
	private searchHandle: number = null;

	/** The only records request whose result gets shown; null while none is wanted. */
	private pendingRequestToken: number | null = null;

	/** null until the first map is shown, so that the first {@link setLocalOnly} always applies. */
	localOnly: boolean | null = null;

	constructor() {
		$.RegisterEventHandler('LeaderboardRecords_Loaded', this.panels.cp, (requestToken) =>
			this.updateLeaderboardsWithToken(requestToken)
		);

		// Saved replays are read off disk asynchronously (CLeaderboards::AsyncGetLocalMapRuns), and
		// finish loading after we've already requested the page on map load. The engine signals that
		// via Leaderboards_LocalRunsLoaded -- it never re-fires LeaderboardRecords_Loaded -- so
		// re-request the page ourselves when it fires while local-only.
		$.RegisterEventHandler('Leaderboards_LocalRunsLoaded', this.panels.cp, () => {
			if (this.localOnly) this.reloadLeaderboards();
		});

		$.RegisterForUnhandledEvent('EndOfRun_Result_RunUpload', () => {
			this.reloadLeaderboards();
		});

		// The engine builds the lobby filter from the lobby's members at request time
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberStateChanged', () => {
			if (this.state.filter === LeaderboardRecordsFilter.LOBBY) this.reloadLeaderboards();
		});

		$.RegisterForUnhandledEvent('SteamLobby_Exit', () => {
			if (this.state.filter !== LeaderboardRecordsFilter.LOBBY) return;

			this.panels.radioButtons.global.SetSelected(true);
			this.setFilter(LeaderboardRecordsFilter.GLOBAL);
		});

		// Note: Can't set radio button groups in the XML because it causes multiple leaderboard instances to interfere with eachother
		Object.entries(this.panels.radioButtons).forEach(([_, button]) => {
			button.group = this.panels.cp.id + 'Group';
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
		this.panels.search.textEntry.SetPanelEvent('ontextentrychange', () => this.onSearchTextChanged());

		this.setToolsAvailable(false);
		this.panels.cp.SetDialogVariable('search-progress', '');
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

	setStyle(style: Style) {
		if (this.state.style === style) return;

		this.state.style = style;
		this.state.page = 1;
		this.setTextEntry(this.state.page);
		this.updateLeaderboards();
	}

	setTotalCompletions(completions: number) {
		this.totalCompletions = completions;
		this.groupEnds = getRankGroupEnds(completions);
	}

	setFilter(filter: LeaderboardRecordsFilter) {
		if (this.state.filter === filter) return;

		this.state.filter = filter;
		this.state.page = 1;
		this.setTextEntry(this.state.page);
		this.updateLeaderboards();
	}

	/**
	 * Restrict the leaderboard to locally saved replays, for maps with no online data. The other
	 * categories are all served by the backend, which knows nothing about such a map, so they're
	 * disabled rather than left to come back empty.
	 *
	 * Lobby is left to the engine (CLeaderboards tracks lobby membership and toggles it itself), and
	 * it re-runs on every SetMap so it'll be right for the map we're on either way -- so we only
	 * force it off when going local-only, and never force it back on.
	 */
	setLocalOnly(localOnly: boolean) {
		if (this.localOnly === localOnly) return;
		this.localOnly = localOnly;

		const { global, friends, lobby, local } = this.panels.radioButtons;
		global.enabled = !localOnly;
		friends.enabled = !localOnly;

		if (localOnly) {
			lobby.enabled = false;
			local.SetSelected(true);
			this.setFilter(LeaderboardRecordsFilter.SAVED_REPLAYS);
		} else {
			global.SetSelected(true);
			this.setFilter(LeaderboardRecordsFilter.GLOBAL);
		}
	}

	setCurrentUserRank(rank: number) {
		this.currentUserRank = rank;
		this.updateAroundButton();
	}

	showLobbyTooltip() {
		if (!this.panels.lobbyButton.enabled) {
			UiToolkitAPI.ShowTextTooltip(this.panels.lobbyButton.id, $.Localize('#Leaderboards_JoinLobbyTooltip'));
		}
	}
	private updateEmptyState(isEmpty: boolean, status = LeaderboardStatusType.NO_TIMES_RETURNED) {
		this.cancelLoadingSchedule();

		this.panels.timesContainer.RemoveClass('leaderboard-times--loading');
		this.panels.timesContainer.SetHasClass('leaderboard-times--empty', isEmpty);
		if (isEmpty) {
			this.panels.cp.SetDialogVariable('empty-warning', $.Localize(this.getEmptyWarningText(status)));
		}
	}

	private getEmptyWarningText(status: LeaderboardStatusType) {
		switch (status) {
			case LeaderboardStatusType.SERVER_ERROR:
				return '#Leaderboards_Error_ServerError';
			case LeaderboardStatusType.NO_FRIENDS:
				return '#Leaderboards_Error_NoFriends';
			case LeaderboardStatusType.UNAUTHORIZED_FRIENDS_LIST:
				return '#Leaderboards_Error_FriendsPrivate';
			case LeaderboardStatusType.NO_PB_SET:
				return '#Leaderboards_Error_NoPB';
		}

		if (this.isSearchActive()) return '#Leaderboards_Error_NoSearchResults';

		switch (this.state.filter) {
			case LeaderboardRecordsFilter.GLOBAL:
				return '#Leaderboards_Error_NoCompletions';
			case LeaderboardRecordsFilter.FRIENDS:
				return '#Leaderboards_Error_NoFriendTimes';
			case LeaderboardRecordsFilter.LOBBY:
				return '#Leaderboards_Error_NoLobbyTimes';
			case LeaderboardRecordsFilter.SAVED_REPLAYS:
				return '#Leaderboards_Error_NoLocalReplays';
		}
	}

	private beginLoading() {
		this.panels.timesContainer.RemoveClass('leaderboard-times--empty');
		this.cancelLoadingSchedule();
		this.loadingHandle = $.Schedule(LOADING_SPINNER_DELAY, () => {
			this.loadingHandle = null; // fired naturally, nothing left to cancel
			this.panels.timesContainer.AddClass('leaderboard-times--loading');
		});
	}

	private cancelLoadingSchedule() {
		if (this.loadingHandle !== null) {
			$.CancelScheduled(this.loadingHandle);
			this.loadingHandle = null;
		}
	}

	/** Show the leaderboard again after its data changed, without reusing downloaded pages. */
	private reloadLeaderboards() {
		this.searchCache.clear();
		this.updateLeaderboards();
	}

	updateLeaderboards() {
		this.pendingRecordAction = null;

		if (this.isSearchActive()) {
			this.startSearch();
			return;
		}

		this.searchScanning = false;
		this.searchResults = [];
		this.panels.cp.SetDialogVariable('search-progress', '');
		this.beginLoading();
		this.requestLeaderboardPage(this.state.page - 1);
	}

	private requestLeaderboardPage(page: number) {
		this.requestedPage = page;
		this.loadedRecordsPage = null;
		this.pendingRequestToken = this.panels.cp.getLeaderboardRecords(
			this.state.mapID,
			this.state.gamemode,
			this.state.trackType,
			this.state.trackNum,
			this.state.style,
			this.state.filter,
			page
		);
	}

	private isSearchActive(): boolean {
		return this.searchText.length > 0 || this.searchGroups.length > 0 || this.searchRank !== null;
	}

	private startSearch() {
		const { mapID, gamemode, trackType, trackNum, style, filter } = this.state;
		const key = [mapID, gamemode, trackType, trackNum, style, filter].join();
		if (key !== this.searchCacheKey || Date.now() - this.searchCacheTime > SEARCH_CACHE_LIFETIME) {
			this.searchCache.clear();
			this.searchCacheKey = key;
		}

		if (this.searchCache.size === 0) this.searchCacheTime = Date.now();

		this.groupEnds = getRankGroupEnds(this.totalCompletions);
		this.searchScanning = true;
		this.renderedSearchRows = null;
		this.pendingRequestToken = null;
		this.beginLoading();
		this.continueSearch();
	}

	/** Show the matches found so far, then request the next page that hasn't been downloaded. */
	private continueSearch() {
		// On the global leaderboard a rank tells us which page it's on, so only that one is needed
		const rankPage =
			this.searchRank !== null && this.state.filter === LeaderboardRecordsFilter.GLOBAL
				? Math.floor((this.searchRank - 1) / LEADERBOARD_RECORDS_PER_PAGE)
				: null;

		let pages: number[];
		if (rankPage !== null) {
			pages = [rankPage];
		} else {
			const first = this.searchCache.get(0);
			if (!first) {
				this.requestLeaderboardPage(0);
				return;
			}

			const totalPages = Math.max(first.totalPages, 1);
			pages =
				this.getSearchPages(totalPages)?.map((page) => page - 1) ??
				Array.from({ length: totalPages }, (_, index) => index);
		}

		const wanted = pages.slice(0, SEARCH_MAX_PAGES);
		const nextPage = wanted.find((page) => !this.searchCache.has(page));
		const searched = wanted.filter((page) => this.searchCache.has(page));

		this.searchResults = [];
		for (const page of searched) {
			const data = this.searchCache.get(page);

			// The backend includes the local player's run in the friends filter even when it's the only one
			const isOwnRunOnly =
				this.state.filter === LeaderboardRecordsFilter.FRIENDS &&
				data.totalPages === 1 &&
				data.records.length === 1 &&
				this.currentUserRank != null;
			if (isOwnRunOnly) continue;

			for (const [index, record] of data.records.entries()) {
				if (this.matchesSearch(record)) this.searchResults.push({ record, page, index });
			}
		}

		this.searchScanning = nextPage !== undefined;

		// Show how far we got while searching, and afterwards too if the cap cut the search short
		const incomplete = this.searchScanning || pages.length > wanted.length;
		this.panels.cp.SetDialogVariable('search-progress', incomplete ? `${searched.length} / ${pages.length}` : '');

		this.updateSearchPaging();
		if (this.searchResults.length > 0 || !this.searchScanning) {
			this.renderSearchResults(this.searchCache.get(searched[0])?.status);
		}

		if (this.searchScanning) this.requestLeaderboardPage(nextPage);
	}

	private updateSearchPaging() {
		this.state.totalPages = Math.max(1, Math.ceil(this.searchResults.length / LEADERBOARD_RECORDS_PER_PAGE));
		if (this.state.page > this.state.totalPages) {
			this.state.page = this.state.totalPages;
			this.setTextEntry(this.state.page);
		}

		this.updateControlButtons();
	}

	private renderSearchResults(status = LeaderboardStatusType.NO_TIMES_RETURNED) {
		const start = (this.state.page - 1) * LEADERBOARD_RECORDS_PER_PAGE;
		const rows = this.searchResults.slice(start, start + LEADERBOARD_RECORDS_PER_PAGE);

		const rowsKey = rows.map(({ page, index }) => `${page}:${index}`).join();
		if (rowsKey === this.renderedSearchRows) return;
		this.renderedSearchRows = rowsKey;

		this.renderLeaderboardRecords(rows, status);
	}

	/**
	 * Drop the shown records while there's no track to request them for, e.g. while a newly
	 * selected map's tracks are still loading. Shows the spinner for TIMES_LOADING, else the empty
	 * state with the message for `status`.
	 */
	clearRecords(status: LeaderboardStatusType) {
		this.pendingRequestToken = null;
		this.searchScanning = false;
		this.searchCache.clear();
		this.panels.cp.SetDialogVariable('search-progress', '');
		this.pendingRecordAction = null;
		this.loadedRecordsPage = null;
		this.panels.timesList.RemoveAndDeleteChildren();
		this.panels.groupPillsLayer.RemoveAndDeleteChildren();

		if (status === LeaderboardStatusType.TIMES_LOADING) {
			this.beginLoading();
		} else {
			this.updateEmptyState(true, status);
		}
	}

	private updateLeaderboardsWithToken(requestToken: number) {
		if (requestToken !== this.pendingRequestToken) return; // superseded or cleared
		const data = this.panels.cp.getLoadedLeaderboardRecords();
		if (data.requestToken !== requestToken) return; // superseded by a newer request

		this.loadedRecordsPage = data.page;

		if (this.pendingRecordAction) {
			const action = this.pendingRecordAction;
			this.pendingRecordAction = null;

			if (data.page === action.page) this.performRecordAction(action);
			if (this.searchScanning) this.continueSearch();
			return;
		}

		if (this.searchScanning) {
			const failed =
				data.status === LeaderboardStatusType.SERVER_ERROR ||
				data.status === LeaderboardStatusType.TIMES_LOADING;

			if (failed) {
				// Keep whatever was already found, and don't hammer a struggling backend
				this.searchScanning = false;
				this.updateControlButtons();
				if (this.searchResults.length === 0) this.updateEmptyState(true, data.status);
				return;
			}

			// Keyed by what was asked for: an out of range rank can be answered with a different page
			this.searchCache.set(this.requestedPage, data);
			this.continueSearch();
			return;
		}

		this.state.totalPages = Math.max(data.totalPages, 1);
		this.groupEnds = getRankGroupEnds(this.totalCompletions);
		this.updateControlButtons();

		// The backend always includes the local player's run in the friends filter response.
		const isOwnRunOnly =
			this.state.filter === LeaderboardRecordsFilter.FRIENDS &&
			data.totalPages === 1 &&
			data.records.length === 1 &&
			this.currentUserRank != null;

		const records = data.records.map((record, index) => ({ record, page: data.page, index }));
		this.renderLeaderboardRecords(isOwnRunOnly ? [] : records, data.status);
	}

	private renderLeaderboardRecords(records: SearchLeaderboardRecord[], status: LeaderboardStatusType) {
		this.panels.timesList.RemoveAndDeleteChildren();
		this.panels.groupPillsLayer.RemoveAndDeleteChildren();

		const pageRecords = records.map((entry) => entry.record);
		records.forEach((entry, index) => {
			const { record, page } = entry;
			const lbEntry = $.CreatePanel('LeaderboardEntry', this.panels.timesList, '');
			if (index === 0) {
				lbEntry.AddClass('leaderboard-entry--first');
			}
			if (records.length < LEADERBOARD_RECORDS_PER_PAGE && index === records.length - 1) {
				lbEntry.AddClass('leaderboard-entry--short-page-end');
			}
			lbEntry.SetDialogVariableInt('rank', record.rank);
			lbEntry.SetDialogVariable('player', record.playerName);
			lbEntry.SetDialogVariableFloat('time', record.runTime);
			lbEntry.SetDialogVariable('date', formatTimeAgoString(Number(record.date)));

			if (
				this.state.filter === LeaderboardRecordsFilter.FRIENDS ||
				this.state.filter === LeaderboardRecordsFilter.LOBBY
			) {
				this.createMembershipGroupIndicators(pageRecords, record.rank, lbEntry, index);
			} else if (this.state.filter === LeaderboardRecordsFilter.GLOBAL) {
				const group = getCompletionGroup(record.rank, this.groupEnds);
				const matchedGroup = group !== getCompletionGroup(record.rank + 1, this.groupEnds) ? group : undefined;

				if (!this.isSearchActive()) {
					this.createBoundaryGroupIndicators(matchedGroup, lbEntry, index);
				}
			}

			const avatar = lbEntry.FindChildTraverse<AvatarImage>('LeaderboardEntryAvatarPanel');
			avatar.steamid = record.steamID;

			lbEntry.SetPanelEvent('oncontextmenu', () => this.showEntryContextMenu(page, record));

			if (this.currentUserRank === record.rank) {
				lbEntry.AddClass('leaderboard-entry--localplayer');
			}
		});

		this.updateEmptyState(records.length === 0, status);
	}

	private showEntryContextMenu(page: number, record: LeaderboardRecord) {
		const items: UiToolkitAPI.SimpleContextMenuItem[] = [
			{
				label: $.Localize('#Action_WatchReplay'),
				icon: 'file://{images}/movie-open-outline.svg',
				style: 'icon-color-mid-blue',
				jsCallback: () => this.runRecordAction(page, record, 'watch')
			},
			{
				label: $.Localize('#Action_SetComparisonRun'),
				icon: 'file://{images}/chart-timeline.svg',
				style: 'icon-color-light-blue',
				jsCallback: () => this.runRecordAction(page, record, 'compare')
			}
		];

		// Only saved replays live on disk and can be deleted.
		if (this.state.filter === LeaderboardRecordsFilter.SAVED_REPLAYS) {
			items.push({
				label: $.Localize('#Action_DeleteReplay'),
				icon: 'file://{images}/delete.svg',
				style: 'icon-color-red',
				jsCallback: () =>
					UiToolkitAPI.ShowGenericPopupOkCancel(
						$.Localize('#Action_DeleteReplay'),
						$.Localize('#Action_DeleteReplay_Confirm'),
						'ok-cancel-popup',
						() => this.runRecordAction(page, record, 'delete'),
						() => {}
					)
			});
		}

		items.push({
			label: $.Localize('#Action_ShowSteamProfile'),
			icon: 'file://{images}/social/steam.svg',
			style: 'icon-color-steam-online',
			jsCallback: () => SteamOverlayAPI.OpenToProfileID(record.steamID)
		});

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}

	private runRecordAction(page: number, record: LeaderboardRecord, type: LeaderboardRecordAction['type']) {
		const action = { page, record, type };
		if (this.loadedRecordsPage === page) {
			this.performRecordAction(action);
			return;
		}

		// The game only acts on the page it loaded last, so load this record's page first
		this.pendingRecordAction = action;
		this.requestLeaderboardPage(page);
	}

	private performRecordAction({ record, type }: LeaderboardRecordAction) {
		// Look the record up again, since its position may have changed since it was downloaded
		const index = this.panels.cp
			.getLoadedLeaderboardRecords()
			.records.findIndex(
				(other) =>
					other.steamID === record.steamID && other.runTime === record.runTime && other.date === record.date
			);
		if (index === -1) {
			this.reloadLeaderboards();
			return;
		}

		switch (type) {
			case 'watch':
				this.panels.cp.playRecordReplay(index);
				break;
			case 'compare':
				this.panels.cp.setRecordComparisonRun(index);
				break;
			case 'delete':
				this.panels.cp.deleteRecordReplay(index);
				this.reloadLeaderboards();
				break;
		}
	}

	private createBoundaryGroupIndicators(matchedGroup: CompletionGroup, lbEntry: LeaderboardEntry, index: number) {
		if (matchedGroup === undefined || matchedGroup === CompletionGroup.WORLD_RECORD) return;

		const groupName = CompletionGroup[matchedGroup];
		lbEntry.AddClass(`leaderboard-entry--group-${groupName}`);

		const borderY = (index + 1) * ENTRY_HEIGHT + PILL_VERTICAL_ADJUSTMENT; // pixel Y of the border line
		const pill = $.CreatePanel('GroupPill', this.panels.groupPillsLayer, '', {
			class: 'group-pill group-pill--leaderboards-pill group-pill--solid'
		});
		pill.style.transform = `translate3d(${GROUP_BORDER_LEFT_ALIGN}px, ${borderY}px, 0px) translateY(${GROUP_BORDER_TOP_ALIGN}px)`;
		pill.handler.setGroup(matchedGroup);
	}

	private createMembershipGroupIndicators(
		records: LeaderboardRecord[],
		rank: number,
		lbEntry: LeaderboardEntry,
		index: number
	) {
		const currentGroup = getCompletionGroup(rank, this.groupEnds);
		if (currentGroup == null || currentGroup === CompletionGroup.WORLD_RECORD) return;

		const nextRecord = records[index + 1];

		if (nextRecord && getCompletionGroup(nextRecord.rank, this.groupEnds) === currentGroup) {
			return;
		}

		const groupName = CompletionGroup[currentGroup];

		lbEntry.AddClass(`leaderboard-entry--group-${groupName}`);

		const borderY = (index + 1) * ENTRY_HEIGHT + PILL_VERTICAL_ADJUSTMENT;

		const pill = $.CreatePanel('GroupPill', this.panels.groupPillsLayer, '', {
			class: 'group-pill group-pill--leaderboards-pill group-pill--solid'
		});

		pill.style.transform = `translate3d(${GROUP_BORDER_LEFT_ALIGN}px, ${borderY}px, 0px) translateY(${GROUP_BORDER_TOP_ALIGN}px)`;
		pill.handler.setGroup(currentGroup);
	}

	private onSearchTextChanged() {
		const query = this.panels.search.textEntry.text.trim();
		const groups = new Set<CompletionGroup>();
		const terms: string[] = [];
		let rank: number | null = null;

		for (const token of query.split(/\s+/).filter(Boolean)) {
			const group = SEARCH_GROUP_TAGS[token.toLowerCase()];
			if (group !== undefined) groups.add(group);
			else if (/^#[1-9]\d*$/.test(token)) rank = +token.slice(1);
			// A lone "#" or "@g" is a tag still being typed, not a name to search for
			else if (!/^(#|@(t|to|top|top1|g)?)$/i.test(token)) terms.push(token);
		}

		this.searchGroups = Array.from(groups);
		this.searchText = terms.join(' ').toLowerCase();
		this.searchRank = rank;
		this.panels.search.clearButton.SetHasClass('search__clearbutton--hidden', query.length === 0);

		if (this.searchHandle !== null) $.CancelScheduled(this.searchHandle);
		this.searchHandle = $.Schedule(SEARCH_DEBOUNCE, () => {
			this.searchHandle = null;
			this.state.page = 1;
			this.setTextEntry(this.state.page);
			this.updateLeaderboards();
		});
	}

	clearSearch() {
		this.panels.search.textEntry.text = '';
	}

	/** Return the rank intervals selected by @top10 and @g1-@g6. */
	private getSearchGroupRanges(): Array<{ startRank: number; endRank: number }> {
		const ranges: Array<{ startRank: number; endRank: number }> = [];

		if (this.searchGroups.includes(CompletionGroup.TOP_10)) {
			ranges.push({ startRank: 1, endRank: 10 });
		}

		if (!this.groupEnds) return ranges;

		const numberedGroups = [
			CompletionGroup.GROUP_1,
			CompletionGroup.GROUP_2,
			CompletionGroup.GROUP_3,
			CompletionGroup.GROUP_4,
			CompletionGroup.GROUP_5,
			CompletionGroup.GROUP_6
		];

		for (const [index, group] of numberedGroups.entries()) {
			if (!this.searchGroups.includes(group)) continue;

			const previousEnd = index === 0 ? 10 : (this.groupEnds[index - 1] ?? 10);
			const startRank = previousEnd + 1;
			const endRank = this.groupEnds[index] ?? 0;
			if (endRank >= startRank) ranges.push({ startRank, endRank });
		}

		return ranges;
	}

	/** Pages containing the selected groups; null means all backend pages. */
	private getSearchPages(totalPages = this.state.totalPages): number[] | null {
		if (this.searchGroups.length === 0 || this.state.filter !== LeaderboardRecordsFilter.GLOBAL) return null;
		if (this.searchGroups.some((group) => group !== CompletionGroup.TOP_10) && !this.groupEnds) return null;

		const pages = new Set<number>();
		for (const range of this.getSearchGroupRanges()) {
			const firstPage = Math.ceil(range.startRank / LEADERBOARD_RECORDS_PER_PAGE);
			const lastPage = Math.min(Math.ceil(range.endRank / LEADERBOARD_RECORDS_PER_PAGE), totalPages);
			for (let page = firstPage; page <= lastPage; page++) pages.add(page);
		}

		return Array.from(pages).sort((a, b) => a - b);
	}

	private matchesSearch(record: LeaderboardRecord): boolean {
		if (this.searchRank !== null && record.rank !== this.searchRank) return false;
		if (this.searchText && !record.playerName.toLowerCase().includes(this.searchText)) return false;
		if (this.searchGroups.length === 0 || this.state.filter !== LeaderboardRecordsFilter.GLOBAL) return true;

		const group = getCompletionGroup(record.rank, this.groupEnds);
		return this.searchGroups.some((selectedGroup) =>
			selectedGroup === CompletionGroup.TOP_10 ? record.rank <= 10 : group === selectedGroup
		);
	}

	previousPage() {
		if (this.isSearchActive()) {
			this.selectPage(this.state.page - 1);
			return;
		}

		this.state.page = Math.max(this.state.page - 1, 1);
		this.setTextEntry(this.state.page);
		this.updateLeaderboards();
	}

	nextPage() {
		if (this.isSearchActive()) {
			this.selectPage(this.state.page + 1);
			return;
		}

		this.state.page = Math.min(this.state.page + 1, this.state.totalPages);
		this.setTextEntry(this.state.page);
		this.updateLeaderboards();
	}

	previousGroup() {
		if (!this.groupEnds) return;

		this.selectPage(this.getPreviousGroupPage());
	}

	nextGroup() {
		if (!this.groupEnds) return;

		this.selectPage(this.getNextGroupPage());
	}

	/** Page the "previous group" button would jump to, or the current page if there's none. */
	private getPreviousGroupPage(): number {
		const pastPages = this.getBoundaryPages().filter((page) => page < this.state.page);

		return pastPages.length > 0 ? Math.max(...pastPages) : 1;
	}

	/** Page the "next group" button would jump to, or the current page if there's none. */
	private getNextGroupPage(): number {
		// Group boundaries are derived from total completions and routinely fall beyond the last
		// page of records (the min group sizes are large), so ignore any that aren't reachable.
		const futurePages = this.getBoundaryPages().filter(
			(page) => page > this.state.page && page <= this.state.totalPages
		);

		return futurePages.length > 0 ? Math.min(...futurePages) : this.state.totalPages;
	}

	private getBoundaryPages(): number[] {
		if (!this.groupEnds) return [];

		const pages = this.groupEnds.map((rank) => Math.ceil(rank / LEADERBOARD_RECORDS_PER_PAGE));

		return Array.from(new Set(pages)).sort((a, b) => a - b);
	}

	/** Disable page/group navigation buttons that wouldn't move anywhere from the current page. */
	private updateControlButtons() {
		const { container, pagePrev, pageNext, groupPrev, groupNext, pageSelect } = this.panels.controls;
		const { page, totalPages } = this.state;

		if (this.isSearchActive()) {
			pagePrev.enabled = page > 1;
			pageNext.enabled = page < totalPages;
			groupPrev.enabled = false;
			groupNext.enabled = false;
			pageSelect.enabled = true;
		} else {
			pagePrev.enabled = page > 1;
			pageNext.enabled = page < totalPages;
			groupPrev.enabled = this.getPreviousGroupPage() !== page;
			groupNext.enabled = this.getNextGroupPage() !== page;
			pageSelect.enabled = true;
		}

		container.SetDialogVariableInt('total-pages', totalPages);
		this.updateAroundButton();
	}

	/** Page holding the player's own run, or null if they have no run on this track. */
	private getPersonalBestPage(): number | null {
		return this.currentUserRank ? Math.ceil(this.currentUserRank / LEADERBOARD_RECORDS_PER_PAGE) : null;
	}

	private updateAroundButton() {
		const pbPage = this.getPersonalBestPage();
		const enabled =
			pbPage !== null &&
			pbPage !== this.state.page &&
			this.state.filter === LeaderboardRecordsFilter.GLOBAL &&
			!this.isSearchActive();

		this.panels.around.enabled = enabled;

		// Toggle tooltip display on hover
		this.panels.aroundTooltip.hittest = enabled;
		this.panels.aroundTooltip.hittestchildren = enabled;
	}

	selectPage(page: number) {
		const clamped = Math.min(Math.max(1, page), this.state.totalPages);
		this.state.page = clamped;
		this.setTextEntry(clamped);

		if (this.isSearchActive()) {
			this.updateControlButtons();
			this.renderSearchResults();
			return;
		}

		this.updateLeaderboards();
	}

	showAroundPage() {
		if (this.isSearchActive()) return;

		const pbPage = this.getPersonalBestPage();
		if (pbPage === null || pbPage === this.state.page) return;

		this.selectPage(pbPage);
	}

	setToolsAvailable(available: boolean) {
		this.panels.tools.visible = available;
	}

	openZoneEditor() {
		GameInterfaceAPI.ConsoleCommand('mom_zoning_enable 1');
		$.DispatchEvent('HudTabMenu_ForceClose');
	}

	openHudCustomizer() {
		GameInterfaceAPI.ConsoleCommand('mom_hudcustomizer_enable 1');
		$.DispatchEvent('HudTabMenu_ForceClose');
	}

	private setTextEntry(val: number) {
		this.blockTextEntryEvent = true;
		this.panels.controls.pageSelect.text = `${val}`;
		this.blockTextEntryEvent = false;
	}
}
