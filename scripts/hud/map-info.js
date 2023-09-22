class HudMapInfo {
	static cachedInfoContainer = $('#CachedInfoContainer');

	static onMapLoad(mapName) {
		if (!mapName) return;

		$.GetContextPanel().SetDialogVariable('mapname', mapName);

		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.cachedInfoContainer.visible = true;

			let authorString = '';
			for (const [i, item] of mapData['credits'].filter((x) => x.type === 'author').entries())
				authorString += (i > 0 ? ', ' : '') + item.user.alias;
			const cp = $.GetContextPanel();
			cp.SetDialogVariable('author', authorString);

			const mainTrack = mapData['mainTrack'];
			cp.SetDialogVariableInt('tier', mainTrack['difficulty']);
			cp.SetDialogVariable(
				'zonetype',
				$.Localize(mainTrack['isLinear'] ? '#MapInfo_Type_Linear' : '#MapInfo_Type_Staged')
			);
			cp.SetDialogVariableInt('numzones', mainTrack['numZones']);
		} else {
			this.cachedInfoContainer.visible = false;
		}
	}

	static {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', HudMapInfo.onMapLoad.bind(this));
	}
}
