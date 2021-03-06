'use strict';

/**
 * Class for the HUD leaderboards panel, which contains the leaderboards and end of run.
 */
class HudLeaderboards {
	static panels = {
		/** @type {Panel} @static */
		leaderboardsContainer: $('#LeaderboardsContainer'),
		/** @type {Panel} @static */
		endOfRunContainer: $('#EndOfRunContainer'),
		/** @type {Image} @static */
		gamemodeImage: $('#HudLeaderboardsGamemodeImage'),
		/** @type {Panel} @static */
		credits: $('#HudLeaderboardsMapCredits')
	};

	static {
		$.RegisterForUnhandledEvent('Leaderboards_MapDataSet', this.setMapData.bind(this));
		$.RegisterForUnhandledEvent('HudLeaderboards_ForceClose', this.close.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Show', this.showEndOfRun.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Hide', this.hideEndOfRun.bind(this));

		//$.RegisterForUnhandledEvent('HudLeaderboards_Opened', this.onOpened);
		//$.RegisterForUnhandledEvent('HudLeaderboards_Closed', this.onClosed);
	}

	static showEndOfRun(_showReason) {
		this.panels.leaderboardsContainer.AddClass('hud-leaderboards__leaderboards--hidden');
		this.panels.endOfRunContainer.RemoveClass('hud-leaderboards__endofrun--hidden');
	}

	static hideEndOfRun() {
		this.panels.leaderboardsContainer.RemoveClass('hud-leaderboards__leaderboards--hidden');
		this.panels.endOfRunContainer.AddClass('hud-leaderboards__endofrun--hidden');
	}

	static setMapData(isOfficial) {
		$.GetContextPanel().SetHasClass('hud-leaderboards--unofficial', !isOfficial);

		const img = GAMEMODE_WITH_NULL[GameModeAPI.GetCurrentGameMode()].shortName.toLowerCase();

		this.panels.gamemodeImage.SetImage(`file://{images}/gamemodes/${img}.svg`);

		const mapData = MapCacheAPI.GetCurrentMapData();

		if (mapData && isOfficial) {
			this.setMapStats(mapData);
			this.setMapAuthorCredits(mapData.credits);
		}
	}

	static setMapAuthorCredits(credits) {
		// Delete existing name labels
		this.panels.credits
			.Children()
			.slice(1) // Keep the "by" label
			?.forEach((child) => child.DeleteAsync(0.0));

		const authorCredits = credits.filter((x) => x.type === 'author');

		authorCredits.forEach((credit) => {
			let namePanel = $.CreatePanel('Label', this.panels.credits, '', {
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
				let commaPanel = $.CreatePanel('Label', this.panels.credits, '');
				commaPanel.AddClass('hud-leaderboards-map-info__credits-other-text');
				commaPanel.text = ',';
			}
		});
	}

	static setMapStats(data) {
		const cp = $.GetContextPanel();

		cp.SetDialogVariable('tier', 'Tier ' + data.mainTrack?.difficulty);
		cp.SetDialogVariable('type', data.mainTrack?.isLinear ? 'Linear' : 'Staged');
		cp.SetDialogVariable('zones', data.mainTrack?.numZones + ' Zones');
		cp.SetDialogVariable('numruns', data.stats?.completes + ' Runs');
	}

	static close() {
		$.GetContextPanel().forceCloseLeaderboards();
		return true;
	}
}
