class RangeColorDisplay {
	static colorDisplay = $<ColorDisplay>('#ColorDisplay');
	static minEntry = $<TextEntry>('#MinEntry');
	static maxEntry = $<TextEntry>('#MaxEntry');

	// need to forward the colordisplay panelevent to parent
	static onColorChange() {
		$.GetContextPanel<RangeColorDisplay>().color = this.colorDisplay.color;
		$.RegisterEventHandler('InputFocusLost', $.GetContextPanel(), this.onFocusLost.bind(this));
	}

	// set bounds when focus is changed to be outside of the panel
	static onFocusLost(_panel: GenericPanel) {
		if (this.minEntry.HasKeyFocus() || this.maxEntry.HasKeyFocus() || this.colorDisplay.HasKeyFocus()) {
			return;
		}

		$.GetContextPanel<RangeColorDisplay>().SetBounds(
			Number.parseFloat(this.minEntry.text),
			Number.parseFloat(this.maxEntry.text)
		);
	}
}
