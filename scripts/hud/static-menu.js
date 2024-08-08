class HudStaticMenu {
onEntrySelected(panel) {
		panel.AddClass('static-hud-menu__entry--highlight');
		const kfs = panel.CreateCopyOfCSSKeyframes('StaticHudMenuEntrySelected');
		panel.UpdateCurrentAnimationKeyframes(kfs);
	}

constructor() {
		$.RegisterEventHandler('StaticHudMenu_EntrySelected', $.GetContextPanel(), this.onEntrySelected);
	}
}
