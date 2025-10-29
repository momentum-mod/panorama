import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { handleDosaCheckbox } from 'util/dont-show-again';
import { SteamGame } from 'common/web/enums/steam-game.enum';
import { SteamGamesNames } from 'common/web/maps/steam-games.map';

@PanelHandler()
class RequiredGamesPopupHandler implements OnPanelLoad {
	mapID: number = null!;
	gamemodeOverride: Gamemode | -1;

	icons = {
		[SteamGame.CSS]: 'file://{images}/game-logos/css.png',
		[SteamGame.CSGO]: 'file://{images}/game-logos/csgo.png',
		[SteamGame.TF2]: 'file://{images}/game-logos/tf2.png',
		[SteamGame.PORTAL2]: 'file://{images}/game-logos/portal2.png'
	};

	onPanelLoad() {
		const cp = $.GetContextPanel();
		this.mapID = cp.GetAttributeInt('mapID', -1);
		if (this.mapID === -1) {
			throw new Error('RequiredGamesHandler: mapID is not set');
		}

		this.gamemodeOverride = cp.GetAttributeInt('gamemodeOverride', -1);

		const gameList = $('#Games');
		const games = cp.GetAttributeString('games', '').split(',').map(Number);
		const mounted = GameInterfaceAPI.GetMountedSteamApps();

		games.forEach((game) => {
			const gamePanel = $.CreatePanel('Panel', gameList, '');
			gamePanel.LoadLayoutSnippet('game');
			gamePanel.SetDialogVariable('game', SteamGamesNames.get(game));
			gamePanel.FindChildTraverse<Image>('Icon').SetImage(this.icons[game]);

			const isMounted = mounted.includes(game);
			const mountedIcon = gamePanel.FindChildTraverse<Image>('MountedIcon');
			mountedIcon.SetImage(`file://{images}/${isMounted ? 'checkmark' : 'close'}.svg`);
			mountedIcon.SetHasClass('wash-color-green', isMounted);
			mountedIcon.SetHasClass('wash-color-red', !isMounted);
			const mountedStatus = gamePanel.FindChildTraverse<Label>('MountedStatus');
			mountedStatus.text = $.Localize(isMounted ? '#Common_OK' : '#MapSelector_RequiredGames_Missing');
			mountedStatus.SetHasClass('wash-color-green', isMounted);
			mountedStatus.SetHasClass('wash-color-red', !isMounted);
		});
	}

	submit() {
		handleDosaCheckbox();

		if (this.gamemodeOverride !== -1) {
			$.DispatchEvent('MapSelector_TryPlayMap_GameModeOverride', this.mapID, this.gamemodeOverride);
		} else {
			$.DispatchEvent('MapSelector_TryPlayMap', this.mapID);
		}
	}

	cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
