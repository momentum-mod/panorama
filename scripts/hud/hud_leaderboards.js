'use strict';

class HudLeaderboards {
	static gamemodeImage = $('#HudLeaderboardsGamemodeImage');
	static creditsPanel = $('#HudLeaderboardsMapCredits');
	static statsPanelPB = $('#HudLeaderboardsInfoPB');
	static statsPanelTier = $('#HudLeaderboardsInfoTier');
	static statsPanelStagedLinear = $('#HudLeaderboardsInfoStagedLinear');
	static statsPanelZones = $('#HudLeaderboardsInfoZones');
	static statsPanelNumRuns = $('#HudLeaderboardsInfoNumRuns');

	static {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', HudLeaderboards.setMapData);
		// $.RegisterForUnhandledEvent('HudLeaderboards_Opened', HudLeaderboards.onOpened);
		// $.RegisterForUnhandledEvent('HudLeaderboards_Closed', HudLeaderboards.onClosed);
	}

	static setMapData(isOfficial) {
		$.GetContextPanel().SetHasClass('hud-leaderboards--unofficial', !isOfficial);

		let img = '';
		switch (GameModeAPI.GetCurrentGameMode()) {
			case 1:
				img = 'surf';
				break;
			case 2:
				img = 'bhop';
				break;
			case 3:
				img = 'climb';
				break;
			case 4:
				img = 'rj';
				break;
			case 5:
				img = 'sj';
				break;
			case 6:
				img = 'tricksurf';
				break;
			case 7:
				img = 'ahop';
				break;
			case 8:
				img = 'parkour';
				break;
			case 9:
				img = 'conc';
				break;
			case 10:
				img = 'defrag';
				break;
			case 0:
			default:
				img = 'null';
				break;
		}

		HudLeaderboards.gamemodeImage.SetImage(`file://{images}/gamemodes/${img}.svg`);

		const mapData = MapCacheAPI.GetCurrentMapData();

		if (mapData && isOfficial) {
			HudLeaderboards.setMapStats(mapData);
			HudLeaderboards.setMapAuthorCredits(mapData.credits);
		}
	}

	static setMapAuthorCredits(credits) {
		// Delete existing name labels
		HudLeaderboards.creditsPanel
			.Children()
			.slice(1) // Keep the "by" label
			?.forEach((child) => child.DeleteAsync(0.0));

		const authorCredits = credits.filter((x) => x.type === 'author');

		authorCredits.forEach((credit) => {
			let namePanel = $.CreatePanel('Label', HudLeaderboards.creditsPanel, '', {
				text: credit.user.alias
			});

			namePanel.AddClass('hud-leaderboards-map-info__credits-name');

			if (credit.user.xuid !== '0') {
				namePanel.SetPanelEvent('oncontextmenu', () => {
					UiToolkitAPI.ShowSimpleContextMenu('', '', [
						{
							label: 'Show Steam Profile',
							jsCallback: () => {
								SteamOverlayAPI.OpenToProfileID(credit.user.xuid);
							}
						}
					]);
				});
			} else {
				namePanel.AddClass('hud-leaderboards-map-info__credits-name--no-steam');
			}

			// hoped this would make contextmenu work but it dont
			if (authorCredits.indexOf(credit) < authorCredits.length - 1) {
				let commaPanel = $.CreatePanel('Label', HudLeaderboards.creditsPanel, '');
				commaPanel.AddClass('hud-leaderboards-map-info__credits-other-text');
				commaPanel.text = ',';
			}
		});
	}

	static setMapStats(data) {
		$.GetContextPanel().SetDialogVariable('tier', 'Tier ' + data.mainTrack?.difficulty);
		$.GetContextPanel().SetDialogVariable('type', data.mainTrack?.isLinear ? 'Linear' : 'Staged');
		$.GetContextPanel().SetDialogVariable('zones', data.mainTrack?.numZones + ' Zones');
		$.GetContextPanel().SetDialogVariable('numruns', data.stats?.completes + ' Runs');
	}

	static close() {
		$.GetContextPanel().forceCloseLeaderboards();
		return true;
	}
}
