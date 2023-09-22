const CM_CONVERSION_FACTOR = 2.54;

class MouseSensitivity {
	static panels = {
		/** @type {TextEntry} @static */
		dpi: $('#DPI'),
		/** @type {DropDown} @static */
		unitSelection: $('#UnitSelection'),
		/** @type {TextEntry} @static */
		unitsPer360: $('#UnitsPer360')
	};

	static calculateSensitivity() {
		if (!this.panels.dpi.text) return;

		const yaw = GameInterfaceAPI.GetSettingFloat('m_yaw');
		const eDPI = this.panels.dpi.text * GameInterfaceAPI.GetSettingFloat('sensitivity');
		let per360 = 360 / (eDPI * yaw);

		if (this.panels.unitSelection.GetSelected().id === 'm_sens_cm') per360 *= CM_CONVERSION_FACTOR;

		this.panels.unitsPer360.text = per360.toFixed(2);
	}

	static setSensitivity() {
		if (!this.panels.dpi.text) return;

		const yaw = GameInterfaceAPI.GetSettingFloat('m_yaw');
		const eDPI = 360 / yaw / this.panels.unitsPer360.text;
		let sensitivity = eDPI / this.panels.dpi.text;

		if (this.panels.unitSelection.GetSelected().id === 'm_sens_cm') sensitivity *= CM_CONVERSION_FACTOR;

		GameInterfaceAPI.SetSettingFloat('sensitivity', sensitivity);
	}

	static saveDPI() {
		$.persistentStorage.setItem('settings.mouseDPI', this.panels.dpi.text);
		this.calculateSensitivity();
	}

	static saveUnitSelection() {
		$.persistentStorage.setItem('settings.mouseUnitSelector', this.panels.unitSelection.GetSelected().id);
		this.calculateSensitivity();
	}

	static loadSettings() {
		this.panels.dpi.text = $.persistentStorage.getItem('settings.mouseDPI') ?? '';
		this.panels.unitSelection.SetSelected($.persistentStorage.getItem('settings.mouseUnitSelector'));
		this.calculateSensitivity();
	}

	static {
		$.RegisterConVarChangeListener('sensitivity', this.calculateSensitivity.bind(this));
	}
}
