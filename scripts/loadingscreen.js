'use strict';

class LoadingScreen {
	static {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', LoadingScreen.updateLoadingScreenInfo);
		$.RegisterForUnhandledEvent('UnloadLoadingScreenAndReinit', LoadingScreen.init);

		$.RegisterEventHandler('PanelLoaded', $('#BackgroundImage'), () => {
			$('#BackgroundImage').visible = true;
		});
		$.RegisterEventHandler('ImageFailedLoad', $('#BackgroundImage'), () => {
			$('#BackgroundImage').visible = false;
		});
	}

	static init() {
		$('#ProgressBar').value = 0;

		const gamemode = GameModeAPI.GetCurrentGameMode();
		const tip = GameModeAPI.GetRandomTipForGameMode(gamemode);
		$.GetContextPanel().SetDialogVariable('tip', $.LocalizeSafe(tip));

		$('#MapName').visible = false;
		$('#Author').visible = false;
		$('#TierAndType').visible = false;
		$('#NumZones').visible = false;
		$('#BackgroundImage').visible = false;
	}

	static updateLoadingScreenInfo(mapName) {
		if (!mapName) return;

		let mapData = MapCacheAPI.GetCurrentMapData();

		if (!mapData) {
			// No data to go off of, just set the map name and hide the rest
			$.GetContextPanel().SetDialogVariable('mapname', mapName);
			$('#MapName').visible = true;

			$('#Author').visible = false;
			$('#TierAndType').visible = false;
			$('#NumZones').visible = false;
			$('#BackgroundImage').SetImage('');

			return;
		}

		$.GetContextPanel().SetDialogVariable('mapname', mapData.name);
		$.GetContextPanel().SetDialogVariableInt('tier', mapData.mainTrack.difficulty);
		$.GetContextPanel().SetDialogVariableInt('numzones', mapData.mainTrack.numZones);
		$.GetContextPanel().SetDialogVariable('tracktype', mapData.mainTrack.isLinear ? 'Linear' : 'Staged');

		let authorString = '';
		mapData.credits
			.filter((x) => x.type === 'author')
			.forEach((item, i) => (authorString += (i > 0 ? ', ' : '') + item.user.alias));
		$.GetContextPanel().SetDialogVariable('author', authorString);

		$('#MapName').visible = true;
		$('#Author').visible = true;
		$('#TierAndType').visible = true;
		$('#NumZones').visible = true;

		$('#BackgroundImage').SetImage(mapData.thumbnail.urlLarge);
	}
}
