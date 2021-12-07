'use strict';

class DontShowAgainPopup {
	static onSubmit() {
		const key = $.GetContextPanel().GetAttributeString('storageKey', '');

		if ($.GetContextPanel().FindChildTraverse('DontShowAgainCheckbox').checked && key) {
			$.persistentStorage.setItem('dontShowAgain.' + key, true);
		}

		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
