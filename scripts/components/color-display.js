class ColorDisplay {
	static display = $('#Display');

	static showPopup() {
		const color = $.GetContextPanel().color;
		const popup = UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/color-picker.xml',
			'color=' + color
		);
		$.RegisterEventHandler('ColorPickerSave', popup, this.saveColor.bind(this));
	}

	static saveColor(color) {
		$.GetContextPanel().color = color;
		this.updateDisplayOpacity();
	}

	static updateDisplayOpacity() {
		// set background-img-opacity to inverse of color alpha to have transparency checkerboard blend
		this.display.style.backgroundImgOpacity = 1 - $.GetContextPanel().alpha;
	}
}
