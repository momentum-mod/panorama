import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ScoreboardPlayerHandler {
	showContextMenu() {
		const player = $.GetContextPanel<ScoreboardPlayer>();

		const items = [];

		if (player.connected && !player.isSelf) {
			if (player.spectating) {
				// 0 means they are spectating something we can't spectate ourselves
				if (player.spectateWithTarget !== '0') {
					items.push({
						label: $.Localize('#Lobby_SpectateWithPlayer'),
						icon: 'file://{images}/eye-arrow-right.svg',
						style: 'icon-color-white',
						jsCallback: () => GameInterfaceAPI.ConsoleCommand('mom_spectate ' + player.spectateWithTarget)
					});
				}
			} else {
				items.push({
					label: $.Localize('#Lobby_Spectate'),
					icon: 'file://{images}/eye.svg',
					style: 'icon-color-white',
					jsCallback: () => GameInterfaceAPI.ConsoleCommand('mom_spectate ' + player.steamId)
				});
			}
		}

		items.push({
			label: $.Localize('#Action_ShowSteamProfile'),
			icon: 'file://{images}/social/steam.svg',
			style: 'icon-color-steam-online',
			jsCallback: () => SteamOverlayAPI.OpenToProfileID(player.steamId.toString())
		});

		if (!player.isSelf) {
			const muted = ChatAPI.BIsUserMuted(player.steamId);
			items.push({
				label: $.Localize(muted ? '#Lobby_UnmutePlayer' : '#Lobby_MutePlayer'),
				icon: 'file://{images}/volume-' + (muted ? 'high' : 'mute') + '.svg',
				style: 'icon-color-' + (muted ? 'green' : 'red'),
				jsCallback: () => ChatAPI.ChangeMuteState(player.steamId, !muted)
			});
		}

		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}
}
