import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { SpeedometerDispNames, SpeedometerType } from 'common/speedometer';
import * as Enum from 'util/enum';

@PanelHandler()
class SpeedometerSelectPopupHandler implements OnPanelLoad {
	readonly panels = {
		container: $<Panel>('#SpeedometerSelectContainer'),
		textEntry: $<TextEntry>('#SpeedometerName'),
		invalidName: $<Label>('#InvalidNameLabel')
	};

	selected = 0;
	speedometerNames: string[] = [];

	onPanelLoad() {
		this.panels.invalidName.visible = false;
		this.speedometerNames = $.GetContextPanel().GetAttributeString('speedometerNames', '').split(',');

		for (const typeNum of Enum.fastValuesNumeric(SpeedometerType)) {
			const speedometer = $.CreatePanel('Panel', this.panels.container, '');
			speedometer.LoadLayoutSnippet('speedometer-radiobutton');
			speedometer.FindChildInLayoutFile<Label>('SpeedometerBtnLabel').text = $.Localize(
				SpeedometerDispNames.get(typeNum)
			);

			const radioBtn = speedometer.FindChildInLayoutFile<RadioButton>('SpeedometerRadioBtn');
			radioBtn.SetPanelEvent('onactivate', () => (this.selected = typeNum));

			// select overall velocity by default
			if (typeNum === SpeedometerType.OVERALL_VELOCITY) {
				radioBtn.SetSelected(true);
			}
		}
	}

	onTextSubmitted() {
		if (!this.validateSpeedometerNames()) {
			this.panels.invalidName.visible = true;
			return;
		}

		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);

		if (callbackHandle !== -1)
			UiToolkitAPI.InvokeJSCallback(callbackHandle, this.selected, this.panels.textEntry.text);
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	validateSpeedometerNames() {
		const text = this.panels.textEntry.text;

		return !(
			text === '' ||
			text.includes(',') ||
			this.speedometerNames.some((name) => text.toUpperCase() === name.toUpperCase())
		);
	}

	invalidNameSubmitted() {
		this.panels.invalidName.visible = true;
	}

	onAddButtonPressed() {
		this.panels.textEntry.Submit();
	}
}
