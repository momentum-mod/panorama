import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { LobbyType } from 'common/online';

@PanelHandler()
class LobbySettingsHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		warningRow: $<Panel>('#WarningRow'),
		warningLabel: $<Label>('#WarningLabel'),
		updateButton: $<Button>('#UpdateButton'),
		maxPlayers: $<TextEntry>('#MaxPlayers')
	};

	lobbyMaxPlayers = 250;
	lobbyButtons: ReadonlyMap<LobbyType, Button> = new Map([
		[LobbyType.PRIVATE, $('#LobbySettingsPrivateButton')],
		[LobbyType.FRIENDS, $('#LobbySettingsFriendsOnlyButton')],
		[LobbyType.PUBLIC, $('#LobbySettingsPublicButton')]
	]);

	onPanelLoad() {
		this.lobbyButtons.get(this.panels.cp.GetAttributeString('type', LobbyType.PUBLIC) as LobbyType).checked = true;
		this.panels.maxPlayers.text = $.GetContextPanel().GetAttributeString('maxplayers', '64');
		this.panels.updateButton.enabled = false;
	}

	onChanged() {
		UiToolkitAPI.HideTextTooltip();

		if (this.getMaxPlayersEntered() > this.lobbyMaxPlayers) {
			UiToolkitAPI.ShowTextTooltip(
				'MaxPlayers',
				$.Localize('#Lobby_MaxPlayers_Warning').replace('%max%', this.lobbyMaxPlayers.toString())
			);
			this.panels.updateButton.enabled = false;
		} else {
			this.panels.updateButton.enabled = true;
		}
	}

	submit() {
		//  TODO: iterator methods
		const type = [...this.lobbyButtons.entries()].find(([, button]) => button.checked)[0];
		SteamLobbyAPI.ChangeVisibility(+type as 0 | 1 | 2);

		SteamLobbyAPI.SetMaxPlayers(this.getMaxPlayersEntered());

		UiToolkitAPI.CloseAllVisiblePopups();
	}

	cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	getMaxPlayersEntered() {
		return +this.panels.maxPlayers.text;
	}
}
