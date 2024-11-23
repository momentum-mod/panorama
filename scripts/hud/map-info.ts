import { PanelHandler } from 'util/module-helpers';
import { getNumZones, getTrack } from 'common/leaderboard';
import { getAuthorNames } from '../common/maps';

@PanelHandler()
class HudMapInfoHandler {
	cachedInfoContainer = $<Panel>('#CachedInfoContainer');

	constructor() {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', (mapName: string) => this.onOfficialMapLoad(mapName));
	}

	onOfficialMapLoad(mapName: string) {
		if (!mapName) return;

		$.GetContextPanel().SetDialogVariable('mapname', mapName);

		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.cachedInfoContainer.visible = true;

			const cp = $.GetContextPanel();

			cp.SetDialogVariable('author', getAuthorNames(mapData.staticData));

			const mainTrack = getTrack(mapData.staticData, GameModeAPI.GetCurrentGameMode());
			const numZones = getNumZones(mapData.staticData);

			cp.SetDialogVariableInt('tier', mainTrack?.tier ?? 0);
			cp.SetDialogVariable('zonetype', mainTrack?.linear ? '#MapInfo_Type_Linear' : '#MapInfo_Type_Staged');
			cp.SetDialogVariableInt('numzones', numZones);
		} else {
			this.cachedInfoContainer.visible = false;
		}
	}
}
