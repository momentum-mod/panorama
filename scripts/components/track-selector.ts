import { PanelHandler } from 'util/module-helpers';
import { TrackType } from 'common/web/enums/track-type.enum';
import { MapUserCompletions } from 'common/maps';
import { CompletionGroup } from 'common/web/enums/completion-group.enum';
import { getCompletionGroup, getGroupBoundaries } from 'common/completion-group';

interface TrackDisplayData {
	track: string;
	tier?: number;
	time?: number;
	rank?: number;
	total: number;
	group?: number;
}

@PanelHandler({ exposeToPanel: true })
export class TrackSelectorHandler {
	readonly panels = {
		cp: $.GetContextPanel<TrackSelector>(),
		container: $<Panel>('#TrackSelectorContainer')
	};

	leaderboards: Leaderboards | null = null;
	currentMapData: MapCacheAPI.StaticData;

	// TODO: Blur broken when scrolling / Fixed in panzer's pr
	blurPanel: BaseBlurTarget | null = null;

	setBlurPanel(panel: BaseBlurTarget) {
		this.blurPanel = panel;
	}

	connectLeaderboards(leaderboards: Leaderboards) {
		this.leaderboards = leaderboards;
	}

	updateMapData(data: MapCacheAPI.StaticData) {
		this.currentMapData = data;
	}

	updateTrackData(completions: MapUserCompletions) {
		if (!this.leaderboards) return;
		this.leaderboards.handler.setMapID(completions.mapID);
		this.leaderboards.handler.setGamemode(completions.gamemode);

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
		completions.tracks.forEach((track) => {
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
				group: getCompletionGroup(track.rank, getGroupBoundaries(track.totalCompletions))
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
		trackPanel.SetDialogVariableInt('total', data.total);
		if (data.rank != null) {
			trackPanel.SetDialogVariableInt('rank', data.rank);
		} else {
			rankLabel.text = `—/${data.total}`;
			rankLabel.style.color = 'rgb(160, 160, 160)';
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
