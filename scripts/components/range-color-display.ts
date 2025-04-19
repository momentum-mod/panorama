import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class RangeColorDisplayHandler {
	colorDisplay = $<ColorDisplay>('#ColorDisplay');
	minEntry = $<TextEntry>('#MinEntry');
	maxEntry = $<TextEntry>('#MaxEntry');

	// need to forward the colordisplay panelevent to parent
	onColorChange() {
		$.GetContextPanel<RangeColorDisplay>().color = this.colorDisplay.color;
		$.RegisterEventHandler('InputFocusLost', $.GetContextPanel(), () => this.onFocusLost());
	}

	// set bounds when focus is changed to be outside of the panel
	onFocusLost() {
		if (this.minEntry.HasKeyFocus() || this.maxEntry.HasKeyFocus() || this.colorDisplay.HasKeyFocus()) {
			return;
		}

		$.GetContextPanel<RangeColorDisplay>().SetBounds(
			Number.parseFloat(this.minEntry.text),
			Number.parseFloat(this.maxEntry.text)
		);
	}
}
