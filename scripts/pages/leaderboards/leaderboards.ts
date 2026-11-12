import { exposeToPanelContext, PanelHandler } from 'util/module-helpers';
import {
	LeaderboardListType,
	// LeaderboardRecordsFilter,
	LeaderboardStatusType,
	LeaderboardType
	// sortLeaderboard
} from 'common/leaderboard';
import { TrackType } from 'common/web/enums/track-type.enum';
import { Style } from 'common/web/enums/style.enum';
import { LeaderboardRecordsFilter } from 'common/leaderboard';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { CompletionGroup } from 'common/web/enums/completion-group.enum';
import { LeaderboardRecord } from 'common/leaderboard';
import { getRankGroupEnds, getCompletionGroup } from 'common/web/consts/rank-groups.const';

// Keep in sync with entry.scss
const ENTRY_HEIGHT = 32;

// Keep in sync with the backend
const RUNS_PER_PAGE = 20;

// Offsets for the group pills
const GROUP_BORDER_LEFT_ALIGN = -10;
const GROUP_BORDER_TOP_ALIGN = -13;

// Show the loading spinner if the request takes longer than this in seconds
const LOADING_SPINNER_DELAY = 0.2;

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
		aroundTooltip: $<TooltipPanel>('#AroundTooltip'),
		around: $<Button>('#Around'),
		tools: $<Panel>('#LeaderboardTools'),
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
	groupEnds: number[];

	/** handles loading spinner for quick leaderboard requests */
	private loadingHandle: number = null;

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
			if (this.localOnly) this.updateLeaderboards();
		});

		$.RegisterForUnhandledEvent('EndOfRun_Result_RunUpload', () => {
			this.updateLeaderboards();
		});

		// The engine builds the lobby filter from the lobby's members at request time
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberStateChanged', () => {
			if (this.state.filter === LeaderboardRecordsFilter.LOBBY) this.updateLeaderboards();
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

		this.setToolsAvailable(false);
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

	updateLeaderboards() {
		// When this request finishes it fires LeaderboardRecords_Loaded event
		// That event runs updateLeaderboardWithToken() using this data
		this.beginLoading();

		this.pendingRequestToken = this.panels.cp.getLeaderboardRecords(
			this.state.mapID,
			this.state.gamemode,
			this.state.trackType,
			this.state.trackNum,
			this.state.style,
			this.state.filter,
			this.state.page - 1
		);
	}

	/**
	 * Drop the shown records while there's no track to request them for, e.g. while a newly
	 * selected map's tracks are still loading. Shows the spinner for TIMES_LOADING, else the empty
	 * state with the message for `status`.
	 */
	clearRecords(status: LeaderboardStatusType) {
		this.pendingRequestToken = null;
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
		if (data.requestToken !== requestToken) return; //superseded by a newer request;

		this.state.totalPages = Math.max(data.totalPages, 1);
		this.panels.controls.container.SetDialogVariableInt('total-pages', this.state.totalPages);

		this.groupEnds = getRankGroupEnds(this.totalCompletions);

		this.updateControlButtons();

		// The backend always includes local player's run in the friends filter response
		// If only one run was returned and the local player has a PB remove it from the timesList
		const isOwnRunOnly =
			this.state.filter === LeaderboardRecordsFilter.FRIENDS &&
			data.totalPages === 1 &&
			data.records.length === 1 &&
			this.currentUserRank != null;

		const records = isOwnRunOnly ? [] : data.records;

		this.panels.timesList.RemoveAndDeleteChildren();
		this.panels.groupPillsLayer.RemoveAndDeleteChildren();
		records.forEach((record, index) => {
			const lbEntry = $.CreatePanel('LeaderboardEntry', this.panels.timesList, '');
			if (index === 0) lbEntry.AddClass('leaderboard-entry--first');
			lbEntry.SetDialogVariableInt('rank', record.rank);
			lbEntry.SetDialogVariable('player', record.playerName);
			lbEntry.SetDialogVariableFloat('time', record.runTime);

			if (
				this.state.filter === LeaderboardRecordsFilter.FRIENDS ||
				this.state.filter === LeaderboardRecordsFilter.LOBBY
			) {
				this.createMembershipGroupIndicators(records, record.rank, lbEntry, index);
			} else if (this.state.filter === LeaderboardRecordsFilter.GLOBAL) {
				const group = getCompletionGroup(record.rank, this.groupEnds);
				const matchedGroup = group !== getCompletionGroup(record.rank + 1, this.groupEnds) ? group : undefined;
				this.createBoundaryGroupIndicators(matchedGroup, lbEntry, index);
			}

			const avatar = lbEntry.FindChildTraverse<AvatarImage>('LeaderboardEntryAvatarPanel');
			avatar.steamid = record.steamID;

			lbEntry.SetPanelEvent('oncontextmenu', () => this.showEntryContextMenu(index, record));

			if (this.currentUserRank === record.rank) {
				lbEntry.AddClass('leaderboard-entry--localplayer');
			}
		});

		this.updateEmptyState(records.length === 0, data.status);
	}

	private showEntryContextMenu(index: number, record: LeaderboardRecord) {
		const items: UiToolkitAPI.SimpleContextMenuItem[] = [
			{
				label: $.Localize('#Action_WatchReplay'),
				icon: 'file://{images}/movie-open-outline.svg',
				style: 'icon-color-mid-blue',
				jsCallback: () => this.panels.cp.playRecordReplay(index)
			},
			{
				label: $.Localize('#Action_SetComparisonRun'),
				icon: 'file://{images}/chart-timeline.svg',
				style: 'icon-color-light-blue',
				jsCallback: () => this.panels.cp.setRecordComparisonRun(index)
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
						() => this.deleteReplay(index),
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

	private createBoundaryGroupIndicators(matchedGroup: CompletionGroup, lbEntry: LeaderboardEntry, index: number) {
		if (matchedGroup === undefined || matchedGroup === CompletionGroup.WORLD_RECORD) return;

		const groupName = CompletionGroup[matchedGroup];
		lbEntry.AddClass(`leaderboard-entry--group-${groupName}`);

		const borderY = (index + 1) * ENTRY_HEIGHT; // pixel Y of the border line
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

		const pages = this.groupEnds.map((rank) => Math.ceil(rank / RUNS_PER_PAGE));

		return Array.from(new Set(pages)).sort((a, b) => a - b);
	}

	/** Disable page/group navigation buttons that wouldn't move anywhere from the current page. */
	private updateControlButtons() {
		const { pagePrev, pageNext, groupPrev, groupNext } = this.panels.controls;
		const { page, totalPages } = this.state;

		pagePrev.enabled = page > 1;
		pageNext.enabled = page < totalPages;

		groupPrev.enabled = this.getPreviousGroupPage() !== page;
		groupNext.enabled = this.getNextGroupPage() !== page;

		this.updateAroundButton();
	}

	/** Page holding the player's own run, or null if they have no run on this track. */
	private getPersonalBestPage(): number | null {
		return this.currentUserRank ? Math.ceil(this.currentUserRank / RUNS_PER_PAGE) : null;
	}

	private updateAroundButton() {
		const pbPage = this.getPersonalBestPage();
		const enabled =
			pbPage !== null && pbPage !== this.state.page && this.state.filter === LeaderboardRecordsFilter.GLOBAL;

		this.panels.around.enabled = enabled;

		// Toggle tooltip display on hover
		this.panels.aroundTooltip.hittest = enabled;
		this.panels.aroundTooltip.hittestchildren = enabled;
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

	private deleteReplay(index: number) {
		this.panels.cp.deleteRecordReplay(index);
		this.updateLeaderboards();
	}
}
