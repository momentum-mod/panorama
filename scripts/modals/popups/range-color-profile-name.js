class RangeColorProfileNamePopup {
	/** @type {TextEntry} @static */
	static textEntry = $('#RangeColorProfileName');
	/** @type {Label} @static */
	static invalidNameLabel = $('#InvalidNameLabel');
	static profileNames = [];

	static onTextSubmitted() {
		const text = this.textEntry.text;
		if (text === '' || text === $.Localize('Settings_Speedometer_ColorProfile_Type0') || text.includes(',')) {
			RangeColorProfileNamePopup.invalidNameSubmitted();
			return;
		}

		let passed = true;
		RangeColorProfileNamePopup.profileNames.every((profileName) => {
			if (text === profileName) {
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

	static invalidNameSubmitted() {
		RangeColorProfileNamePopup.invalidNameLabel.visible = true;
	}

	static onOKPressed() {
		this.textEntry.Submit();
	}

	static init() {
		RangeColorProfileNamePopup.invalidNameLabel.visible = false;
		$.GetContextPanel().SetDialogVariable('OKBtnText', $.GetContextPanel().GetAttributeString('OKBtnText', ''));
		RangeColorProfileNamePopup.profileNames = $.GetContextPanel().GetAttributeString('profileNames', '').split(',');
		this.textEntry.text = $.GetContextPanel().GetAttributeString('prefilledText', '');
	}
}
