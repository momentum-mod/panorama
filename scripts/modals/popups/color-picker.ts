import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ColorPickerPopup implements OnPanelLoad {
	constructor() {
		$.RegisterEventHandler('ColorPickerSave', $.GetContextPanel(), () => this.onSaveColor());
		$.RegisterEventHandler('ColorPickerCancel', $.GetContextPanel(), () => this.onDiscardColor());
	}

	onPanelLoad() {
		const color = $.GetContextPanel().GetAttributeString('color', 'rgba(0, 0, 0, 1)') as color;
		const colorPicker = $<ColorPicker>('#ColorPicker');
		colorPicker.prevColor = color;
		colorPicker.currColor = color;
	}

	onSaveColor() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	onDiscardColor() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
