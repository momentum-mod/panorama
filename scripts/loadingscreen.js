'use strict';

class LoadingScreen {
	static init()
	{
		$('#ProgressBar').value = 0;
		
		const gamemode = GameModeAPI.GetCurrentGameMode();
		const tip = GameModeAPI.GetRandomTipForGameMode(gamemode);
		$.GetContextPanel().SetDialogVariable("tip", $.LocalizeSafe(tip));
		
		$('#Author').visible = true;
		$('#TierAndType').visible = true;
		$('#NumZones').visible = true;
		$('#BackgroundImage').visible = false;
	}

	static updateLoadingScreenInfo(mapName)
	{
		if (!mapName)
			return;
		
		let mapData = MapCacheAPI.GetCurrentMapData();
		
		if (!mapData) {
			// No data to go off of, just set the map name and hide the rest
			$.GetContextPanel().SetDialogVariable("mapname", mapName);
			
			$('#Author').visible = false;
			$('#TierAndType').visible = false;
			$('#NumZones').visible = false;
			$('#BackgroundImage').SetImage('');
			
			return;
		}
		
		$.GetContextPanel().SetDialogVariable("mapname", mapData.name);
		$.GetContextPanel().SetDialogVariableInt("tier", mapData.mainTrack.difficulty);
		$.GetContextPanel().SetDialogVariableInt("numzones", mapData.mainTrack.numZones);
		$.GetContextPanel().SetDialogVariable("tracktype", mapData.mainTrack.isLinear ? 'Linear' : 'Staged');
		$.GetContextPanel().SetDialogVariable("author", mapData.credits[0].user.alias);
		
		const backgroundImageLoaded = function () {
			$('#BackgroundImage').visible = true;
		}
		$.RegisterEventHandler('ImageLoaded', $('#BackgroundImage'), backgroundImageLoaded.bind(undefined));
		const backgroundImageFailed = function () {
			$('#BackgroundImage').visible = false;
		}
		$.RegisterEventHandler('ImageFailedLoad', $('#BackgroundImage'), backgroundImageFailed.bind(undefined));
		$('#BackgroundImage').SetImage(mapData.thumbnail.urlLarge);
	}
}


( function() {
	$.RegisterForUnhandledEvent( 'PopulateLoadingScreen', LoadingScreen.updateLoadingScreenInfo );
	$.RegisterForUnhandledEvent( 'UnloadLoadingScreenAndReinit', LoadingScreen.init );
})();