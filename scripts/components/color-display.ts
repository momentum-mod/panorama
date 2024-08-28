import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ColorDisplayHandler {
	// Using onPanelLoad causes very very strange behaviour here. `convar` is no longer defined as an accessor, and
	// infomessage and import/export settings stuff breaks. I spent two hours trying to debug the breakage until randomly
	// discovering that not registering the PanelLoaded event fixed stuff. Still don't know what's going on, just using
	// an XML-based loader for now.
	onLoad() {
		this.updateDisplayOpacity();
	}

	showPopup() {
		const color = $.GetContextPanel<ColorDisplay>().color;
		const popup = UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/color-picker.xml',
			'color=' + color
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
