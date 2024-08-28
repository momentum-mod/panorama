import { PanelHandler } from 'util/module-helpers';
import { getMainTrack, getNumZones } from 'common/leaderboard';
import { MapCreditType } from 'common/web';

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

			cp.SetDialogVariable(
				'author',
				mapData.credits
					.filter((x) => x.type === MapCreditType.AUTHOR)
					.map(({ user: { alias } }) => alias)
					.join(', ')
			);

			const mainTrack = getMainTrack(mapData, GameModeAPI.GetCurrentGameMode());
			const numZones = getNumZones(mapData);

			cp.SetDialogVariableInt('tier', mainTrack?.tier ?? 0);
			cp.SetDialogVariable('zonetype', mainTrack?.linear ? '#MapInfo_Type_Linear' : '#MapInfo_Type_Staged');
			cp.SetDialogVariableInt('numzones', numZones);
		} else {
			this.cachedInfoContainer.visible = false;
		}
	}
}
