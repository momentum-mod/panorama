class LobbyCreate {
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

	static onChanged() {
		UiToolkitAPI.HideTextTooltip();

		if (this.getMaxPlayersEntered() > this.lobbyMaxPlayers) {
			UiToolkitAPI.ShowTextTooltip(
				'MaxPlayers',
				$.Localize('Lobby_MaxPlayers_Warning').replace('%max%', this.lobbyMaxPlayers)
			);
			this.panels.updateButton.enabled = false;
		} else {
			this.panels.updateButton.enabled =
				this.isChecked('LobbyCreatePrivateButton') ||
				this.isChecked('LobbyCreateFriendsOnlyButton') ||
				this.isChecked('LobbyCreatePublicButton');
		}
	}

	static create() {
		let type;
		if (this.isChecked('LobbyCreatePrivateButton')) {
			type = 0;
		} else if (this.isChecked('LobbyCreateFriendsOnlyButton')) {
			type = 1;
		} else if (this.isChecked('LobbyCreatePublicButton')) {
			type = 2;
		}

		if (this.panels.cp.GetAttributeInt('isinlobby', -1)) {
			SteamLobbyAPI.Leave();
		}

		SteamLobbyAPI.Create(type);

		// The order of this is currently wrong, it should go leave -> set max players -> create. but for some reason
		// the new lobby data then has the wrong max players (from the previous lobby).
		// so for now, create the new lobby first, then set the max players. if you fail to create a lobby this popup is gonna just sit around
		// until you press cancel though.
		$.RegisterForUnhandledEvent('SteamLobby_Enter', () => {
			SteamLobbyAPI.SetMaxPlayers(this.getMaxPlayersEntered());

			UiToolkitAPI.CloseAllVisiblePopups();
		});
	}

	static cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static getMaxPlayersEntered() {
		return Number.parseInt(this.panels.maxPlayers.text);
	}

	static isChecked(button) {
		return this.panels.cp.FindChildTraverse(button).checked;
	}
}
