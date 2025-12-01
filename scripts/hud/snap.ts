import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';

PanelHandler()
class SnapHandler{
	constructor() {
		/*RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			onLoad: () => this.onMapInit(),
			events: [],
			handledEvents: []
		});*/
	}

	onMapInit() {
		//do nothing yet
	}
}