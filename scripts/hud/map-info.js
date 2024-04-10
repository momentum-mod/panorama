class HudMapInfo {
	static cachedInfoContainer = $('#CachedInfoContainer');

	static onMapLoad(mapName) {
		if (!mapName) return;

		$.GetContextPanel().SetDialogVariable('mapname', mapName);

		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.cachedInfoContainer.visible = true;

			let authorString = '';
			for (const [i, item] of mapData['credits'].filter((x) => x.type === MapCreditType.AUTHOR).entries())
				authorString += (i > 0 ? ', ' : '') + item.user.alias;
			const cp = $.GetContextPanel();
			cp.SetDialogVariable('author', authorString);

			const mainTrack = getMainTrack(mapData, GameModeAPI.GetCurrentGameMode());
			const numZones = getNumZones(mapData);

			cp.SetDialogVariableInt('tier', mainTrack?.tier ?? 0);
			cp.SetDialogVariable(
				'zonetype',
				$.Localize(mainTrack?.isLinear ? '#MapInfo_Type_Linear' : '#MapInfo_Type_Staged')
			);
			cp.SetDialogVariableInt('numzones', numZones);
		} else {
			this.cachedInfoContainer.visible = false;
		}
	}

	static {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', HudMapInfo.onMapLoad.bind(this));
	}
}
