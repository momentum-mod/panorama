import { PanelHandler } from 'util/module-helpers';
import { SettingsPage } from './settings';

@PanelHandler()
export class GameplaySettings extends SettingsPage {
	paintContainer = $('PaintContainer');

	onPanelLoad() {
		$.RegisterConVarChangeListener('mom_paint_color', () => this.updatePaintPreview());
		$.RegisterConVarChangeListener('mom_paint_size', () => this.updatePaintPreview());
		super.onPanelLoad();
	}

	updatePaintPreview() {
		this.paintContainer ??= $('#GameplaySettings').FindChildInLayoutFile('PaintContainer');

		if (this.paintContainer.actuallayoutwidth === 0) {
			// Stupid hack. I can't figure out an appropriate event to handle when the panel is actually loaded
			$.Schedule(0.05, () => this.updatePaintPreview());
			return;
		}

		const width = this.paintContainer.actuallayoutwidth / this.paintContainer.actualuiscale_x;

		const color = GameInterfaceAPI.GetSettingColor('mom_paint_color');
		const scale = GameInterfaceAPI.GetSettingFloat('mom_paint_size');

		const paintPanel = this.paintContainer.FindChild<Panel>('PaintBlob');

		paintPanel.style.backgroundColor = color;
		paintPanel.style.width = scale * width + 'px';
	}
}
