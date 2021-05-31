"use strict";

class PlayerCard {
	static onLoad() {
		const level = MomentumAPI.GetPlayerLevel();
		const xp = MomentumAPI.GetPlayerXp();
		const currLevelXp = MomentumAPI.GetCosmeticXpForLevel(level);
		const nextLevelXp = MomentumAPI.GetCosmeticXpForLevel(level + 1);
		const money = MomentumAPI.GetPlayerMoney();

		// Set the dialog variables so this can be used in label
		$.GetContextPanel().SetDialogVariable("name", FriendsAPI.GetLocalPlayerName());
		$.GetContextPanel().SetDialogVariableInt("level", level);
		$.GetContextPanel().SetDialogVariableInt("xp", xp - currLevelXp);
		$.GetContextPanel().SetDialogVariableInt("totalxp", nextLevelXp - currLevelXp);
		$.GetContextPanel().SetDialogVariableInt("money", money);

		// Update the progress bar
		$('#XpProgressBar').value = xp;
		$('#XpProgressBar').min = currLevelXp;
		$('#XpProgressBar').max = nextLevelXp;

		// Add level indicator
		$.CreatePanel('Frame', $('#XpAndLevel'), '', {
			class: 'level-indicator',
			src: 'file://{resources}/layout/level_indicator.xml',
			level: level,
			prestige: 0
		});
	}
}