$.RegisterEventHandler('StaticHudMenu_EntrySelected', $.GetContextPanel(), (panel: Panel) => {
	panel.TriggerClass('static-hud-menu__entry--highlight');
});
