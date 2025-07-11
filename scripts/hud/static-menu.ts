$.RegisterEventHandler('StaticHudMenu_EntrySelected', $.GetContextPanel(), (panel: Panel) => {
	panel.AddClass('static-hud-menu__entry--highlight');
	const kfs = panel.CreateCopyOfCSSKeyframes('StaticHudMenuEntrySelected');
	panel.UpdateCurrentAnimationKeyframes(kfs);
});
