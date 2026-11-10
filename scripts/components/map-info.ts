import { PanelHandler } from 'util/module-helpers';
import { SteamGame } from 'common/web/enums/steam-game.enum';
import { SteamGamesNames } from 'common/web/maps/steam-games.map';
import * as Maps from 'common/maps';
import * as Leaderboards from 'common/leaderboard';

@PanelHandler({ exposeToPanel: true })
export class MapInfoHandler {
	readonly panels = {
		cp: $.GetContextPanel<MapInfo>(),
		container: $<Panel>('#MapInfoContainer'),
		linearSeparator: $<Label>('#HudTabMenuLinearSeparator'),
		linearLabel: $<Label>('#HudTabMenuLinearLabel'),
		stageCountSeparator: $<Label>('#HudTabMenuStageCountSeparator'),
		stageCountLabel: $<Label>('#HudTabMenuStageCountLabel'),
		bonusCountSeparator: $<Label>('#HudTabMenuBonusCountSeparator'),
		bonusCountLabel: $<Label>('#HudTabMenuBonusCountLabel'),
		bonusesCountLabel: $<Label>('#HudTabMenuBonusesCountLabel'),
		listTypes: {
			ranked: $<Button>('#MapListRanked'),
			unranked: $<Button>('#MapListUnranked'),
			beta: $<Button>('#MapListBeta')
		}
	};

	readonly requiredGames = [
		[$('#CSS'), SteamGame.CSS] as const,
		[$('#CSGO'), SteamGame.CSGO] as const,
		[$('#TF2'), SteamGame.TF2] as const,
		[$('#Portal2'), SteamGame.PORTAL2] as const
	];

	blurPanel: HudBlurTarget | null = null;
	mapSelector: MomentumMapSelector | null = null;

	setBlurPanel(panel: HudBlurTarget) {
		this.blurPanel = panel;

		this.panels.container.SetPanelEvent('onmouseover', () => {
			this.panels.container.style.backgroundColor = 'rgba(70, 70, 70, 0.1)';
			this.blurPanel.AddBlurPanel(this.panels.container);
		});

		this.panels.container.SetPanelEvent('onmouseout', () => {
			this.panels.container.style.backgroundColor = 'rgba(0, 0, 0, 0)';
			this.blurPanel.RemoveBlurPanel(this.panels.container);
		});
	}

	setMapSelector(panel: MomentumMapSelector) {
		this.mapSelector = panel;
	}

	updateMapInfo(mapData: MapCacheAPI.MapData) {
		const gamemode = GameModeAPI.GetMetaGameMode();
		const mainTrackTier = Maps.getTier(mapData.staticData, gamemode);
		const numStages = Leaderboards.getNumStages(mapData.staticData);
		const numBonuses = Leaderboards.getNumBonuses(mapData.staticData);
		const isLinear = numStages <= 1;

		this.panels.cp.SetDialogVariable('name', mapData.staticData.name);

		this.panels.cp.SetDialogVariableInt('tier', mainTrackTier ?? 0);
		this.panels.linearSeparator.visible = isLinear;
		this.panels.linearLabel.visible = isLinear;
		this.panels.stageCountSeparator.visible = !isLinear;
		this.panels.stageCountLabel.visible = !isLinear;
		if (!isLinear) {
			this.panels.cp.SetDialogVariableInt('stageCount', numStages);
		}
		this.panels.bonusCountSeparator.visible = numBonuses > 0;
		this.panels.bonusCountLabel.visible = numBonuses === 1;
		this.panels.bonusesCountLabel.visible = numBonuses > 1;
		if (numBonuses > 0) {
			this.panels.cp.SetDialogVariableInt('bonusCount', numBonuses);
		}

		this.updateRequiredGames(mapData.staticData);

		this.panels.container.SetPanelEvent('onactivate', () => {
			this.openGallery(mapData);
		});
	}

	private updateRequiredGames(staticData: MapCacheAPI.StaticData) {
		if (!staticData.info?.requiredGames) {
			this.requiredGames.forEach(([panel]) => {
				panel.AddClass('map-info-container__required-game--hidden');
			});

			return;
		}

		const mountedGames = GameInterfaceAPI.GetMountedSteamApps();
		this.requiredGames.forEach(([panel, game]) => {
			const unmounted = !mountedGames.includes(game);
			panel.SetHasClass(
				'map-info-container__required-game--hidden',
				!staticData.info.requiredGames.includes(game)
			);
			panel.SetHasClass('map-info-container__required-game--unmounted', unmounted);

			if (unmounted) {
				panel.SetDialogVariable('game', SteamGamesNames.get(game));
				panel.SetPanelEvent('onmouseover', () => {
					// English is "Missing assets for game: "
					UiToolkitAPI.ShowTextTooltip(
						panel.id,
						'<span class="map-info-container__required-game__tooltip--left">' +
							$.Localize('#MapSelector_RequiredGames_Tooltip') +
							'</span><span class="map-info-container__required-game__tooltip--right">' +
							SteamGamesNames.get(game) +
							'</span>'
					);
				});
			} else {
				panel.ClearPanelEvent('onmouseover');
			}
		});
	}

	private openGallery(mapData: MapCacheAPI.MapData) {
		if (!this.mapSelector) {
			$.Warning("Map info doesn't have access to Map Selector panel");
			return;
		}

		const gallery = UiToolkitAPI.ShowCustomLayoutPopup<Gallery>(
			'MapSelectorGallery',
			'file://{resources}/layout/components/gallery.xml'
		);

		gallery.handler.init(this.mapSelector, mapData.staticData);
	}
}
