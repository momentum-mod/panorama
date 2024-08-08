
class SpeedometerSelectPopup {
	/** @static @type {Panel} */
container = $('#SpeedometerSelectContainer');
	/** @static @type {TextEntry} */
textEntry = $('#SpeedometerName');
	/** @type {Label} @static */
invalidNameLabel = $('#InvalidNameLabel');
selected = 0;
speedometerNames = [];

onTextSubmitted() {
		if (!this.validateSpeedometerNames()) {
			this.invalidNameLabel.visible = true;
			return;
		}

		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);

		if (callbackHandle !== -1)
			UiToolkitAPI.InvokeJSCallback(callbackHandle, SpeedometerSelectPopup.selected, this.textEntry.text);
		UiToolkitAPI.CloseAllVisiblePopups();
	}

validateSpeedometerNames() {
		const text = this.textEntry.text;
		if (text === '' || text.includes(',')) return false;

		if (this.speedometerNames.some((name) => text.toUpperCase() === name.toUpperCase())) return false;

		return true;
	}

invalidNameSubmitted() {
		SpeedometerSelectPopup.invalidNameLabel.visible = true;
	}

onAddButtonPressed() {
		this.textEntry.Submit();
	}

init() {
		SpeedometerSelectPopup.invalidNameLabel.visible = false;
		SpeedometerSelectPopup.speedometerNames = $.GetContextPanel()
			.GetAttributeString('speedometerNames', '')
			.split(',');
		for (const typeNum of _.Functions.Enum.values(_.PanoConst.SpeedometerTypes)) {
			const speedometer = $.CreatePanel('Panel', SpeedometerSelectPopup.container, '');
			speedometer.LoadLayoutSnippet('speedometer-radiobutton');
			speedometer.FindChildInLayoutFile('SpeedometerBtnLabel').text = $.Localize(
				_.PanoConst.SpeedometerDispNames.get(typeNum)
			);

			const radioBtn = speedometer.FindChildInLayoutFile('SpeedometerRadioBtn');
			radioBtn.SetPanelEvent('onactivate', () => {
				SpeedometerSelectPopup.selected = typeNum;
			});

			// select overall velocity by default
			if (typeNum === SpeedometerTypes.OVERALL_VELOCITY) radioBtn.selected = true;
		}
	}
}
