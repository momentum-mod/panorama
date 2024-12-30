import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { User } from 'common/web';

@PanelHandler()
class ProfileHandler implements OnPanelLoad {
	readonly panels = {
		levelIndicatorsContainer: $('#ProfileLevelIndicators'),
		prestigeIndicator: $<LevelIndicator>('#ProfileLevelIndicatorPrestige'),
		levelIndicator: $<LevelIndicator>('#ProfileLevelIndicatorLevel'),
		levelInfo: $('#LevelInfoButton')
	};

	onPanelLoad() {
		this.update();
		$.RegisterForUnhandledEvent('MomAPI_UserUpdate', (_user: User) => this.update());
	}

	update() {
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

	/** Set a new level in the two levels indicator components */
	updateLevelIndicators(level: number) {
		const indicatorClass = this.panels.prestigeIndicator.handler;
		for (let i = 1; i <= 10; i++) {
			this.panels.levelIndicatorsContainer.SetHasClass(
				'profile-level-indicators--' + i,
				i === indicatorClass.getLevelColor(level)
			);
		}

		this.panels.levelIndicatorsContainer.SetHasClass('profile-level-indicators--no-prestige', level < 500);

		this.panels.prestigeIndicator.handler.setLevel(level);
		this.panels.levelIndicator.handler.setLevel(level);
	}

	/**
	 * Show the levels explainer contextmenu
	 */
	showLevelExplainers() {
		UiToolkitAPI.ShowCustomLayoutContextMenu(
			this.panels.levelInfo.id,
			'',
			'file://{resources}/layout/modals/context-menus/levels-explainer.xml'
		);
	}

	openWebsiteProfile() {
		SteamOverlayAPI.OpenURLModal('https://momentum-mod.org/dashboard/profile');
	}
}
