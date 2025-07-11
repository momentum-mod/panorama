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

	lobbyButtons: ReadonlyMap<LobbyType, Button> = new Map([
		[LobbyType.PRIVATE, $('#LobbySettingsPrivateButton')],
		[LobbyType.FRIENDS, $('#LobbySettingsFriendsOnlyButton')],
		[LobbyType.PUBLIC, $('#LobbySettingsPublicButton')]
	]);

	onPanelLoad() {
		this.lobbyButtons.get(this.panels.cp.GetAttributeString('type', LobbyType.PUBLIC) as LobbyType).checked = true;
		this.panels.maxPlayers.text = $.GetContextPanel().GetAttributeString('maxplayers', '2');
		this.panels.updateButton.enabled = false;
	}

	onChanged() {
		UiToolkitAPI.HideTextTooltip();

		if (this.getMaxPlayersEntered() > SteamLobbyAPI.GetMaxAllowedMemberLimit()) {
			UiToolkitAPI.ShowTextTooltip(
				'MaxPlayers',
				$.Localize('#Lobby_MaxPlayers_Warning').replace(
					'%max%',
					SteamLobbyAPI.GetMaxAllowedMemberLimit().toString()
				)
			);
			this.panels.updateButton.enabled = false;
		} else {
			this.panels.updateButton.enabled = true;
		}
	}

	submit() {
		const type = this.lobbyButtons.entries().find(([, button]) => button.checked)[0];
		SteamLobbyAPI.SetType(+type as 0 | 1 | 2);

		SteamLobbyAPI.SetMemberLimit(this.getMaxPlayersEntered());

		UiToolkitAPI.CloseAllVisiblePopups();
	}

	cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	getMaxPlayersEntered() {
		return +this.panels.maxPlayers.text;
	}
}
