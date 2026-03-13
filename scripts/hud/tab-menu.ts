import { PanelHandler } from 'util/module-helpers';
import { EndOfRunShowReason } from 'common/timer';
import { GamemodeInfo } from 'common/gamemode';
import { MapCreditType } from 'common/web/enums/map-credit-type.enum';
import type { MMap } from 'common/web/types/models/models';
import { getNumStages } from 'common/leaderboard';
import { getAllCredits, getTier, SimpleMapCredit } from 'common/maps';
import { MapStatuses } from 'common/web/enums/map-status.enum';

/**
 * Class for the HUD tab menu panel, which contains the leaderboards, end of run, and zoning.
 */
@PanelHandler()
class HudTabMenuHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudTabMenu>(),
		sidebysideContainer: $<Panel>('#SideBySideContainer'),
		endOfRunContainer: $<Panel>('#EndOfRunContainer'),
		zoningOpen: $<Button>('#ZoningOpen'),
		zoningClose: $<Button>('#ZoningClose'),
		gamemodeIcon: $<Image>('#HudTabMenuGamemodeImage'),
		credits: $<Panel>('#HudTabMenuMapCredits'),
		linearSeparator: $<Label>('#HudTabMenuLinearSeparator'),
		linearLabel: $<Label>('#HudTabMenuLinearLabel'),
		stageCountSeparator: $<Panel>('#HudTabMenuStageCountSeparator'),
		stageCountLabel: $<Label>('#HudTabMenuStageCountLabel'),
		betaInfoContainer: $<Panel>('#BetaInfoContainer')
	};

	constructor() {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', (isOfficial) => this.setMapData(isOfficial));
		$.RegisterForUnhandledEvent('HudTabMenu_ForceClose', () => this.close());
		$.RegisterForUnhandledEvent('EndOfRun_Show', (reason) => this.showEndOfRun(reason));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', () => this.hideEndOfRun());
		$.RegisterForUnhandledEvent('ActiveZoneDefsChanged', () => this.updateMapStats());
		$.RegisterForUnhandledEvent('MapCache_MapLoad', () => this.onMapLoad());
	}

	openInSteamOverlay() {
		const mapData = MapCacheAPI.GetCurrentMapData();
		const frontendUrl = GameInterfaceAPI.GetSettingString('mom_api_url_frontend');
		if (mapData && frontendUrl) {
			SteamOverlayAPI.OpenURL(`${frontendUrl}/maps/${mapData.staticData.name}`);
		}
	}

	onMapLoad() {
		const mapData = MapCacheAPI.GetCurrentMapData();
		if (!mapData) return;

		this.panels.betaInfoContainer.SetHasClass(
			'hide',
			!MapStatuses.IN_SUBMISSION.includes(mapData.staticData.status)
		);
	}

	showEndOfRun(reason: EndOfRunShowReason) {
		this.panels.sidebysideContainer.AddClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.RemoveClass('hud-tab-menu__endofrun--hidden');
	}

	hideEndOfRun() {
		this.panels.sidebysideContainer.RemoveClass('hud-tab-menu__leaderboards--hidden');
		this.panels.endOfRunContainer.AddClass('hud-tab-menu__endofrun--hidden');
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
