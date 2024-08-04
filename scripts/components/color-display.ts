class ColorDisplay {
	static showPopup() {
		const color = $.GetContextPanel<ColorDisplay>().color;
		const popup = UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/color-picker.xml',
			`color=${color}`
		);
		$.RegisterEventHandler('ColorPickerSave', popup, (color) => this.saveColor(color));
	}

	static saveColor(color: rgbaColor) {
		$.GetContextPanel<ColorDisplay>().color = color;
		this.updateDisplayOpacity();
	}

	static updateDisplayOpacity() {
		// set background-img-opacity to inverse of color alpha to have transparency checkerboard blend
		$('#Display').style.backgroundImgOpacity = 1 - $.GetContextPanel<ColorDisplay>().alpha;
	}
}
