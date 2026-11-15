import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { PRESET_NAME_PATTERN } from 'common/hud-layers';

@PanelHandler()
class HudCustomizerLayoutNameHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		title: $<Label>('#TitleLabel'),
		input: $<Label>('#InputLabel'),
		textEntry: $<TextEntry>('#TextEntry'),
		invalidName: $<Label>('#InvalidNameLabel'),
		note: $<Label>('#NoteLabel'),
		okButtonLabel: $<Label>('#OkButtonLabel')
	};

	onPanelLoad() {
		this.panels.title.text = this.panels.cp.GetAttributeString('title', 'Input');
		this.panels.input.text = this.panels.cp.GetAttributeString('input_label', 'Input Value');
		this.panels.okButtonLabel.text = this.panels.cp.GetAttributeString('ok_btn_label', $.Localize('#Common_OK'));
		this.panels.textEntry.text = this.panels.cp.GetAttributeString('prefilled_text', '');

		this.panels.invalidName.visible = false;

		// Optional extra line under the entry, e.g. which names already have a base
		this.panels.note.text = this.panels.cp.GetAttributeString('note', '');
		this.panels.note.visible = this.panels.note.text !== '';
	}

	onTextSubmitted() {
		if (!this.validateTextEntry()) return;

		const callbackHandle = this.panels.cp.GetAttributeInt('callback', -1);

		if (callbackHandle !== -1) {
			UiToolkitAPI.InvokeJSCallback(callbackHandle, this.panels.textEntry.text.toLowerCase());
		}

		UiToolkitAPI.CloseAllVisiblePopups();
	}

	validateTextEntry(): boolean {
		const text = this.panels.textEntry.text.toLowerCase();
		const legalName = PRESET_NAME_PATTERN.test(text);

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
}
