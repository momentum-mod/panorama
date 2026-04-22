import { PanelHandler } from 'util/module-helpers';

import { registerHUDCustomizerComponent } from 'common/hud-customizer';

@PanelHandler()
class HudMapInfoHandler {
	constructor() {
		$.RegisterEventHandler('StaticHudMenu_EntrySelected', $.GetContextPanel(), (panel: Panel) => {
			panel.TriggerClass('static-hud-menu__entry--highlight');
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false
		});
	}
}
