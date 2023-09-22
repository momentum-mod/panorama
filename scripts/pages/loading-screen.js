class LoadingScreen {
	static panels = {
		/** @type {Panel} @static */
		cp: $.GetContextPanel(),
		/** @type {Image} @static */
		backgroundImage: $('#BackgroundImage'),
		/** @type {ProgressBar} @static */
		progressBar: $('#ProgressBar'),
		/** @type {Label} @static */
		mapName: $('#MapName'),
		/** @type {Label} @static */
		author: $('#Author'),
		/** @type {Label} @static */
		tierAndType: $('#TierAndType'),
		/** @type {Label} @static */
		numZones: $('#NumZones')
	};

	static {
		$.RegisterForUnhandledEvent('MapCache_MapLoad', this.updateLoadingScreenInfo.bind(this));
		$.RegisterForUnhandledEvent('UnloadLoadingScreenAndReinit', this.init.bind(this));

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

	static init() {
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

	static updateLoadingScreenInfo(mapName) {
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

		this.panels.cp.SetDialogVariable('mapname', mapData.name);
		this.panels.cp.SetDialogVariableInt('tier', mapData.mainTrack.difficulty);
		this.panels.cp.SetDialogVariableInt('numzones', mapData.mainTrack.numZones);
		this.panels.cp.SetDialogVariable('tracktype', mapData.mainTrack.isLinear ? 'Linear' : 'Staged');

		let authorString = '';
		for (const [i, item] of mapData.credits.filter((x) => x.type === 'author').entries())
			authorString += (i > 0 ? ', ' : '') + item.user.alias;
		this.panels.cp.SetDialogVariable('author', authorString);

		this.panels.mapName.visible = true;
		this.panels.author.visible = true;
		this.panels.tierAndType.visible = true;
		this.panels.numZones.visible = true;

		this.panels.backgroundImage.SetImage(mapData.thumbnail.urlLarge);
	}
}
