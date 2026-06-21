import { PanelHandler } from 'util/module-helpers';
import { SteamGame } from 'common/web/enums/steam-game.enum';
import { SteamGamesNames } from 'common/web/maps/steam-games.map';
import * as Maps from 'common/maps';
import * as Leaderboards from 'common/leaderboard';

export interface MapInfoInterface extends MapInfo {
	updateMapInfo: (mapData: MapCacheAPI.MapData) => void;
	setBlurPanel: (panel: HudBlurTarget) => void;
	setMapSelector: (panel: MomentumMapSelector) => void;
}

@PanelHandler()
class MapInfoHandler {
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

	constructor() {
		const mapInfoInterface = this.panels.cp as MapInfoInterface;
		mapInfoInterface.updateMapInfo = (mapData: MapCacheAPI.MapData) => this.updateMapInfo(mapData);
		mapInfoInterface.setBlurPanel = (panel: HudBlurTarget) => this.setBlurPanel(panel);
		mapInfoInterface.setMapSelector = (panel: MomentumMapSelector) => (this.mapSelector = panel);
	}

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

		// info.SetDialogVariable('description', staticData.info?.description);
		// this.panels.descriptionContainer.SetHasClass('hide', !staticData.info?.description);

		// info.SetDialogVariable('date', new Date(staticData.info?.creationDate)?.toLocaleDateString());
		// this.panels.datesContainer.SetHasClass('hide', !staticData.info?.creationDate);

		// const pb = Leaderboards.getUserMapDataTrack(userData, gamemode);
		// if (pb) {
		// 	info.SetDialogVariableFloat('personal_best', pb.time);
		// 	info.FindChildTraverse('MapInfoPB').visible = true;
		// 	info.FindChildTraverse('MapInfoNoPB').visible = false;
		// } else {
		// 	info.FindChildTraverse('MapInfoPB').visible = false;
		// 	info.FindChildTraverse('MapInfoNoPB').visible = true;
		// }

		// const inSubmission = MapStatuses.IN_SUBMISSION.includes(staticData.status);
		// info.SetHasClass('mapselector-map-info--submission', inSubmission);

		// if (inSubmission) {
		// 	const { status, tooltip } = this.strings.statuses.get(staticData.status);
		// 	this.panels.info.SetDialogVariable('status', status);
		// 	this.panels.info.SetDialogVariable('status_tooltip', tooltip);

		// 	this.panels.submissionStatus.visible = true;

		// 	const hasChangelog = staticData.versions.length > 1;
		// 	this.panels.changelog.visible = hasChangelog;
		// 	if (hasChangelog) {
		// 		const container = this.panels.changelog.GetChild(1);
		// 		container.RemoveAndDeleteChildren();

		// 		staticData.versions
		// 			// Data doesn't seem always ordered by versionNum (?) so doing a sort
		// 			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		// 			.forEach(({ changelog }, i, arr) => {
		// 				$.CreatePanel('Label', container, '', {
		// 					class: 'mapselector-map-info__h3',
		// 					text: $.Localize('#MapSelector_Info_Changelog_Version').replace(
		// 						'%version%',
		// 						(arr.length - i).toString()
		// 					)
		// 				});
		// 				// First version doesn't necessarily have a changelog
		// 				if (changelog) {
		// 					$.CreatePanel('Label', container, '', {
		// 						text: changelog,
		// 						class: 'mapselector-map-info__changelog-text'
		// 					});
		// 				}
		// 			});
		// 	}
		// } else {
		// 	this.panels.submissionStatus.visible = false;
		// 	this.panels.changelog.visible = false;
		// 	this.panels.info.SetDialogVariable('status', '');
		// 	this.panels.info.SetDialogVariable('status_tooltip', '');
		// }
	}

	updateRequiredGames(staticData: MapCacheAPI.StaticData) {
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

	openGallery(mapData: MapCacheAPI.MapData) {
		if (!this.mapSelector) {
			$.Warning("Map info doesn't have access to Map Selector panel");
			return;
		}

		const gallery = UiToolkitAPI.ShowCustomLayoutPopup<Gallery>(
			'MapSelectorGallery',
			'file://{resources}/layout/components/gallery.xml'
		);

		gallery.handler.init(
			this.mapSelector,
			mapData.staticData
			// mapData.staticData.images?.map(({ id }) => id) ?? [],
			// parseMapImageUrl(mapData.staticData) ?? ''
		);
	}
}
