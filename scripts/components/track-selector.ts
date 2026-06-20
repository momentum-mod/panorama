import { PanelHandler } from 'util/module-helpers';
import * as Maps from 'common/maps';
import * as Leaderboards from 'common/leaderboard';
import { TrackType } from 'common/web/enums/track-type.enum';

export interface TrackSelectorInterface extends TrackSelector {
	updateTrackData: (mapData: MapCacheAPI.MapData, gamemode: Gamemode) => void;
	setBlurPanel: (blurPanel: BaseBlurTarget) => void;
}

@PanelHandler()
export class TrackSelectorHandler {
	readonly panels = {
		cp: $.GetContextPanel<TrackSelector>(),
		container: $<Panel>('#TrackSelectorContainer')
	};

	blurPanel: BaseBlurTarget | null = null;

	constructor() {
		const trackSelectorInterface = this.panels.cp as TrackSelectorInterface;
		trackSelectorInterface.updateTrackData = (mapData, gamemode) => this.updateTrackData(mapData, gamemode);
		trackSelectorInterface.setBlurPanel = (panel: BaseBlurTarget) => (this.blurPanel = panel);
	}

	updateTrackData(mapData: MapCacheAPI.MapData, gamemode: Gamemode) {
		this.createMainSection(mapData, gamemode);
		this.createStageSection(mapData, gamemode);
		this.createBonusSection(mapData, gamemode);
	}

	createMainSection(mapData: MapCacheAPI.MapData, gamemode: Gamemode) {
		this.panels.container.RemoveAndDeleteChildren();

		const userMapData = Leaderboards.getUserMapDataTrack(mapData.userData, gamemode);
		const tier = Maps.getTier(mapData.staticData, gamemode);

		const container = $.CreatePanel('Panel', this.panels.container, 'TracksContainer');
		this.blurPanel?.AddBlurPanel(container);

		const trackPanel = $.CreatePanel('Panel', container, '');
		trackPanel.LoadLayoutSnippet('track-panel');

		trackPanel.SetDialogVariable('track', 'Main');
		trackPanel.SetDialogVariableInt('tier', tier);

		if (userMapData?.time) {
			trackPanel.SetDialogVariableFloat('time', userMapData.time);
		} else {
			const timeLabel = trackPanel.FindChildrenWithClassTraverse('track-panel__time-label')[0] as Label;
			timeLabel.text = '—';
			timeLabel.style.color = 'rgb(160, 160, 160)';
		}
	}

	createStageSection(mapData: MapCacheAPI.MapData, gamemode: Gamemode) {
		const stages = Leaderboards.getNumStages(mapData.staticData);
		if (stages < 2) return;

		const userStageData = Leaderboards.getUserMapDataTrack(mapData.userData, gamemode, TrackType.STAGE);

		const container = $.CreatePanel('Panel', this.panels.container, 'TracksContainer');
		this.blurPanel?.AddBlurPanel(container);

		for (let i = 1; i <= stages; i++) {
			const trackPanel = $.CreatePanel('Panel', container, '');
			trackPanel.LoadLayoutSnippet('track-panel');
			trackPanel.SetDialogVariable('track', `Stage ${i}`);

			if (i % 2 === 0) {
				trackPanel.style.backgroundColor = 'rgba(54, 54, 54, 0.7)';
			}
		}
	}

	createBonusSection(mapData: MapCacheAPI.MapData, gamemode: Gamemode) {
		const bonuses = Leaderboards.getNumBonuses(mapData.staticData);
		if (bonuses < 1) return;

		const container = $.CreatePanel('Panel', this.panels.container, 'TracksContainer');
		this.blurPanel?.AddBlurPanel(container);

		for (let i = 1; i <= bonuses; i++) {
			const trackPanel = $.CreatePanel('Panel', container, '');
			trackPanel.LoadLayoutSnippet('track-panel');
			trackPanel.SetDialogVariable('track', `Bonus ${i}`);

			if (i % 2 === 0) {
				trackPanel.style.backgroundColor = 'rgba(40, 40, 40, 0.6)';
			}
		}
	}
}
