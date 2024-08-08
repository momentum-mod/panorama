class HudMapInfo {
cachedInfoContainer = $<Panel>('#CachedInfoContainer');

onMapLoad(mapName: string) {
		if (!mapName) return;

		$.GetContextPanel().SetDialogVariable('mapname', mapName);

		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.cachedInfoContainer.visible = true;

			const cp = $.GetContextPanel();
			
			cp.SetDialogVariable(
				'author',
				mapData.credits
					.filter((x) => x.type === _.Web.MapCreditType.AUTHOR)
					.map(({ user: { alias } }) => alias)
					.join(', ')
			);

			const mainTrack = _.Util.getMainTrack(mapData, GameModeAPI.GetCurrentGameMode());
			const numZones = _.Util.getNumZones(mapData);

			cp.SetDialogVariableInt('tier', mainTrack?.tier ?? 0);
			cp.SetDialogVariable(
				'zonetype',
				$.Localize(mainTrack?.linear ? '#MapInfo_Type_Linear' : '#MapInfo_Type_Staged')
			);
			cp.SetDialogVariableInt('numzones', numZones);
		} else {
			this.cachedInfoContainer.visible = false;
		}
	}

constructor() {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', HudMapInfo.onMapLoad.bind(this));
	}
}

