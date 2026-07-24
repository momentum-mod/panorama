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
	currentMapData: MapCacheAPI.StaticData;

	// TODO: Blur broken when scrolling / Fixed in panzer's pr
	blurPanel: BaseBlurTarget | null = null;

	setBlurPanel(panel: BaseBlurTarget) {
		this.blurPanel = panel;
	}

	connectLeaderboards(leaderboards: Leaderboards) {
		this.leaderboards = leaderboards;
	}

	connectStyleSelector(styleSelector: StyleSelector) {
		this.styleSelector = styleSelector;
	}

	updateMapData(data: MapCacheAPI.StaticData) {
		this.currentMapData = data;
	}

	updateTrackData(completions: MapUserCompletions) {
		if (!this.leaderboards || !completions) return;

		this.leaderboards.handler.setMapID(completions.mapID);
		this.leaderboards.handler.setGamemode(completions.gamemode);
		this.leaderboards.handler.setLocalOnly(false);

		// `tracks` can be absent: an empty CUtlVector serializes to JSON without the key, which
		// happens whenever completions are dispatched before the cache is populated (e.g. on map
		// selection, before the online fetch lands). Render an empty table in that case.
		this.renderTracks(completions.tracks ?? []);
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

	private renderTracks(tracks: TrackEntry[]) {
		this.panels.container.RemoveAndDeleteChildren();

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
			const container = getGroupContainer(track.trackType);

			const trackPanel = $.CreatePanel('RadioButton', container, '');
			trackPanel.LoadLayoutSnippet('track-panel');

			if (this.leaderboards) {
				trackPanel.SetPanelEvent('onselect', () => {
					this.leaderboards.handler.setCurrentUserRank(track.rank);
					this.leaderboards.handler.setTotalCompletions(track.totalCompletions);
					this.leaderboards.handler.setTrack(track.trackType, track.trackNum);
				});
			}

			const playButton = trackPanel.FindChildTraverse('PlayTrack');
			playButton.SetPanelEvent('onactivate', () => {
				const style = this.styleSelector?.handler.style;
				if (style != null) GameInterfaceAPI.ConsoleCommand(`mom_style ${style}`);

				if (track.trackType === TrackType.MAIN) GameInterfaceAPI.ConsoleCommand('mom_main');
				else if (track.trackType === TrackType.STAGE)
					GameInterfaceAPI.ConsoleCommand(`mom_stage ${track.trackNum}`);
				else if (track.trackType === TrackType.BONUS)
					GameInterfaceAPI.ConsoleCommand(`mom_bonus ${track.trackNum}`);

				trackPanel.SetSelected(true);
			});

			const isMain = track.trackType === TrackType.MAIN;
			const isStage = track.trackType === TrackType.STAGE;

			const trackLabel = isMain
				? 'Main'
				: isStage
					? `${$.Localize('#Leaderboards_Tracks_Stage')} ${track.trackNum}`
					: `${$.Localize('#Leaderboards_Tracks_Bonus')} ${track.trackNum}`;

			if (!isMain) {
				const dialogPrefix = isStage ? 'Stage' : 'Bonus';
				trackPanel.SetDialogVariable('track', `${dialogPrefix} ${track.trackNum}`);
			}

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

			if (isMain) {
				trackPanel.SetSelected(true);
			} else {
				this.applyColorBanding(trackPanel, track.trackNum);
			}
		});
	}

	private populateTrackPanel(trackPanel: RadioButton, data: TrackDisplayData) {
		trackPanel.SetDialogVariable('track', data.track);

		const tierLabel = trackPanel.FindChildrenWithClassTraverse('track-panel__tier-label')[0] as Label;
		if (data.tier > 0) {
			trackPanel.SetDialogVariableInt('tier', data.tier);
		} else {
			tierLabel.text = '';
		}

		this.setOptionalFloat(trackPanel, 'track-panel__time-label', 'time', data.time);

		const rankLabel = trackPanel.FindChildrenWithClassTraverse('track-panel__rank-label')[0] as Label;
		if (data.total == null) {
			// No online leaderboard for this map, so there's nothing to be ranked against.
			rankLabel.text = '';
		} else {
			trackPanel.SetDialogVariableInt('total', data.total);
			if (data.rank != null) {
				trackPanel.SetDialogVariableInt('rank', data.rank);
			} else {
				rankLabel.text = `—/${data.total}`;
				rankLabel.style.color = 'rgb(160, 160, 160)';
			}
		}

		const groupPill = trackPanel.FindChildTraverse<GroupPill>('GroupPill');
		groupPill.AddClass('group-pill--solid');
		const group: CompletionGroup = data.group;
		groupPill.handler.setGroup(group);
	}

	private setOptionalFloat(panel: RadioButton, className: string, dialogVar: string, value?: number) {
		const label = panel.FindChildrenWithClassTraverse(className)[0] as Label;
		if (value != null) {
			panel.SetDialogVariableFloat(dialogVar, value);
		} else {
			label.text = '—';
			label.style.color = 'rgb(160, 160, 160)';
		}
	}

	private applyColorBanding(panel: GenericPanel, index: number) {
		if (index % 2 === 0) panel.AddClass('track-panel--alt-color');
	}
}
