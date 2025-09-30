import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { LobbyType } from 'common/online';

@PanelHandler()
class LobbyCreateHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		warningRow: $<Panel>('#WarningRow'),
		warningLabel: $<Label>('#WarningLabel'),
		updateButton: $<Button>('#UpdateButton'),
		maxPlayers: $<TextEntry>('#MaxPlayers')
	};

	onPanelLoad() {
		if (this.panels.cp.GetAttributeInt('islobbyowner', 0)) {
			this.panels.warningRow.visible = true;
			this.panels.cp.SetDialogVariable('warning', $.Localize('#Lobby_Create_TransferWarning'));
		} else if (this.panels.cp.GetAttributeInt('isinlobby', 0)) {
			this.panels.warningRow.visible = true;
			this.panels.cp.SetDialogVariable('warning', $.Localize('#Lobby_Create_LeaveWarning'));
		} else {
			this.panels.warningRow.visible = false;
		}

		this.onChanged();
	}

	onChanged() {
		UiToolkitAPI.HideTextTooltip();

		if (this.getMaxPlayersEntered() > SteamLobbyAPI.GetMaxAllowedMemberLimit()) {
			UiToolkitAPI.ShowTextTooltip(
				'MaxPlayers',
				$.Localize('Lobby_MaxPlayers_Warning').replace(
					'%max%',
					SteamLobbyAPI.GetMaxAllowedMemberLimit().toString()
				)
			);
			this.panels.updateButton.enabled = false;
		} else {
			this.panels.updateButton.enabled =
				this.isChecked('LobbyCreatePrivateButton') ||
				this.isChecked('LobbyCreateFriendsOnlyButton') ||
				this.isChecked('LobbyCreatePublicButton');
		}
	}

	create() {
		let type: LobbyType;
		if (this.isChecked('LobbyCreatePrivateButton')) {
			type = LobbyType.PRIVATE;
		} else if (this.isChecked('LobbyCreateFriendsOnlyButton')) {
			type = LobbyType.FRIENDS;
		} else if (this.isChecked('LobbyCreatePublicButton')) {
			type = LobbyType.PUBLIC;
		}

		SteamLobbyAPI.Create(+type as 0 | 1 | 2, this.getMaxPlayersEntered());

		$.RegisterForUnhandledEvent('SteamLobby_Enter', () => {
			UiToolkitAPI.CloseAllVisiblePopups();
		});
	}

	cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	getMaxPlayersEntered() {
		return +this.panels.maxPlayers.text;
	}

	isChecked(buttonID: string) {
		return this.panels.cp.FindChildTraverse<Button>(buttonID).checked;
	}
}
