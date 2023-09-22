class Profile {
	static panels = {
		levelIndicatorsContainer: $('#ProfileLevelIndicators'),
		prestigeIndicator: $('#ProfileLevelIndicatorPrestige'),
		levelIndicator: $('#ProfileLevelIndicatorLevel'),
		levelInfo: $('#LevelInfoButton')
	};

	static onLoad() {
		this.update();
	}

	static update() {
		const cp = $.GetContextPanel();

		const level = MomentumAPI.GetPlayerLevel();
		const xp = MomentumAPI.GetPlayerXp();
		const currLevelXp = MomentumAPI.GetCosmeticXpForLevel(level % 500); // currently errors out levels past 500??
		const nextLevelXp = MomentumAPI.GetCosmeticXpForLevel((level % 500) + 1);
		const money = MomentumAPI.GetPlayerMoney();

		cp.SetDialogVariable('name', FriendsAPI.GetLocalPlayerName());
		cp.SetDialogVariableInt('level', level);
		cp.SetDialogVariableInt('xp', xp - currLevelXp);
		cp.SetDialogVariableInt('totalxp', nextLevelXp - currLevelXp);
		cp.SetDialogVariableInt('money', money);
		cp.SetDialogVariableInt('totalxp', xp);

		this.updateLevelIndicators(level);
	}

	/**
	 * Set a new level in the two levels indicator components
	 * @param {number} level - the new level
	 */
	static updateLevelIndicators(level) {
		const indicatorClass = this.panels.prestigeIndicator.jsClass;
		for (let i = 1; i <= 10; i++) {
			this.panels.levelIndicatorsContainer.SetHasClass(
				'profile-level-indicators--' + i,
				i === indicatorClass.getLevelColor(level)
			);
		}

		this.panels.levelIndicatorsContainer.SetHasClass('profile-level-indicators--no-prestige', level < 500);

		this.panels.prestigeIndicator.jsClass.setLevel(level);
		this.panels.levelIndicator.jsClass.setLevel(level);
	}

	/**
	 * Show the levels explainer contextmenu
	 */
	static showLevelExplainers() {
		UiToolkitAPI.ShowCustomLayoutContextMenu(
			this.panels.levelInfo.id,
			'',
			'file://{resources}/layout/modals/context-menus/levels-explainer.xml'
		);
	}

	static openWebsiteProfile() {
		SteamOverlayAPI.OpenURLModal('https://momentum-mod.org/dashboard/profile');
	}
}
