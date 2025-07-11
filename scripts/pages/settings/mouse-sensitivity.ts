import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class MouseSensitivitySettingsHandler implements OnPanelLoad {
	readonly panels = {
		dpi: $<TextEntry>('#DPI'),
		unitSelection: $<DropDown>('#UnitSelection'),
		unitsPer360: $<TextEntry>('#UnitsPer360')
	};

	readonly cmConversionFactor = 2.54;

	constructor() {
		$.RegisterConVarChangeListener('sensitivity', () => this.calculateSensitivity());
	}

	onPanelLoad() {
		this.panels.dpi.text = $.persistentStorage.getItem('settings.mouseDPI') ?? '';
		this.panels.unitSelection.SetSelected($.persistentStorage.getItem('settings.mouseUnitSelector'));
		this.calculateSensitivity();
	}

	calculateSensitivity() {
		if (!this.panels.dpi.text) return;

		const yaw = GameInterfaceAPI.GetSettingFloat('m_yaw');
		const eDPI = Number.parseFloat(this.panels.dpi.text) * GameInterfaceAPI.GetSettingFloat('sensitivity');
		let per360 = 360 / (eDPI * yaw);

		if (this.panels.unitSelection.GetSelected().id === 'm_sens_cm') {
			per360 *= this.cmConversionFactor;
		}

		this.panels.unitsPer360.text = per360.toFixed(2);
	}

	setSensitivity() {
		if (!this.panels.dpi.text) return;

		const yaw = GameInterfaceAPI.GetSettingFloat('m_yaw');
		const eDPI = 360 / yaw / +this.panels.unitsPer360.text;
		let sensitivity = eDPI / +this.panels.dpi.text;

		if (this.panels.unitSelection.GetSelected().id === 'm_sens_cm') {
			sensitivity *= this.cmConversionFactor;
		}

		GameInterfaceAPI.SetSettingFloat('sensitivity', sensitivity);
	}

	saveDPI() {
		$.persistentStorage.setItem('settings.mouseDPI', this.panels.dpi.text);
		this.calculateSensitivity();
	}

	saveUnitSelection() {
		$.persistentStorage.setItem('settings.mouseUnitSelector', this.panels.unitSelection.GetSelected().id);
		this.calculateSensitivity();
	}
}
