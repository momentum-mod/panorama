import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ColorPickerHandler implements OnPanelLoad {
	onPanelLoad() {
		$<Label>('#ColorPickerLabel').SetProceduralTextThatIPromiseIsLocalizedAndEscaped('#', false);
	}

	// Having these events inline in the xml apparently messes up the context panel stack and in turn, event dispatch
	onSave() {
		$.DispatchEvent('ColorPickerSave', $.GetContextPanel<ColorPicker>().currColor);
	}

	onCancel() {
		$.DispatchEvent('ColorPickerCancel');
	}
}
