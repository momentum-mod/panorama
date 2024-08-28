import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { getAllDosas, removeDosa } from 'util/dont-show-again';

@PanelHandler()
class DosaSettingsHandler implements OnPanelLoad {
	onPanelLoad() {
		const container = $('#Dosas');
		for (const [id, nameToken] of getAllDosas()) {
			const panel = $.CreatePanel('Panel', container, '');
			panel.LoadLayoutSnippet('dosa-item');
			panel.SetDialogVariable('name', $.Localize(nameToken));
			panel.FindChild('ResetButton').SetPanelEvent('onactivate', () => {
				removeDosa(id);
				panel.RemoveAndDeleteChildren();
			});
		}
	}
}
