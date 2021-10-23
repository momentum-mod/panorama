class ConVarColorDisplay {
	static showPopup() {
		let color = $.GetContextPanel().color;
		let popup = UiToolkitAPI.ShowCustomLayoutPopupParameters("", "file://{resources}/layout/popups/popup_colorpicker.xml", "color=" + color);
		$.RegisterEventHandler('ColorPickerSave', popup, ConVarColorDisplay.saveColor);
	}

	static saveColor(color) {
		$.GetContextPanel().color = color;
	}
}