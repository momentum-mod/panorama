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
import { GroupBoundaries, getGroupBoundaries, getCompletionGroup } from 'common/completion-group';

// Keep in sync with entry.scss
const ENTRY_HEIGHT = 32;

// Keep in sync with the backend
const RUNS_PER_PAGE = 20;

// Offsets for the group pills
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
		around: $<Button>('#Around'),
		zoningOpenContainer: $<Panel>('#ZoningOpenContainer'),
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
	groupBoundaries: GroupBoundaries;

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

		this.setZoneEditorAvailable(false);
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

		this.state.totalPages = Math.max(data.totalPages, 1);
		this.panels.controls.container.SetDialogVariableInt('total-pages', this.state.totalPages);

		this.groupBoundaries = getGroupBoundaries(this.totalCompletions);

		this.updateControlButtons();

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
				const matchedGroup = this.groupBoundaries[record.rank];
				this.createBoundaryGroupIndicators(matchedGroup, lbEntry, index);
			}

			const avatar = lbEntry.FindChildTraverse<AvatarImage>('LeaderboardEntryAvatarPanel');
			avatar.steamid = record.steamID;

			lbEntry.SetPanelEvent('oncontextmenu', () => this.showEntryContextMenu(index, record));
		});
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
						() => this.panels.cp.deleteRecordReplay(index),
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
		const currentGroup = getCompletionGroup(rank, this.groupBoundaries);
		if (currentGroup === undefined || currentGroup === CompletionGroup.WORLD_RECORD) return;

		const nextRecord = records[index + 1];

		if (nextRecord && getCompletionGroup(nextRecord.rank, this.groupBoundaries) === currentGroup) {
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

		this.selectPage(this.getPreviousGroupPage());
	}

	nextGroup() {
		if (!this.groupBoundaries) return;

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
		if (!this.groupBoundaries) return [];

		const pages = Object.keys(this.groupBoundaries).map((rank) => Math.ceil(Number(rank) / 20));

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

	setZoneEditorAvailable(available: boolean) {
		this.panels.zoningOpenContainer.visible = available;
	}

	openZoneEditor() {
		GameInterfaceAPI.ConsoleCommand('mom_zoning_enable 1');
		$.DispatchEvent('HudTabMenu_ForceClose');
	}

	private setTextEntry(val: number) {
		this.blockTextEntryEvent = true;
		this.panels.controls.pageSelect.text = `${val}`;
		this.blockTextEntryEvent = false;
	}
}
