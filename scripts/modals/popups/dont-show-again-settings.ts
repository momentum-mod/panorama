class DosaSettings {
	static onLoad() {
		const container = $('#Dosas');
		for (const [id, nameToken] of DosaHandler.getAll()) {
			const panel = $.CreatePanel('Panel', container, '');
			panel.LoadLayoutSnippet('dosa-item');
			panel.SetDialogVariable('name', $.Localize(nameToken));
			panel.FindChild('ResetButton').SetPanelEvent('onactivate', () => {
				DosaHandler.removeDosa(id);
				panel.RemoveAndDeleteChildren();
			});
		}
	}
}
