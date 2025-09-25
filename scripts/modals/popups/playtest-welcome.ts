import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class LobbyCreateHandler implements OnPanelLoad {
	private readonly numCheckboxes = 3;

	private readonly acceptButton = $<Button>('#AcceptButton');
	private readonly checkboxes = Array.from({ length: this.numCheckboxes }, (_, i) =>
		$<ToggleButton>(`#Checkbox${i + 1}`)
	);

	onPanelLoad() {
		this.checkboxes.forEach((cb) => {
			cb.checked = false;
			cb.SetPanelEvent('onactivate', () => this.updateAcceptButton());
		});
		this.updateAcceptButton();
		this.acceptButton.SetPanelEvent('onactivate', () => {
			if (!this.acceptButton.enabled) return;

			UiToolkitAPI.CloseAllVisiblePopups();
			$.persistentStorage.setItem('mainMenu.playtestWelcomeShown', 'true');
		});
	}

	updateAcceptButton() {
		this.acceptButton.enabled = this.checkboxes.every((cb) => cb.checked);
	}
}
