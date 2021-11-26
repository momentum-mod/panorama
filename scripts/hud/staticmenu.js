'use strict';

class HudStaticMenu {
	static onEntrySelected(panel) {
		panel.AddClass('static-hud-menu__entry--highlight');
		let kfs = panel.CreateCopyOfCSSKeyframes('StaticHudMenuEntrySelected');
		panel.UpdateCurrentAnimationKeyframes(kfs);
	}

	static {
		$.RegisterEventHandler('StaticHudMenu_EntrySelected', $.GetContextPanel(), HudStaticMenu.onEntrySelected);
	}

}