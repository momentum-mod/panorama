import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class HudCustomizerLayoutNameHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		title: $<Label>('#TitleLabel'),
		input: $<Label>('#InputLabel'),
		textEntry: $<TextEntry>('#TextEntry'),
		invalidName: $<Label>('#InvalidNameLabel'),
		okButtonLabel: $<Label>('#OkButtonLabel')
	};

	onPanelLoad() {
		this.panels.title.text = $.GetContextPanel().GetAttributeString('title', 'Input');
		this.panels.input.text = $.GetContextPanel().GetAttributeString('input_label', 'Input Value');
		this.panels.okButtonLabel.text = $.GetContextPanel().GetAttributeString(
			'ok_btn_label',
			$.Localize('#Common_OK')
		);

		this.panels.invalidName.visible = false;
	}

	onTextSubmitted() {
		if (!this.validateTextEntry()) return;

		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);

		if (callbackHandle !== -1)
			UiToolkitAPI.InvokeJSCallback(callbackHandle, this.panels.textEntry.text.toLowerCase());
		UiToolkitAPI.CloseAllVisiblePopups();
	}

	validateTextEntry(): boolean {
		const text = this.panels.textEntry.text.toLowerCase();
		const regex = /^[\w-]+$/;
		const legalName = regex.test(text);

		if (!legalName) {
			this.panels.invalidName.text = 'You may only use characters a-z, 0-9, -, _';
			this.panels.invalidName.visible = true;
			return false;
		}

		return true;
	}

	onOkButtonPressed() {
		this.panels.textEntry.Submit();
	}

	onCancelPressed() {
		const callbackHandle = $.GetContextPanel().GetAttributeInt('closeCallback', -1);

		if (callbackHandle !== -1) UiToolkitAPI.InvokeJSCallback(callbackHandle, this.panels.textEntry.text);
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
