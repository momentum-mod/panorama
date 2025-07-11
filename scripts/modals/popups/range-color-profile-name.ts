import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class RangeColorProfileNamePopupHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		textEntry: $<TextEntry>('#RangeColorProfileName'),
		invalidName: $<Label>('#InvalidNameLabel')
	};

	profileNames: string[] = [];

	onPanelLoad() {
		$.GetContextPanel().SetDialogVariable('OKBtnText', $.GetContextPanel().GetAttributeString('OKBtnText', ''));

		this.panels.invalidName.visible = false;
		this.profileNames = $.GetContextPanel().GetAttributeString('profileNames', '').split(',');
		this.panels.textEntry.text = $.GetContextPanel().GetAttributeString('prefilledText', '');
	}

	onTextSubmitted() {
		const text = this.panels.textEntry.text;
		if (text === '' || text === $.Localize('Settings_Speedometer_ColorProfile_Type0') || text.includes(',')) {
			this.invalidNameSubmitted();
			return;
		}

		if (this.profileNames.some((profileName) => text.toUpperCase() === profileName.toUpperCase())) {
			this.invalidNameSubmitted();
			return;
		}

		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);
		if (callbackHandle !== -1) {
			UiToolkitAPI.InvokeJSCallback(callbackHandle, text);
		}
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	invalidNameSubmitted() {
		this.panels.invalidName.visible = true;
	}

	onOkPressed() {
		this.onTextSubmitted();
	}
}
