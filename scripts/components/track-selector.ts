import { PanelHandler } from 'util/module-helpers';
import { TrackType } from 'common/web/enums/track-type.enum';
import { Style } from 'common/web/enums/style.enum';
import { MapUserCompletions } from 'common/maps';
import { CompletionGroup } from 'common/web/enums/completion-group.enum';
import { getCompletionGroup, getGroupBoundaries } from 'common/completion-group';

/**
 * A track to render, whatever its source. Online maps source these from the map's completions;
 * maps without online data source them from the loaded map's zones, and so have no tier/time/rank.
 */
interface TrackEntry {
	trackType: TrackType;
	trackNum: number;
	tier?: number;
	time?: number;
	rank?: number;
	totalCompletions?: number;
}

interface TrackDisplayData {
	track: string;
	tier?: number;
	time?: number;
	rank?: number;
	total?: number;
	group?: number;
}

/**
 * The tracks defined by the loaded map's active zones, used for maps that have no online data.
 * Always includes the main track, so a map with no zones at all still gets an entry.
 */
function getActiveZoneTracks(): TrackEntry[] {
	const tracks: TrackEntry[] = [{ trackType: TrackType.MAIN, trackNum: 1 }];

	const zones = MomentumTimerAPI.GetActiveZoneDefs();
	if (!zones) return tracks;

	// A single segment is a linear track, which has no stages to pick between.
	const segments = zones.tracks?.main?.zones?.segments ?? [];
	if (segments.length > 1) {
		segments.forEach((_, index) => tracks.push({ trackType: TrackType.STAGE, trackNum: index + 1 }));
	}

	(zones.tracks?.bonuses ?? []).forEach((_, index) =>
		tracks.push({ trackType: TrackType.BONUS, trackNum: index + 1 })
	);

	return tracks;
}

@PanelHandler({ exposeToPanel: true })
export class TrackSelectorHandler {
	readonly panels = {
		cp: $.GetContextPanel<TrackSelector>(),
		container: $<Panel>('#TrackSelectorContainer')
	};

	leaderboards: Leaderboards | null = null;
	styleSelector: StyleSelector | null = null;
	endOfRun: EndOfRun | null = null;
	currentMapData: MapCacheAPI.StaticData;
	endOfRunCallback: (style: Style, trackType: TrackType, trackNum: number) => void;

	// Existing track panels keyed by track, reused across renders. The track set is the same across
	// styles, so a style switch updates these in place rather than tearing them down and rebuilding,
	// which flickers. renderedSignature is the key list of what's currently rendered; renderedMapID is
	// the online map it's for (0 for the offline/local table), used to hold the tracks through a
	// same-map style switch while its completions are still being fetched.
	private trackPanels = new Map<string, RadioButton>();
	private renderedSignature: string | null = null;
	private renderedMapID = 0;

	// The user's picked track, kept across re-renders so a style switch doesn't snap back to main.
	// Reset (via onMapContext) when the shown map changes, so a new map starts on main.
	private selectedTrackKey: string | null = null;
	private currentMapKey: string | null = null;

	private showActionButtons = true;

	// TODO: Blur broken when scrolling / Fixed in panzer's pr
	blurPanel: BaseBlurTarget | null = null;

	setBlurPanel(panel: BaseBlurTarget) {
		this.blurPanel = panel;
	}

	connectLeaderboards(leaderboards: Leaderboards) {
		this.leaderboards = leaderboards;
	}

	setPlayButtonVisible(visible: boolean) {
		this.showActionButtons = visible;
	}

	connectStyleSelector(styleSelector: StyleSelector) {
		this.styleSelector = styleSelector;
	}

	connectEndOfRun(endOfRun: EndOfRun) {
		this.endOfRun = endOfRun;
	}

	updateMapData(data: MapCacheAPI.StaticData) {
		this.currentMapData = data;
	}

	updateTrackData(completions: MapUserCompletions) {
		if (!this.leaderboards || !completions) return;

		this.leaderboards.handler.setMapID(completions.mapID);
		this.leaderboards.handler.setGamemode(completions.gamemode);
		this.leaderboards.handler.setLocalOnly(false);

		this.onMapContext(`online:${completions.mapID}`);

		// `tracks` can be absent: an empty CUtlVector serializes to JSON without the key. This happens
		// before a (gamemode, style) has been fetched -- GetCompletions has no cached entry and returns
		// nothing (see BuildCompletions). A style switch hits this for the newly picked style, so
		// skipping the empty render (rather than wiping the identical track set we already show for this
		// map) avoids a flicker; the refreshed data arrives via MapCache_CompletionsUpdate and fills the
		// existing rows in place. Only skip within the same map, so selecting a different map still
		// clears the previous one's tracks instead of showing them stale.
		const tracks = completions.tracks ?? [];
		if (tracks.length === 0 && completions.mapID !== 0 && completions.mapID === this.renderedMapID) {
			return;
		}

		this.renderedMapID = completions.mapID;
		this.renderTracks(tracks);
	}

	/**
	 * Populate the selector for a map with no online data, typically an offline map. Tracks come
	 * from the loaded map's zones, falling back to just the main track when it has none. Only
	 * locally saved replays exist for such a map, so the leaderboard is restricted to those, and
	 * each track's PB time comes from the local user's own saved replays for the given style.
	 */
	updateLocalTrackData(style: Style) {
		if (!this.leaderboards) return;

		const gamemode = GameModeAPI.GetCurrentGameMode();

		// There's no map ID to give. CLeaderboards::GetLeaderboardRecords doesn't read one for
		// SAVED_REPLAYS -- it serves those from the runs it loaded off disk for the current map --
		// but gamemode and track do get matched against, so those have to be right.
		this.leaderboards.handler.setMapID(0);
		this.leaderboards.handler.setGamemode(gamemode);
		this.leaderboards.handler.setLocalOnly(true);

		// The local table isn't for any online map; keep renderedMapID at 0 so updateTrackData's
		// same-map skip can't match a real map ID and hold these tracks by mistake.
		this.renderedMapID = 0;

		// Keyed by name (there's no map ID offline) so loading a different offline map resets the
		// selection, while style switches -- same map -- keep it.
		this.onMapContext(`local:${MapCacheAPI.GetMapName()}`);

		// Render the tracks now (no times yet), then reload PBs off disk; they arrive via
		// onLocalCompletionsUpdate.
		this.renderLocalTracks(null);
		MapCacheAPI.RefreshLocalCompletions(gamemode, style);
	}

	/**
	 * Re-render the offline track table when a local-PB reload lands. The engine only dispatches for
	 * the latest request, so this is always for the currently shown style.
	 */
	onLocalCompletionsUpdate(completions: MapUserCompletions) {
		this.renderLocalTracks(completions);
	}

	/** Render the map's zone-derived tracks, overlaying each with its local PB time if there is one. */
	private renderLocalTracks(completions: MapUserCompletions | null) {
		const tracks = getActiveZoneTracks();

		for (const track of tracks) {
			// TrackId treats all MAIN tracks as equal regardless of number, so match MAIN by type.
			const match = completions?.tracks?.find(
				(c) =>
					c.trackType === track.trackType &&
					(track.trackType === TrackType.MAIN || c.trackNum === track.trackNum)
			);
			if (match?.time != null) track.time = match.time;
		}

		this.renderTracks(tracks);
	}

	private static trackKey(track: TrackEntry): string {
		// All MAIN tracks are equivalent regardless of number (see renderLocalTracks), so key them the
		// same, keeping both the render signature and a remembered selection stable.
		return track.trackType === TrackType.MAIN ? 'MAIN' : `${track.trackType}:${track.trackNum}`;
	}

	/** Reset the remembered track selection when the shown map changes, so a new map starts on main. */
	private onMapContext(mapKey: string) {
		if (this.currentMapKey === mapKey) return;
		this.currentMapKey = mapKey;
		this.selectedTrackKey = null;
	}

	private renderTracks(tracks: TrackEntry[]) {
		const signature = tracks.map((t) => TrackSelectorHandler.trackKey(t)).join('|');

		// Reuse existing panels when the track set is unchanged (i.e. a style switch), so only the
		// per-track data is refreshed. Rebuild from scratch only when the set actually differs.
		const reuse = signature === this.renderedSignature;
		if (!reuse) {
			this.panels.container.RemoveAndDeleteChildren();
			this.trackPanels.clear();
			this.renderedSignature = signature;
		}

		const groupedContainers = new Map<TrackType, Panel>();
		const getGroupContainer = (type: TrackType) => {
			if (!groupedContainers.has(type)) {
				const container = $.CreatePanel('Panel', this.panels.container, 'TracksContainer');
				this.blurPanel?.AddBlurPanel(container);
				groupedContainers.set(type, container);
			}
			return groupedContainers.get(type)!;
		};

		tracks.forEach((track) => {
			const key = TrackSelectorHandler.trackKey(track);
			const isMain = track.trackType === TrackType.MAIN;
			const isStage = track.trackType === TrackType.STAGE;

			let trackPanel = reuse ? this.trackPanels.get(key) : undefined;
			if (!trackPanel) {
				const container = getGroupContainer(track.trackType);

				const panel = $.CreatePanel('RadioButton', container, '');
				panel.LoadLayoutSnippet('track-panel');
				this.trackPanels.set(key, panel);
				trackPanel = panel;

				const eorButton = panel.FindChildTraverse('OpenEOR');
				eorButton.visible = false;
				eorButton.SetPanelEvent('onactivate', () => {
					this.OpenEndOfRun(this.styleSelector?.handler.style, track.trackType, track.trackNum);
					panel.SetSelected(true);
				});

				const playButton = panel.FindChildTraverse('PlayTrack');
				playButton.visible = this.showActionButtons;
				playButton.SetPanelEvent('onactivate', () => {
					const style = this.styleSelector?.handler.style;
					if (style != null) GameInterfaceAPI.ConsoleCommand(`mom_style ${style}`);

					if (track.trackType === TrackType.MAIN) GameInterfaceAPI.ConsoleCommand('mom_main');
					else if (track.trackType === TrackType.STAGE)
						GameInterfaceAPI.ConsoleCommand(`mom_stage ${track.trackNum}`);
					else if (track.trackType === TrackType.BONUS)
						GameInterfaceAPI.ConsoleCommand(`mom_bonus ${track.trackNum}`);

					panel.SetSelected(true);
				});

				if (!isMain) {
					const dialogPrefix = isStage ? 'Stage' : 'Bonus';
					panel.SetDialogVariable('track', `${dialogPrefix} ${track.trackNum}`);
					this.applyColorBanding(panel, track.trackNum);
				}
			}

			// Rebound every render: rank/total vary by style, so the closure must see fresh data.
			if (this.leaderboards) {
				trackPanel.SetPanelEvent('onselect', () => {
					this.selectedTrackKey = key;
					this.applyTrackSelection(track);
				});
			}

			const trackLabel = isMain
				? 'Main'
				: isStage
					? `${$.Localize('#Leaderboards_Tracks_Stage')} ${track.trackNum}`
					: `${$.Localize('#Leaderboards_Tracks_Bonus')} ${track.trackNum}`;

			this.populateTrackPanel(trackPanel, {
				track: trackLabel,
				tier: track.tier,
				time: track.time,
				rank: track.rank,
				total: track.totalCompletions,
				group:
					track.rank == null
						? null
						: getCompletionGroup(track.rank, getGroupBoundaries(track.totalCompletions))
			});
		});

		// The group containers' bottom margin is what separates main from the stages from the bonuses,
		// but on the last group it leaves an empty strip you can scroll past, so drop it there.
		const groups = this.panels.container.Children();
		groups.forEach((group, index) => group.SetHasClass('tracks-container--last', index === groups.length - 1));

		// Keep the user's track selection across re-renders instead of snapping back to main.
		const remembered = tracks.find((t) => TrackSelectorHandler.trackKey(t) === this.selectedTrackKey);
		if (reuse && remembered) {
			// The selected panel stays selected through an in-place update, so don't reselect (that
			// would reset the leaderboard's page) -- just refresh its rank/total for the current style.
			// The records themselves are refetched by the caller's setStyle on a style switch.
			this.refreshSelectedTrackStats(remembered);
		} else {
			// Rebuilt panels start unselected: select the remembered track, or main if it's gone.
			// SetSelected fires onselect, which loads that track's leaderboard.
			const target = remembered ?? tracks.find((t) => t.trackType === TrackType.MAIN) ?? tracks[0];
			if (target) {
				this.selectedTrackKey = TrackSelectorHandler.trackKey(target);
				this.trackPanels.get(this.selectedTrackKey)?.SetSelected(true);
			}
		}
	}

	updateEorButtonVisibility(): void {
		const currentStyle = this.styleSelector?.handler.style;
		if (currentStyle == null) return;

		this.trackPanels.forEach((panel, panelKey) => {
			const eorButton = panel.FindChildTraverse('OpenEOR');
			if (!eorButton) return;

			let trackType: TrackType;
			let trackNum: number;

			if (panelKey === 'MAIN') {
				trackType = TrackType.MAIN;
				trackNum = 1;
			} else {
				const [type, num] = panelKey.split(':');
				trackType = Number(type);
				trackNum = Number(num);
			}

			const hasRun = this.endOfRun.handler.runCache?.has(currentStyle, trackType, trackNum);
			eorButton.visible = this.showActionButtons && hasRun;
		});
	}

	OpenEndOfRun(trackStyle: Style, trackType: TrackType, trackNum: number) {
		this.endOfRunCallback(trackStyle, trackType, trackNum);
	}

	/** Point the leaderboard at a track: rank/total for group boundaries, plus a records refetch. */
	private applyTrackSelection(track: TrackEntry) {
		if (!this.leaderboards) return;
		this.refreshSelectedTrackStats(track);
		this.leaderboards.handler.setTrack(track.trackType, track.trackNum);
	}

	/** Update just the selected track's rank/total -- no records refetch, so the page isn't reset. */
	private refreshSelectedTrackStats(track: TrackEntry) {
		if (!this.leaderboards) return;
		this.leaderboards.handler.setCurrentUserRank(track.rank);
		this.leaderboards.handler.setTotalCompletions(track.totalCompletions);
	}

	private populateTrackPanel(trackPanel: RadioButton, data: TrackDisplayData) {
		trackPanel.SetDialogVariable('track', data.track);

		// Panels are reused across renders (see renderTracks), so a label whose text a prior render
		// replaced with a placeholder must have its token template restored: SetDialogVariable* alone
		// won't revive a clobbered binding, but SetTextWithDialogVariables re-applies the template
		// against the current variables. The tokens mirror the label text in track-selector.xml.
		const tierLabel = trackPanel.FindChildrenWithClassTraverse('track-panel__tier-label')[0] as Label;
		if (data.tier > 0) {
			trackPanel.SetDialogVariableInt('tier', data.tier);
			tierLabel.SetTextWithDialogVariables('T{i:tier}');
		} else {
			tierLabel.text = '';
		}

		this.setOptionalFloat(trackPanel, 'track-panel__time-label', 'time', '{g:time:time}', data.time);

		const rankLabel = trackPanel.FindChildrenWithClassTraverse('track-panel__rank-label')[0] as Label;
		if (data.total == null) {
			// No online leaderboard for this map, so there's nothing to be ranked against.
			rankLabel.text = '';
		} else {
			trackPanel.SetDialogVariableInt('total', data.total);
			if (data.rank != null) {
				trackPanel.SetDialogVariableInt('rank', data.rank);
				rankLabel.SetTextWithDialogVariables('{i:rank}/{i:total}');
				rankLabel.SetHasClass('track-selector-label--muted', false);
			} else {
				rankLabel.text = `—/${data.total}`;
				rankLabel.SetHasClass('track-selector-label--muted', true);
			}
		}

		const groupPill = trackPanel.FindChildTraverse<GroupPill>('GroupPill');
		groupPill.AddClass('group-pill--solid');
		const group: CompletionGroup = data.group;
		groupPill.handler.setGroup(group);
	}

	private setOptionalFloat(panel: RadioButton, className: string, dialogVar: string, token: string, value?: number) {
		const label = panel.FindChildrenWithClassTraverse(className)[0] as Label;
		if (value != null) {
			panel.SetDialogVariableFloat(dialogVar, value);
			label.SetTextWithDialogVariables(token);
			label.SetHasClass('track-selector-label--muted', false);
		} else {
			label.text = '—';
			label.SetHasClass('track-selector-label--muted', true);
		}
	}

	private applyColorBanding(panel: GenericPanel, index: number) {
		if (index % 2 === 0) panel.AddClass('track-panel--alt-color');
	}
}
