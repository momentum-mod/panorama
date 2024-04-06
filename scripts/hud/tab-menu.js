/**
 * Class for the HUD tab menu panel, which contains the leaderboards, end of run, and zoning.
 */
class HudTabMenu {
	static panels = {
		/** @type {Panel} @static */
		tabMenu: $.GetContextPanel(),
		/** @type {Panel} @static */
		leaderboardsContainer: $('#LeaderboardsContainer'),
		/** @type {Panel} @static */
		endOfRunContainer: $('#EndOfRunContainer'),
		/** @type {Panel} @static */
		zoningContainer: $('#ZoningContainer'),
		/** @type {Image} @static */
		gamemodeImage: $('#HudTabMenuGamemodeImage'),
		/** @type {Panel} @static */
		credits: $('#HudTabMenuMapCredits')
	};

	static {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', this.setMapData.bind(this));
		$.RegisterForUnhandledEvent('HudTabMenu_ForceClose', this.close.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Show', this.showEndOfRun.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', this.hideEndOfRun.bind(this));
		$.RegisterForUnhandledEvent('ZoneMenu_Show', this.showZoneMenu.bind(this));
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', this.hideZoneMenu.bind(this));
	}

	static showEndOfRun(_showReason) {
		this.panels.leaderboardsContainer.AddClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.RemoveClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	static hideEndOfRun() {
		this.panels.leaderboardsContainer.RemoveClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	static showZoneMenu() {
		this.panels.tabMenu.AddClass('hud-tab-menu--offset');
		this.panels.leaderboardsContainer.AddClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.RemoveClass('hud-tab-menu__zoning--hidden');
	}

	static hideZoneMenu() {
		this.panels.tabMenu.RemoveClass('hud-tab-menu--offset');
		this.panels.leaderboardsContainer.RemoveClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	static setMapData(isOfficial) {
		$.GetContextPanel().SetHasClass('hud-tab-menu--unofficial', !isOfficial);

		const img = GameModeInfoWithNull[GameModeAPI.GetCurrentGameMode()].idName.toLowerCase();

		this.panels.gamemodeImage.SetImage(`file://{images}/gamemodes/${img}.svg`);

		const mapData = MapCacheAPI.GetCurrentMapData();

		if (mapData && isOfficial) {
			this.setMapStats(mapData);
			this.setMapAuthorCredits(mapData.credits);
		}
	}

	static setMapAuthorCredits(credits) {
		// Delete existing name labels
		for (const label of this.panels.credits.Children().slice(1) || []) label.DeleteAsync(0);

		const authorCredits = credits.filter((x) => x.type === MapCreditType.AUTHOR);

		for (const credit of authorCredits) {
			const namePanel = $.CreatePanel('Label', this.panels.credits, '', {
				text: credit.user.alias
			});

			namePanel.AddClass('hud-tab-menu-map-info__credits-name');

			if (credit.user.xuid !== '0') {
				namePanel.SetPanelEvent('oncontextmenu', () => {
					UiToolkitAPI.ShowSimpleContextMenu('', '', [
						{
							label: $.Localize('#Action_ShowSteamProfile'),
							jsCallback: () => {
								SteamOverlayAPI.OpenToProfileID(credit.user.xuid);
							}
						}
					]);
				});
			} else {
				namePanel.AddClass('hud-tab-menu-map-info__credits-name--no-steam');
			}

			// hoped this would make contextmenu work but it doesn't
			if (authorCredits.indexOf(credit) < authorCredits.length - 1) {
				const commaPanel = $.CreatePanel('Label', this.panels.credits, '');
				commaPanel.AddClass('hud-tab-menu-map-info__credits-other-text');
				commaPanel.text = ',';
			}
		}
	}

	static setMapStats(data) {
		const cp = $.GetContextPanel();

		const mainTrack = getMainTrack(data, GameModeAPI.GetCurrentGameMode());
		const numZones = getNumZones(data);

		cp.SetDialogVariableInt('tier', mainTrack?.tier ?? 0);
		cp.SetDialogVariable('type', $.Localize(mainTrack?.isLinear ? '#MapInfo_Type_Linear' : '#MapInfo_Type_Staged'));
		cp.SetDialogVariableInt('numzones', numZones);
		cp.SetDialogVariableInt('runs', data.stats?.completions);
	}

	static close() {
		$.GetContextPanel().forceCloseTabMenu();
		return true;
	}
}
