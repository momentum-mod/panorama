class SpeedometerSelectPopup {
	/** @static @type {Panel} */
	static container = $('#SpeedometerSelectContainer');
	/** @static @type {TextEntry} */
	static textEntry = $('#SpeedometerName');
	static selected = 0;

	static onAddButtonPressed() {
		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);
		if (callbackHandle !== -1)
			UiToolkitAPI.InvokeJSCallback(
				callbackHandle,
				SpeedometerSelectPopup.selected,
				SpeedometerSelectPopup.textEntry.text
			);
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static init() {
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
