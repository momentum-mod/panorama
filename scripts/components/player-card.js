class PlayerCard {
	static panels = {
		progressBar: $('#XpProgressBar'),
		levelIndicator: $('#LevelIndicator')
	};

	static {
		$.GetContextPanel().jsClass = this;
	}

	static onLoad() {
		this.update();
	}

	static update() {
		const cp = $.GetContextPanel();

		const level = MomentumAPI.GetPlayerLevel();
		const xp = MomentumAPI.GetPlayerXp();
		const currLevelXp = MomentumAPI.GetCosmeticXpForLevel(level);
		const nextLevelXp = MomentumAPI.GetCosmeticXpForLevel(level + 1);
		const money = MomentumAPI.GetPlayerMoney();

		// Set the dialog variables so this can be used in label
		cp.SetDialogVariable('name', FriendsAPI.GetLocalPlayerName());
		cp.SetDialogVariableInt('level', level);
		cp.SetDialogVariableInt('xp', xp - currLevelXp);
		cp.SetDialogVariableInt('totalxp', nextLevelXp - currLevelXp);
		cp.SetDialogVariableInt('money', money);

		// Update the progress bar
		this.panels.progressBar.value = xp;
		this.panels.progressBar.min = currLevelXp;
		this.panels.progressBar.max = nextLevelXp;

		this.panels.levelIndicator.jsClass.setLevel(level);
	}
}
