class SpeedometerSelectPopup {
	/** @static @type {Panel} */
	static container = $('#SpeedometerSelectContainer');
	/** @static @type {TextEntry} */
	static textEntry = $('#SpeedometerName');
	/** @type {Label} @static */
	static invalidNameLabel = $('#InvalidNameLabel');
	static selected = 0;
	static speedometerNames = [];

	static onTextSubmitted() {
		if (!this.validateSpeedometerNames()) {
			this.invalidNameLabel.visible = true;
			return;
		}

		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);

		if (callbackHandle !== -1)
			UiToolkitAPI.InvokeJSCallback(callbackHandle, SpeedometerSelectPopup.selected, this.textEntry.text);
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static validateSpeedometerNames() {
		const text = this.textEntry.text;
		if (text === '' || text.includes(',')) return false;

		if (this.speedometerNames.some((name) => text.toUpperCase() === name.toUpperCase())) return false;

		return true;
	}

	static invalidNameSubmitted() {
		SpeedometerSelectPopup.invalidNameLabel.visible = true;
	}

	static onAddButtonPressed() {
		this.textEntry.Submit();
	}

	static init() {
		SpeedometerSelectPopup.invalidNameLabel.visible = false;
		SpeedometerSelectPopup.speedometerNames = $.GetContextPanel()
			.GetAttributeString('speedometerNames', '')
			.split(',');
		for (const typeNum of Object.values(SpeedometerTypes)) {
			const speedometer = $.CreatePanel('Panel', SpeedometerSelectPopup.container, '');
			speedometer.LoadLayoutSnippet('speedometer-radiobutton');
			speedometer.FindChildInLayoutFile('SpeedometerBtnLabel').text = $.Localize(SpeedometerDispNames[typeNum]);

			const radioBtn = speedometer.FindChildInLayoutFile('SpeedometerRadioBtn');
			radioBtn.SetPanelEvent('onactivate', () => {
				SpeedometerSelectPopup.selected = typeNum;
			});

			// select overall velocity by default
			if (typeNum === SpeedometerTypes.OVERALL_VELOCITY) radioBtn.selected = true;
		}
	}
}
