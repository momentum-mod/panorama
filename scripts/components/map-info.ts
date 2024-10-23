import { PanelHandler } from 'util/module-helpers';
import { Gamemode, Leaderboard, MMap, TrackType } from 'common/web';
import { getMainTrack } from 'common/leaderboard';

interface MapInfoValues {
	mainTrackTier: number;
	stageCount: number;
	bonusCount: number;
}

@PanelHandler({ exposeToPanel: true })
export class MapInfoHandler {
	fromActiveMap = false;

	readonly panels = {
		cp: $.GetContextPanel<MapInfo>()
	};

	constructor() {
		$.RegisterForUnhandledEvent('ActiveZoneDefsChanged', () => {
			if (this.fromActiveMap) {
				this.setFromActiveMap();
			}
		});
	}

	getMapInfoValues(mapData: MMap): MapInfoValues {
		const mainTrack = getMainTrack(mapData, GameModeAPI.GetCurrentGameMode());

		// No main track is an invalid state, don't bother
		if (!mainTrack) {
			return null;
		}

		const stageCount = mapData.leaderboards.filter(
			(leaderboard) => leaderboard.trackType === TrackType.STAGE
		).length;
		const bonusCount = mapData.leaderboards.filter(
			(leaderboard) => leaderboard.trackType === TrackType.BONUS
		).length;

		return {
			mainTrackTier: mainTrack.tier,
			stageCount,
			bonusCount
		};
	}

	setFromMapData(mapData: MMap): void {
		this.fromActiveMap = false;

		const values = this.getMapInfoValues(mapData);
		if (values) this.setFromValues(values);
		else this.panels.cp.RemoveAndDeleteChildren();
	}

	setFromActiveMap(): void {
		this.fromActiveMap = true;

		const values: MapInfoValues = {
			mainTrackTier: 0,
			stageCount: 0,
			bonusCount: 0
		};

		// Start with official map info, if any
		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			const mapDataValues = this.getMapInfoValues(mapData);
			if (mapDataValues) Object.assign(values, mapDataValues);
		}

		// Update to reflect the active zone data
		const zoneDefs = MomentumTimerAPI.GetActiveZoneDefs();
		values.stageCount = zoneDefs?.tracks.main.zones.segments.length ?? 0;
		values.bonusCount = zoneDefs?.tracks.bonuses.length ?? 0;

		this.setFromValues(values);
	}

	setFromValues(values: MapInfoValues): void {
		const fields: string[] = [];

		if (values.mainTrackTier > 0) {
			fields.push('#MapInfo_Tier');
			this.panels.cp.SetDialogVariableInt('tier', values.mainTrackTier);
		}

		if (values.stageCount >= 2) {
			//fields.push("#MapInfo_StageCount");
			fields.push('{d:stageCount} Stages');
			this.panels.cp.SetDialogVariableInt('stageCount', values.stageCount);
		} else {
			fields.push('#MapInfo_Type_Linear');
		}

		if (values.bonusCount > 0) {
			//fields.push("#MapInfo_BonusCount");
			fields.push('{d:bonusCount} Bonuses');
			this.panels.cp.SetDialogVariableInt('bonusCount', values.bonusCount);
		}

		this.panels.cp.RemoveAndDeleteChildren();

		for (const [i, field] of fields.entries()) {
			if (i > 0) {
				$.CreatePanel('Label', this.panels.cp, '', { text: ' | ', class: 'map-info__separator' });
			}

			$.CreatePanel('Label', this.panels.cp, '', { text: field, class: 'map-info__field' });
		}
	}
}
