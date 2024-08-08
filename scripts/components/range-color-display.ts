import { Component } from 'util/component';

@Component
class RangeColorDisplayComponent {
	colorDisplay = $<ColorDisplay>('#ColorDisplay');
	minEntry = $<TextEntry>('#MinEntry');
	maxEntry = $<TextEntry>('#MaxEntry');

	// need to forward the colordisplay panelevent to parent
	onColorChange() {
		$.GetContextPanel<RangeColorDisplay>().color = this.colorDisplay.color;
		$.RegisterEventHandler('InputFocusLost', $.GetContextPanel(), this.onFocusLost.bind(this));
	}

	// set bounds when focus is changed to be outside of the panel
	onFocusLost(_panel: GenericPanel) {
		if (this.minEntry.HasKeyFocus() || this.maxEntry.HasKeyFocus() || this.colorDisplay.HasKeyFocus()) {
			return;
		}

		$.GetContextPanel<RangeColorDisplay>().SetBounds(
			Number.parseFloat(this.minEntry.text),
			Number.parseFloat(this.maxEntry.text)
		);
	}
}
