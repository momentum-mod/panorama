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

	lobbyMaxPlayers = 250;

	onPanelLoad() {
		if (this.panels.cp.GetAttributeInt('islobbyowner', 0)) {
			this.panels.warningRow.visible = true;
			this.panels.cp.SetDialogVariable('warning', '#Lobby_Create_TransferWarning');
		} else if (this.panels.cp.GetAttributeInt('isinlobby', 0)) {
			this.panels.warningRow.visible = true;
			this.panels.cp.SetDialogVariable('warning', '#Lobby_Create_LeaveWarning');
		} else {
			this.panels.warningRow.visible = false;
		}

		this.onChanged();
	}

	onChanged() {
		UiToolkitAPI.HideTextTooltip();

		if (this.getMaxPlayersEntered() > this.lobbyMaxPlayers) {
			UiToolkitAPI.ShowTextTooltip(
				'MaxPlayers',
				$.Localize('Lobby_MaxPlayers_Warning').replace('%max%', this.lobbyMaxPlayers.toString())
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

		if (this.panels.cp.GetAttributeInt('isinlobby', -1)) {
			SteamLobbyAPI.Leave();
		}

		SteamLobbyAPI.Create(+type as 0 | 1 | 2);

		// The order of this is currently wrong, it should go leave -> set max players -> create. but for some reason
		// the new lobby data then has the wrong max players (from the previous lobby).
		// so for now, create the new lobby first, then set the max players. if you fail to create a lobby this popup is gonna just sit around
		// until you press cancel though.
		$.RegisterForUnhandledEvent('SteamLobby_Enter', () => {
			SteamLobbyAPI.SetMaxPlayers(this.getMaxPlayersEntered());

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
