class RangeColorDisplay {
	static colorDisplay = $('#ColorDisplay');
	/** @type {TextEntry} @static */
	static minEntry = $('#MinEntry');
	/** @type {TextEntry} @static */
	static maxEntry = $('#MaxEntry');

	// need to forward the colordisplay panelevent to parent
	static onColorChange() {
		$.GetContextPanel().color = this.colorDisplay.color;
		$.RegisterEventHandler('InputFocusLost', $.GetContextPanel(), this.onFocusLost.bind(this));
	}

	// set bounds when focus is changed to be outside of the panel
	static onFocusLost(_panel) {
		if (this.minEntry.HasKeyFocus() || this.maxEntry.HasKeyFocus() || this.colorDisplay.HasKeyFocus()) return;

		$.GetContextPanel().SetBounds(Number.parseFloat(this.minEntry.text), Number.parseFloat(this.maxEntry.text));
	}
}
