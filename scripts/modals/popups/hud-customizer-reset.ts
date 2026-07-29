import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { ResetOptions } from 'hud/customizer';

type RadioOption = keyof typeof RadioButtonMap;

enum RadioButtonMap {
	position = 1 << 0,
	styles = 1 << 1,
	both = position | styles
}

@PanelHandler()
class HudCustomizerResetHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		title: $<Label>('#TitleLabel'),
		message: $<Label>('#MessageLabel'),
		resetPosition: $<RadioButton>('#ResetPositionButton'),
		resetStyles: $<RadioButton>('#ResetStylesButton'),
		resetBoth: $<RadioButton>('#ResetBothButton')
	};

	resetOptions: ResetOptions = { position: false, styles: false };

	onPanelLoad() {
		this.panels.title.text = $.GetContextPanel().GetAttributeString('resetTitle', 'Reset');
		this.panels.message.text = $.GetContextPanel().GetAttributeString(
			'resetMessage',
			'Are you sure you want to reset this component?'
		);

		this.panels.resetBoth.checked = true;
		this.setResetOptions('both');
	}

	setResetOptions(option: RadioOption) {
		const val = RadioButtonMap[option];
		this.resetOptions = {
			position: !!(val & RadioButtonMap.position),
			styles: !!(val & RadioButtonMap.styles)
		};
	}

	onResetSelectedPressed() {
		const callbackHandle = $.GetContextPanel().GetAttributeInt('callback', -1);

		if (callbackHandle !== -1) {
			UiToolkitAPI.InvokeJSCallback(callbackHandle, this.resetOptions);
		}

		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
