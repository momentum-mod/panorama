import { PanelHandler } from 'util/module-helpers';
import { getNumBonuses, getNumZones, getTrack } from 'common/leaderboard';
import { getAuthorNames } from '../common/maps';

@PanelHandler()
class LoadingScreenHandler {
	readonly panels = {
		cp: $.GetContextPanel(),
		backgroundImage: $<Image>('#BackgroundImage'),
		progressBar: $<ProgressBar>('#ProgressBar'),
		mapName: $<Label>('#MapName'),
		author: $<Label>('#Author'),
		tierAndType: $<Label>('#TierAndType'),
		numZones: $<Label>('#NumZones')
	};

	constructor() {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', (mapName) => this.updateLoadingScreenInfo(mapName));
		$.RegisterForUnhandledEvent('UnloadLoadingScreenAndReinit', () => this.init());

		$.RegisterEventHandler(
			'PanelLoaded',
			this.panels.backgroundImage,
			() => (this.panels.backgroundImage.visible = true)
		);
		$.RegisterEventHandler(
			'ImageFailedLoad',
			this.panels.backgroundImage,
			() => (this.panels.backgroundImage.visible = false)
		);
	}

	init() {
		this.panels.progressBar.value = 0;

		const gamemode = GameModeAPI.GetCurrentGameMode();
		const tip = GameModeAPI.GetRandomTipForGameMode(gamemode);

		this.panels.cp.SetDialogVariable('tip', $.LocalizeSafe(tip));

		this.panels.mapName.visible = false;
		this.panels.author.visible = false;
		this.panels.tierAndType.visible = false;
		this.panels.numZones.visible = false;
		this.panels.backgroundImage.visible = false;
	}

	updateLoadingScreenInfo(mapName: string) {
		if (!mapName) return;

		const mapData = MapCacheAPI.GetCurrentMapData();

		if (!mapData) {
			// No data to go off of, just set the map name and hide the rest
			this.panels.cp.SetDialogVariable('mapname', mapName);
			this.panels.mapName.visible = true;

			this.panels.author.visible = false;
			this.panels.tierAndType.visible = false;
			this.panels.numZones.visible = false;
			this.panels.backgroundImage.SetImage('');

			return;
		}

		const gamemode = GameModeAPI.GetCurrentGameMode();
		const mainTrack = getTrack(mapData.staticData, gamemode);

		this.panels.cp.SetDialogVariable('mapname', mapData.staticData.name);
		this.panels.cp.SetDialogVariableInt('tier', mainTrack?.tier ?? 0);
		this.panels.cp.SetDialogVariableInt('numzones', getNumZones(mapData.staticData));
		this.panels.cp.SetDialogVariable('tracktype', mainTrack?.linear ? 'Linear' : 'Staged');
		this.panels.cp.SetDialogVariableInt('bonuses', getNumBonuses(mapData.staticData));

		this.panels.cp.SetDialogVariable('author', getAuthorNames(mapData.staticData));

		this.panels.mapName.visible = true;
		this.panels.author.visible = true;
		this.panels.tierAndType.visible = true;
		this.panels.numZones.visible = true;

		this.panels.backgroundImage.SetImage(mapData.staticData.thumbnail.large);
	}
}
