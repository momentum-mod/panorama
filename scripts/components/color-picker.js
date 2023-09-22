class ColorPicker {
	/* Having these events inline in the xml apparently messes up the context panel stack and in turn, event dispatch */
	static onSave() {
		$.DispatchEvent('ColorPickerSave', $.GetContextPanel().currColor);
	}

	static onCancel() {
		$.DispatchEvent('ColorPickerCancel');
	}
}
