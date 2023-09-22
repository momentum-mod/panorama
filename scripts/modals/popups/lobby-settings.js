class LobbySettings {
	static panels = {
		/** @type {Panel} @static */
		cp: $.GetContextPanel(),
		/** @type {Panel} @static */
		warningRow: $('#WarningRow'),
		/** @type {Label} @static */
		warningLabel: $('#WarningLabel'),
		/** @type {Button} @static */
		updateButton: $('#UpdateButton'),
		/** @type {TextEntry} @static */
		maxPlayers: $('#MaxPlayers')
	};

	static lobbyMaxPlayers = 250;

	static onLoad() {
		let button;
		switch (this.panels.cp.GetAttributeInt('type', 0)) {
			case 0:
				button = 'LobbySettingsPrivateButton';
				break;
			case 1:
				button = 'LobbySettingsFriendsOnlyButton';
				break;
			case 2:
				button = 'LobbySettingsPublicButton';
				break;
		}

		this.panels.cp.FindChildTraverse(button).checked = true;
		this.panels.maxPlayers.text = $.GetContextPanel().GetAttributeInt('maxplayers', -1);

		this.panels.updateButton.enabled = false;
	}

	static onChanged() {
		UiToolkitAPI.HideTextTooltip();

		if (this.getMaxPlayersEntered() > this.lobbyMaxPlayers) {
			UiToolkitAPI.ShowTextTooltip(
				'MaxPlayers',
				$.Localize('Lobby_MaxPlayers_Warning').replace('%max%', this.lobbyMaxPlayers)
			);
			this.panels.updateButton.enabled = false;
		} else {
			this.panels.updateButton.enabled = true;
		}
	}

	static submit() {
		let type;
		if ($.GetContextPanel().FindChildTraverse('LobbySettingsPrivateButton').checked) {
			type = 0;
		} else if ($.GetContextPanel().FindChildTraverse('LobbySettingsFriendsOnlyButton').checked) {
			type = 1;
		} else if ($.GetContextPanel().FindChildTraverse('LobbySettingsPublicButton').checked) {
			type = 2;
		}

		SteamLobbyAPI.ChangeVisibility(type);

		SteamLobbyAPI.SetMaxPlayers(this.getMaxPlayersEntered());

		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static getMaxPlayersEntered() {
		return Number.parseInt(this.panels.maxPlayers.text);
	}
}
