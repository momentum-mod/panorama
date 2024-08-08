"use strict";
class LoadingScreen {
    static panels = {
        cp: $.GetContextPanel(),
        backgroundImage: $('#BackgroundImage'),
        progressBar: $('#ProgressBar'),
        mapName: $('#MapName'),
        author: $('#Author'),
        tierAndType: $('#TierAndType'),
        numZones: $('#NumZones')
    };
    static {
        $.RegisterForUnhandledEvent('MapCache_MapLoad', this.updateLoadingScreenInfo.bind(this));
        $.RegisterForUnhandledEvent('UnloadLoadingScreenAndReinit', this.init.bind(this));
        $.RegisterEventHandler('PanelLoaded', this.panels.backgroundImage, () => (this.panels.backgroundImage.visible = true));
        $.RegisterEventHandler('ImageFailedLoad', this.panels.backgroundImage, () => (this.panels.backgroundImage.visible = false));
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
        if (!mapName)
            return;
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
        const mainTrack = _.Util.getMainTrack(mapData, GameModeAPI.GetCurrentGameMode());
        const numZones = _.Util.getNumZones(mapData);
        this.panels.cp.SetDialogVariable('mapname', mapData.name);
        this.panels.cp.SetDialogVariableInt('tier', mainTrack?.tier ?? 0);
        this.panels.cp.SetDialogVariableInt('numzones', numZones);
        this.panels.cp.SetDialogVariable('tracktype', mainTrack?.linear ? 'Linear' : 'Staged');
        let authorString = '';
        for (const [i, item] of mapData.credits.filter((x) => x.type === _.Web.MapCreditType.AUTHOR).entries())
            authorString += (i > 0 ? ', ' : '') + item.user.alias;
        this.panels.cp.SetDialogVariable('author', authorString);
        this.panels.mapName.visible = true;
        this.panels.author.visible = true;
        this.panels.tierAndType.visible = true;
        this.panels.numZones.visible = true;
        this.panels.backgroundImage.SetImage(mapData.thumbnail.large);
    }
}
