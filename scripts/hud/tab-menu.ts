import { PanelHandler } from 'util/module-helpers';
import { EndOfRunShowReason } from 'common/timer';
import { GamemodeInfo, MapCredit, MapCreditType, MMap } from 'common/web';
import { getMainTrack, getNumZones } from 'common/leaderboard';

/**
 * Class for the HUD tab menu panel, which contains the leaderboards, end of run, and zoning.
 */
@PanelHandler()
class HudTabMenuHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTabMenu>(),
		mapInfo: $<MapInfo>('#HudTabMenuMapInfo'),
		runListingsContainer: $<Panel>('#RunListingsContainer'),
		endOfRunContainer: $<Panel>('#EndOfRunContainer'),
		zoningContainer: $<Panel>('#ZoningContainer'),
		zoningOpen: $<Button>('#ZoningOpen'),
		zoningClose: $<Button>('#ZoningClose'),
		gamemodeIcon: $<Image>('#HudTabMenuGamemodeImage'),
		credits: $<Panel>('#HudTabMenuMapCredits')
	};

	constructor() {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.setMapData(isOfficial));
		$.RegisterForUnhandledEvent('HudTabMenu_ForceClose', () => this.close());
		$.RegisterForUnhandledEvent('EndOfRun_Show', (reason) => this.showEndOfRun(reason));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', () => this.hideEndOfRun());
		$.RegisterForUnhandledEvent('ZoneMenu_Show', () => this.showZoneMenu());
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', () => this.hideZoneMenu());

		this.panels.mapInfo.handler.setFromActiveMap();
	}

	showEndOfRun(reason: EndOfRunShowReason) {
		this.panels.runListingsContainer.AddClass('hud-tab-menu__runlistings--hidden');
		this.panels.endOfRunContainer.RemoveClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	hideEndOfRun() {
		this.panels.runListingsContainer.RemoveClass('hud-tab-menu__runlistings--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	showZoneMenu() {
		this.panels.cp.AddClass('hud-tab-menu--offset');
		this.panels.runListingsContainer.AddClass('hud-tab-menu__runlistings--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.RemoveClass('hud-tab-menu__zoning--hidden');
	}

	hideZoneMenu() {
		this.panels.cp.RemoveClass('hud-tab-menu--offset');
		this.panels.runListingsContainer.RemoveClass('hud-tab-menu__runlistings--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	setMapData(isOfficial: boolean) {
		$.GetContextPanel().SetHasClass('hud-tab-menu--unofficial', !isOfficial);

		const img = GamemodeInfo.get(GameModeAPI.GetCurrentGameMode()).icon;

		this.panels.gamemodeIcon.SetImage(`file://{images}/gamemodes/${img}.svg`);

		const mapData = MapCacheAPI.GetCurrentMapData();

		if (mapData && isOfficial) {
			this.setMapAuthorCredits(mapData.credits);
		}
	}

	setMapAuthorCredits(credits: MapCredit[]) {
		// Delete existing name labels
		for (const label of this.panels.credits.Children().slice(1) || []) {
			label.DeleteAsync(0);
		}

		const authorCredits = credits.filter(({ type }) => type === MapCreditType.AUTHOR);

		for (const credit of authorCredits) {
			const namePanel = $.CreatePanel('Label', this.panels.credits, '', {
				text: credit.user.alias
			});

			namePanel.AddClass('hud-tab-menu-map-info__credits-name');

			if (credit.user.steamID) {
				// TODO: Perhaps better if left-click just loads momentum profile? Can access steam through that,
				// and profile pages no longer require a login to view.
				namePanel.SetPanelEvent('oncontextmenu', () => {
					UiToolkitAPI.ShowSimpleContextMenu('', '', [
						{
							label: $.Localize('#Action_ShowSteamProfile'),
							jsCallback: () => {
								SteamOverlayAPI.OpenToProfileID(credit.user.steamID);
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

	close() {
		this.panels.cp.forceCloseTabMenu();
		return true;
	}
}
