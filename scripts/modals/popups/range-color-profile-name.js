class RangeColorProfileNamePopup {
	/** @type {TextEntry} @static */
textEntry = $('#RangeColorProfileName');
	/** @type {Label} @static */
invalidNameLabel = $('#InvalidNameLabel');
profileNames = [];

onTextSubmitted() {
		const text = this.textEntry.text;
		if (text === '' || text === $.Localize('Settings_Speedometer_ColorProfile_Type0') || text.includes(',')) {
			RangeColorProfileNamePopup.invalidNameSubmitted();
			return;
		}

		let passed = true;
		RangeColorProfileNamePopup.profileNames.every((profileName) => {
			if (text.toUpperCase() === profileName.toUpperCase()) {
				passed = false;
				return false;
			}
			return true;
		});
		if (!passed) {
			RangeColorProfileNamePopup.invalidNameSubmitted();
			return;
		}

		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);
		if (callbackHandle !== -1) UiToolkitAPI.InvokeJSCallback(callbackHandle, text);
		UiToolkitAPI.CloseAllVisiblePopups();
	}

invalidNameSubmitted() {
		RangeColorProfileNamePopup.invalidNameLabel.visible = true;
	}

onOKPressed() {
		this.textEntry.Submit();
	}

init() {
		RangeColorProfileNamePopup.invalidNameLabel.visible = false;
		$.GetContextPanel().SetDialogVariable('OKBtnText', $.GetContextPanel().GetAttributeString('OKBtnText', ''));
		RangeColorProfileNamePopup.profileNames = $.GetContextPanel().GetAttributeString('profileNames', '').split(',');
		this.textEntry.text = $.GetContextPanel().GetAttributeString('prefilledText', '');
	}
}
