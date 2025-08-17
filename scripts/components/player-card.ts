import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { User } from 'common/web_dontmodifyme';

@PanelHandler({ exposeToPanel: true })
export class PlayerCardHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<PlayerCard>(),
		progressBar: $<ProgressBar>('#XpProgressBar'),
		levelIndicator: $<LevelIndicator>('#LevelIndicator')
	};

	onPanelLoad() {
		this.update();
		$.RegisterForUnhandledEvent('MomAPI_UserUpdate', (_user: User) => this.update());
	}

	update() {
		const level = MomentumAPI.GetPlayerLevel();
		const xp = MomentumAPI.GetPlayerXp();
		const currLevelXp = MomentumAPI.GetCosmeticXpForLevel(level);
		const nextLevelXp = MomentumAPI.GetCosmeticXpForLevel(level + 1);
		const money = MomentumAPI.GetPlayerMoney();

		// Set the dialog variables so this can be used in label
		this.panels.cp.SetDialogVariable('name', FriendsAPI.GetLocalPlayerName());
		this.panels.cp.SetDialogVariableInt('level', level);
		this.panels.cp.SetDialogVariableInt('xp', xp - currLevelXp);
		this.panels.cp.SetDialogVariableInt('totalxp', nextLevelXp - currLevelXp);
		this.panels.cp.SetDialogVariableInt('money', money);

		// Update the progress bar
		this.panels.progressBar.value = xp;
		this.panels.progressBar.min = currLevelXp;
		this.panels.progressBar.max = nextLevelXp;

		this.panels.levelIndicator.handler.setLevel(level);
	}
}
