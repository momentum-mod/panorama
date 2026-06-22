import { PanelHandler } from 'util/module-helpers';
import * as Maps from 'common/maps';
import * as Leaderboards from 'common/leaderboard';
import { TrackType } from 'common/web/enums/track-type.enum';
import { randomInt } from 'util/functions';

export interface TrackSelectorInterface extends TrackSelector {
	updateTrackData: (mapData: MapCacheAPI.MapData, gamemode: Gamemode) => void;
	setBlurPanel: (blurPanel: BaseBlurTarget) => void;
}

interface TrackDisplayData {
	track: string;
	tier?: number;
	time?: number;
	rank?: number;
	total: number;
	group?: number;
}

const GROUP_PILL = {
	NONE: 'rgba(0, 0, 0, 0)',
	WR: 'rgba(24, 150, 211, 1)',
	TOP10: 'rgba(113, 240, 255, 1)',
	G1: 'rgba(212, 175, 55, 1)',
	G2: 'rgba(168, 186, 200, 1)',
	G3: 'rgba(140, 80, 40, 1)',
	G4_G6: 'rgba(80, 85, 95, 1)'
} as const;

function getGroupColor(group: number, rank: number): string {
	if (rank === 1 && group === 0) return GROUP_PILL.WR;
	if (group === undefined) return GROUP_PILL.NONE;

	switch (group) {
		case 0:
			return GROUP_PILL.TOP10;
		case 1:
			return GROUP_PILL.G1;
		case 2:
			return GROUP_PILL.G2;
		case 3:
			return GROUP_PILL.G3;
		default:
			return GROUP_PILL.G4_G6;
	}
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

		const trackPanel = $.CreatePanel('RadioButton', container, '');
		trackPanel.LoadLayoutSnippet('track-panel');

		this.populateTrackPanel(trackPanel, {
			track: 'Main',
			tier,
			time: userMapData?.time,
			rank: randomInt(1, 1000),
			total: randomInt(1000, 2000),
			group: randomInt(0, 6)
		});
	}

	createStageSection(mapData: MapCacheAPI.MapData, gamemode: Gamemode) {
		const stages = Leaderboards.getNumStages(mapData.staticData);
		if (stages < 2) return;

		const userStageData = Leaderboards.getUserMapDataTrack(mapData.userData, gamemode, TrackType.STAGE);

		const container = $.CreatePanel('Panel', this.panels.container, 'TracksContainer');
		this.blurPanel?.AddBlurPanel(container);

		for (let i = 1; i <= stages; i++) {
			const trackPanel = $.CreatePanel('RadioButton', container, '');
			trackPanel.LoadLayoutSnippet('track-panel');
			trackPanel.SetDialogVariable('track', `Stage ${i}`);

			this.populateTrackPanel(trackPanel, {
				track: `Stage ${i}`,
				time: userStageData?.time,
				rank: randomInt(1, 2),
				total: randomInt(5654, 10000),
				group: randomInt(0, 6)
			});

			this.applyColorBanding(trackPanel, i);
		}
	}

	createBonusSection(mapData: MapCacheAPI.MapData, gamemode: Gamemode) {
		const bonuses = Leaderboards.getNumBonuses(mapData.staticData);
		if (bonuses < 1) return;

		const userBonusData = Leaderboards.getUserMapDataTrack(mapData.userData, gamemode, TrackType.BONUS);

		const container = $.CreatePanel('Panel', this.panels.container, 'TracksContainer');
		this.blurPanel?.AddBlurPanel(container);

		for (let i = 1; i <= bonuses; i++) {
			const trackPanel = $.CreatePanel('RadioButton', container, '');
			trackPanel.LoadLayoutSnippet('track-panel');

			const tier = Maps.getTier(mapData.staticData, gamemode, TrackType.BONUS, i);

			this.populateTrackPanel(trackPanel, {
				track: `Bonus ${i}`,
				tier: tier,
				time: userBonusData?.time,
				rank: randomInt(1, 654),
				total: randomInt(654, 3545),
				group: randomInt(0, 6)
			});

			this.applyColorBanding(trackPanel, i);
		}
	}

	populateTrackPanel(trackPanel: RadioButton, data: TrackDisplayData) {
		trackPanel.SetDialogVariable('track', data.track);

		if (data.track === 'Main') {
			trackPanel.SetSelected(true);
		}

		// Tier — empty label if not present (stages)
		const tierLabel = trackPanel.FindChildrenWithClassTraverse('track-panel__tier-label')[0] as Label;
		if (data.tier !== undefined) {
			trackPanel.SetDialogVariableInt('tier', data.tier);
		} else {
			tierLabel.text = '';
		}

		// Time
		this.setOptionalFloat(trackPanel, 'track-panel__time-label', 'time', data.time);

		const rankLabel = trackPanel.FindChildrenWithClassTraverse('track-panel__rank-label')[0] as Label;
		trackPanel.SetDialogVariableInt('total', data.total);
		if (data.rank !== undefined) {
			trackPanel.SetDialogVariableInt('rank', data.rank);
		} else {
			rankLabel.text = `— /${data.total}`;
			rankLabel.style.color = 'rgb(160, 160, 160)';
		}

		// Group — empty label if not present
		const groupLabel = trackPanel.FindChildrenWithClassTraverse('track-panel__group-label')[0] as Label;
		const groupPill = trackPanel.FindChildrenWithClassTraverse('track-panel__group-pill')[0] as Panel;

		if (data.group === undefined) {
			groupLabel.text = '';
			groupPill.style.borderColor = GROUP_PILL.NONE as color;
		} else if (data.group === 0 && data.rank === 1) {
			groupLabel.text = 'WR';
			groupPill.style.borderColor = GROUP_PILL.WR as color;
		} else if (data.group === 0) {
			groupLabel.text = 'TOP10';
			groupPill.style.borderColor = GROUP_PILL.TOP10 as color;
		} else {
			trackPanel.SetDialogVariableInt('group', data.group);
			groupPill.style.borderColor = getGroupColor(data.group, data.rank) as color;
		}
	}

	setOptionalFloat(panel: RadioButton, className: string, dialogVar: string, value?: number) {
		const label = panel.FindChildrenWithClassTraverse(className)[0] as Label;
		if (value !== undefined) {
			panel.SetDialogVariableFloat(dialogVar, value);
		} else {
			label.text = '—';
			label.style.color = 'rgb(160, 160, 160)';
		}
	}

	applyColorBanding(panel: GenericPanel, index: number) {
		if (index % 2 === 0) panel.AddClass('track-panel--alt-color');
	}
}
