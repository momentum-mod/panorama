'use strict';

class LobbySettings {
	static lobbyMaxPlayers = 250;

	static init() {
		let button;
		switch ($.GetContextPanel().GetAttributeInt('type', -1)) {
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

		$.GetContextPanel().FindChildTraverse(button).checked = true;
		$.GetContextPanel().FindChildTraverse('MaxPlayers').text = $.GetContextPanel().GetAttributeInt('maxplayers', -1);
		$.GetContextPanel().FindChildTraverse('UpdateButton').enabled = false; // Above is gonna call onChanged
	}

	static onChanged() {
		UiToolkitAPI.HideTextTooltip();

		if (parseInt($.GetContextPanel().FindChildTraverse('MaxPlayers').text) > this.lobbyMaxPlayers) {
			UiToolkitAPI.ShowTextTooltip('MaxPlayers', 'Player limit is too high! Maximum value is ' + this.lobbyMaxPlayers + '.');
			$.GetContextPanel().FindChildTraverse('UpdateButton').enabled = false;
		} else {
			$.GetContextPanel().FindChildTraverse('UpdateButton').enabled = true;
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

		SteamLobbyAPI.SetMaxPlayers(parseInt($.GetContextPanel().FindChildTraverse('MaxPlayers').text));

		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
