'use strict';

class SpeedometerSelectPopup {
	static container = $('#SpeedometerSelectContainer');
	static selected = 0;

	static onAddButtonPressed() {
		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);
		if (callbackHandle !== -1) UiToolkitAPI.InvokeJSCallback(callbackHandle, SpeedometerSelectPopup.selected);
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	static init() {
		const disabledIDs = $.GetContextPanel().GetAttributeString('disabledIDs', '').split(',');
		for (const [index, id] of disabledIDs.entries()) {
			const speedometer = $.CreatePanel('Panel', SpeedometerSelectPopup.container, '');
			speedometer.LoadLayoutSnippet('speedometer-radiobutton');
			speedometer.FindChildInLayoutFile('SpeedometerBtnLabel').text = SpeedometerDispNames[id];

			const radioBtn = speedometer.FindChildInLayoutFile('SpeedometerRadioBtn');
			radioBtn.SetPanelEvent('onactivate', () => {
				SpeedometerSelectPopup.selected = id;
			});

			if (index === 0) radioBtn.selected = true;
		}
	}
}
