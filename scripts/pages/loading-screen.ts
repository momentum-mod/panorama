import { PanelHandler } from 'util/module-helpers';
import { getNumBonuses, getNumStages } from 'common/leaderboard';
import { getAuthorNames, getTier } from '../common/maps';

@PanelHandler()
class LoadingScreenHandler {
	readonly panels = {
		cp: $.GetContextPanel(),
		backgroundImage: $<Image>('#BackgroundImage'),
		progressBar: $<ProgressBar>('#ProgressBar'),
		mapName: $<Label>('#MapName'),
		author: $<Label>('#Author'),
		tierAndType: $<Label>('#TierAndType'),
		stageCountLabel: $<Label>('#StageCount'),
		bonusCountLabel: $<Label>('#BonusCount'),
		bonusesCountLabel: $<Label>('#BonusesCount')
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
		this.panels.stageCountLabel.visible = false;
		this.panels.bonusCountLabel.visible = false;
		this.panels.bonusesCountLabel.visible = false;
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
			this.panels.stageCountLabel.visible = false;
			this.panels.bonusCountLabel.visible = false;
			this.panels.bonusesCountLabel.visible = false;
			this.panels.backgroundImage.SetImage('');

			return;
		}

		const gamemode = GameModeAPI.GetCurrentGameMode();
		const mainTrackTier = getTier(mapData.staticData, gamemode);
		const numStages = getNumStages(mapData.staticData);
		const numBonuses = getNumBonuses(mapData.staticData);
		const isLinear = numStages <= 1;

		this.panels.cp.SetDialogVariable('mapname', mapData.staticData.name);
		this.panels.cp.SetDialogVariableInt('tier', mainTrackTier ?? 0);
		this.panels.cp.SetDialogVariableInt('stageCount', numStages);
		this.panels.cp.SetDialogVariable(
			'tracktype',
			$.Localize(isLinear ? '#MapInfo_Type_Linear' : '#MapInfo_Type_Staged')
		);
		if (numBonuses > 0) {
			this.panels.cp.SetDialogVariableInt('bonusCount', numBonuses);
		}

		this.panels.cp.SetDialogVariable('author', getAuthorNames(mapData.staticData));

		this.panels.mapName.visible = true;
		this.panels.author.visible = true;
		this.panels.tierAndType.visible = true;
		this.panels.stageCountLabel.visible = !isLinear;
		this.panels.bonusCountLabel.visible = numBonuses === 1;
		this.panels.bonusesCountLabel.visible = numBonuses > 1;

		this.panels.backgroundImage.SetImage(mapData.staticData.thumbnail.large);
	}
}
