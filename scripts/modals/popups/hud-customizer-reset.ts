import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class HudCustomizerResetHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		title: $<Label>('#TitleLabel'),
		message: $<Label>('#MessageLabel'),
		position: $<ToggleButton>('#ResetPositionButton'),
		styles: $<ToggleButton>('#ResetStylesButton')
	};

	onPanelLoad() {
		$.GetContextPanel().SetDialogVariable('OKBtnText', $.GetContextPanel().GetAttributeString('OKBtnText', ''));

		this.panels.title.text = $.GetContextPanel().GetAttributeString('resetTitle', 'Reset');
		this.panels.message.text = $.GetContextPanel().GetAttributeString(
			'resetMessage',
			'Are you sure you want to reset this component?'
		);
	}

	OnOKPressed() {
		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);
		if (callbackHandle !== -1) {
			UiToolkitAPI.InvokeJSCallback(callbackHandle, {
				position: this.panels.position.checked,
				styles: this.panels.styles.checked
			});
		}
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
