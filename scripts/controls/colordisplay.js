'use_strict';

class ColorDisplay {
	static showPopup() {
		let color = $.GetContextPanel().color;
		let popup = UiToolkitAPI.ShowCustomLayoutPopupParameters("", "file://{resources}/layout/popups/popup_colorpicker.xml", "color=" + color);
		$.RegisterEventHandler('ColorPickerSave', popup, ColorDisplay.saveColor);
	}

	static saveColor(color) {
		$.GetContextPanel().color = color;
	}
}
