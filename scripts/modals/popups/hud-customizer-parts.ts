import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import type { LayerParts } from 'common/hud-presets';

type PartsOption = keyof typeof PartsBits;

enum PartsBits {
	position = 1 << 0,
	styles = 1 << 1,
	both = position | styles
}

/**
 * Asks which parts of a HUD component an action is for: its position, its styles, or both. Used by Reset and Apply to
 * base. Attributes: title, message, okText, and callback (called with the LayerParts).
 */
@PanelHandler()
class HudCustomizerPartsHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		title: $<Label>('#TitleLabel'),
		message: $<Label>('#MessageLabel'),
		okLabel: $<Label>('#OkLabel'),
		both: $<RadioButton>('#BothButton')
	};

	parts: LayerParts = { position: false, styles: false };

	onPanelLoad() {
		this.panels.title.text = this.panels.cp.GetAttributeString('title', 'Reset');
		this.panels.message.text = this.panels.cp.GetAttributeString('message', '');
		this.panels.okLabel.text = this.panels.cp.GetAttributeString('okText', 'OK');

		this.panels.both.checked = true;
		this.setParts('both');
	}

	setParts(option: PartsOption) {
		const bits = PartsBits[option];
		this.parts = {
			position: !!(bits & PartsBits.position),
			styles: !!(bits & PartsBits.styles)
		};
	}

	onOkPressed() {
		const callbackHandle = this.panels.cp.GetAttributeInt('callback', -1);

		if (callbackHandle !== -1) {
			UiToolkitAPI.InvokeJSCallback(callbackHandle, this.parts);
		}

		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
