'use strict';

class LobbyCreate {
	static lobbyMaxPlayers = 250;

	static init() {
		if ($.GetContextPanel().GetAttributeInt('islobbyowner', -1)) {
			$.GetContextPanel().FindChildTraverse('WarningRow').RemoveClass('hide');
			$.GetContextPanel().FindChildTraverse('WarningLabel').text =
				'Warning: You are currently the owner of a lobby! Creating a new lobby will transfer ownership of your current lobby to another player.';
		} else if ($.GetContextPanel().GetAttributeInt('isinlobby', -1)) {
			$.GetContextPanel().FindChildTraverse('WarningRow').RemoveClass('hide');
			$.GetContextPanel().FindChildTraverse('WarningLabel').text = 'Warning: This will cause you to leave you current lobby!';
		}

		$.GetContextPanel().FindChildTraverse('UpdateButton').enabled = false; // Above is gonna call onChanged
	}

	static onChanged() {
		UiToolkitAPI.HideTextTooltip();

		if (parseInt($.GetContextPanel().FindChildTraverse('MaxPlayers').text) > this.lobbyMaxPlayers) {
			UiToolkitAPI.ShowTextTooltip('MaxPlayers', 'Player limit is too high! Maximum value is ' + this.lobbyMaxPlayers + '.');
			$.GetContextPanel().FindChildTraverse('UpdateButton').enabled = false;
		} else
			$.GetContextPanel().FindChildTraverse('UpdateButton').enabled =
				this.isChecked('LobbyCreatePrivateButton') || this.isChecked('LobbyCreateFriendsOnlyButton') || this.isChecked('LobbyCreatePublicButton');
	}

	static create() {
		let type;
		if (this.isChecked('LobbyCreatePrivateButton')) type = 0;
		else if (this.isChecked('LobbyCreateFriendsOnlyButton')) type = 1;
		else if (this.isChecked('LobbyCreatePublicButton')) type = 2;

		if ($.GetContextPanel().GetAttributeInt('isinlobby', -1)) SteamLobbyAPI.Leave();

		SteamLobbyAPI.Create(type);
		SteamLobbyAPI.SetMaxPlayers(parseInt($.GetContextPanel().FindChildTraverse('MaxPlayers').text));
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static isChecked(button) {
		return $.GetContextPanel().FindChildTraverse(button).checked;
	}
}
