'use strict';

class HudMapInfo {
	static cachedInfoContainer = $('#CachedInfoContainer');

	static onMapLoad(mapName) {
		if (!mapName) return;

		$.GetContextPanel().SetDialogVariable('mapname', mapName);

		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.cachedInfoContainer.visible = true;

			let authorString = '';
			mapData['credits']
				.filter((x) => x.type === 'author')
				.forEach((item, i) => (authorString += (i > 0 ? ', ' : '') + item.user.alias));
			$.GetContextPanel().SetDialogVariable('author', authorString);

			const mainTrack = mapData['mainTrack'];
			$.GetContextPanel().SetDialogVariableInt('tier', mainTrack['difficulty']);
			$.GetContextPanel().SetDialogVariable('zonetype', mainTrack['isLinear'] ? 'Linear' : 'Staged');
			$.GetContextPanel().SetDialogVariableInt('numzones', mainTrack['numZones']);
		} else {
			this.cachedInfoContainer.visible = false;
		}
	}

	static {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', HudMapInfo.onMapLoad.bind(this));
	}
}
