import { Component } from 'util/component';

@Component
class ColorDisplayComponent {
	showPopup() {
		const color = $.GetContextPanel<ColorDisplay>().color;
		const popup = UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/color-picker.xml',
			`color=${color}`
		);
		$.RegisterEventHandler('ColorPickerSave', popup, (color) => this.saveColor(color));
	}

	saveColor(color: rgbaColor) {
		$.GetContextPanel<ColorDisplay>().color = color;
		this.updateDisplayOpacity();
	}

	updateDisplayOpacity() {
		// set background-img-opacity to inverse of color alpha to have transparency checkerboard blend
		$('#Display').style.backgroundImgOpacity = 1 - $.GetContextPanel<ColorDisplay>().alpha;
	}
}
