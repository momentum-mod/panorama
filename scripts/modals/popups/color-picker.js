class ColorPickerPopup {
init() {
		const color = $.GetContextPanel().GetAttributeString('color', 'rgba(0,0,0,1)');
		$('#ColorPicker').prevColor = color;
		$('#ColorPicker').currColor = color;
	}

onSaveColor(color) {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

onDiscardColor() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}

constructor() {
		$.RegisterEventHandler('ColorPickerSave', $.GetContextPanel(), ColorPickerPopup.onSaveColor);
		$.RegisterEventHandler('ColorPickerCancel', $.GetContextPanel(), ColorPickerPopup.onDiscardColor);
	}
}
