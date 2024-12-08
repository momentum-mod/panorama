import { PanelHandler } from 'util/module-helpers';
import { EndOfRunShowReason } from 'common/timer';
import { GamemodeInfo, MapCreditType, MMap } from 'common/web';
import { getNumStages } from 'common/leaderboard';
import { getAllCredits, getTier, SimpleMapCredit } from 'common/maps';

/**
 * Class for the HUD tab menu panel, which contains the leaderboards, end of run, and zoning.
 */
@PanelHandler()
class HudTabMenuHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTabMenu>(),
		leaderboardsContainer: $<Panel>('#LeaderboardsContainer'),
		endOfRunContainer: $<Panel>('#EndOfRunContainer'),
		zoningContainer: $<Panel>('#ZoningContainer'),
		zoningOpen: $<Button>('#ZoningOpen'),
		zoningClose: $<Button>('#ZoningClose'),
		gamemodeIcon: $<Image>('#HudTabMenuGamemodeImage'),
		credits: $<Panel>('#HudTabMenuMapCredits'),
		linearSeparator: $<Label>('#HudTabMenuLinearSeparator'),
		linearLabel: $<Label>('#HudTabMenuLinearLabel'),
		stageCountSeparator: $<Panel>('#HudTabMenuStageCountSeparator'),
		stageCountLabel: $<Label>('#HudTabMenuStageCountLabel')
	};

	constructor() {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.setMapData(isOfficial));
		$.RegisterForUnhandledEvent('HudTabMenu_ForceClose', () => this.close());
		$.RegisterForUnhandledEvent('EndOfRun_Show', (reason) => this.showEndOfRun(reason));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', () => this.hideEndOfRun());
		$.RegisterForUnhandledEvent('ZoneMenu_Show', () => this.showZoneMenu());
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', () => this.hideZoneMenu());
		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => this.hideZoneMenu());
		$.RegisterForUnhandledEvent('ActiveZoneDefsChanged', () => this.updateMapStats());
	}

	showEndOfRun(reason: EndOfRunShowReason) {
		this.panels.leaderboardsContainer.AddClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.RemoveClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	hideEndOfRun() {
		this.panels.leaderboardsContainer.RemoveClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	showZoneMenu() {
		this.panels.cp.AddClass('hud-tab-menu--offset');
		this.panels.leaderboardsContainer.AddClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.RemoveClass('hud-tab-menu__zoning--hidden');
	}

	hideZoneMenu() {
		this.panels.cp.RemoveClass('hud-tab-menu--offset');
		this.panels.leaderboardsContainer.RemoveClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
		this.panels.zoningContainer.AddClass('hud-tab-menu__zoning--hidden');
	}

	setMapData(isOfficial: boolean) {
		$.GetContextPanel().SetHasClass('hud-tab-menu--unofficial', !isOfficial);

		const img = GamemodeInfo.get(GameModeAPI.GetCurrentGameMode()).icon;

		this.panels.gamemodeIcon.SetImage(`file://{images}/gamemodes/${img}.svg`);

		const mapData = MapCacheAPI.GetCurrentMapData();

		if (mapData && isOfficial) {
			this.setMapStats(mapData.staticData);
			this.setMapAuthorCredits(getAllCredits(mapData.staticData, MapCreditType.AUTHOR));
		}
	}

	setMapAuthorCredits(credits: SimpleMapCredit[]) {
		// Delete existing name labels
		this.panels.credits.Children()?.forEach((label) => label.DeleteAsync(0));

		if (credits.length === 0) {
			return;
		}

		$.CreatePanel('Label', this.panels.credits, '', {
			class: 'hud-tab-menu-map-info__credits-other-text',
			text: $.Localize('#Common_By')
		});

		for (const [idx, { alias, steamID }] of credits.entries()) {
			const namePanel = $.CreatePanel('Label', this.panels.credits, '', {
				text: alias
			});

			namePanel.AddClass('hud-tab-menu-map-info__credits-name');

			if (steamID) {
				namePanel.AddClass('hud-tab-menu-map-info__credits-name--steam');

				// TODO: Should be an onactivate (left click, not right), and open player card component,
				// once that's made.
				namePanel.SetPanelEvent('oncontextmenu', () => {
					UiToolkitAPI.ShowSimpleContextMenu('', '', [
						{
							label: $.Localize('#Action_ShowSteamProfile'),
							jsCallback: () => {
								SteamOverlayAPI.OpenToProfileID(steamID);
							}
						}
					]);
				});
			}

			// hoped this would make contextmenu work but it doesn't
			if (idx < credits.length - 1) {
				const commaPanel = $.CreatePanel('Label', this.panels.credits, '');
				commaPanel.AddClass('hud-tab-menu-map-info__credits-other-text');
				commaPanel.text = ',';
			}
		}
	}

	updateMapStats() {
		const mapData = MapCacheAPI.GetCurrentMapData();
		if (mapData) {
			this.setMapStats(mapData.staticData);
		}
	}

	setMapStats(mapData: MMap) {
		this.panels.cp.forceCloseTabMenu();

		const mainTrackTier = getTier(mapData, GameModeAPI.GetCurrentGameMode());
		const numStages = getNumStages(mapData);
		const isLinear = numStages <= 1;

		this.panels.cp.SetDialogVariableInt('tier', mainTrackTier ?? 0);
		this.panels.linearSeparator.visible = isLinear;
		this.panels.linearLabel.visible = isLinear;
		this.panels.stageCountSeparator.visible = !isLinear;
		this.panels.stageCountLabel.visible = !isLinear;
		if (!isLinear) {
			this.panels.cp.SetDialogVariableInt('stageCount', numStages);
		}
		this.panels.cp.SetDialogVariableInt('runs', mapData.stats?.completions);
	}

	close() {
		this.panels.cp.forceCloseTabMenu();
		return true;
	}
}
