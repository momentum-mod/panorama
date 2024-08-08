import { Component } from 'util/component';

@Component
class ColorPickerComponent {
	// Having these events inline in the xml apparently messes up the context panel stack and in turn, event dispatch
	onSave() {
		$.DispatchEvent('ColorPickerSave', $.GetContextPanel<ColorPicker>().currColor);
	}

	onCancel() {
		$.DispatchEvent('ColorPickerCancel');
	}
}
