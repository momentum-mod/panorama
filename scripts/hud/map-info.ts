import { PanelHandler } from 'util/module-helpers';
import { getNumStages } from 'common/leaderboard';
import { getAuthorNames, getTier } from '../common/maps';

@PanelHandler()
class HudMapInfoHandler {
	cachedInfoContainer = $<Panel>('#CachedInfoContainer');
	stageCountLabel = $<Panel>('#StageCountLabel');
	linearLabel = $<Panel>('#LinearLabel');

	constructor() {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', (mapName: string) => this.onOfficialMapLoad(mapName));
	}

	onOfficialMapLoad(mapName: string) {
		if (!mapName) return;

		const cp = $.GetContextPanel();
		cp.SetDialogVariable('mapname', mapName);
		cp.SetDialogVariable('gamemode', $.Localize(GameModeAPI.GetGameModeName(GameModeAPI.GetCurrentGameMode())));

		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.cachedInfoContainer.visible = true;

			cp.SetDialogVariable('author', getAuthorNames(mapData.staticData));

			const mainTrackTier = getTier(mapData.staticData, GameModeAPI.GetCurrentGameMode());
			const numStages = getNumStages(mapData.staticData);
			const isLinear = numStages <= 1;

			cp.SetDialogVariableInt('tier', mainTrackTier ?? 0);
			this.linearLabel.visible = isLinear;
			this.stageCountLabel.visible = !isLinear;
			if (!isLinear) {
				cp.SetDialogVariableInt('stageCount', numStages);
			}
		} else {
			this.cachedInfoContainer.visible = false;
		}
	}
}
