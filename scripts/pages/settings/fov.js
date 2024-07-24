class Fov {
	static panels = {
		/** @type {SettingsSlider} @static */
		fov: $('#FOV'),
		/** @type {TextEntry} @static */
		horizontalFov: $('#FOV_Horizontal'),
		aspectRatio: $('#FOV_Horizontal_AspectRatioEnum')
	};

	static loadSettings() {
		this.panels.aspectRatio.SetSelected('aspectratio1');
		this.updateFOV();
	}

	static aspectRatio() {
		const id = this.panels.aspectRatio.GetSelected().id;
		switch (id) {
			case 'aspectratio0':
				return 4 / 3;
			case 'aspectratio1':
				return 16 / 9;
			case 'aspectratio2':
				return 16 / 10;
		}
		return Number.NaN;
	}

	// based on https://casualhacks.net/Source-FOV-calculator.html
	static fovToHorizontal(fov) {
		const ratioRatio = this.aspectRatio() / (4 / 3);
		return 2 * rad2deg(Math.atan(Math.tan(deg2rad(fov) / 2) * ratioRatio));
	}

	static horizontalToFov(horizontalFov) {
		const ratioRatio = this.aspectRatio() / (4 / 3);
		return 2 * rad2deg(Math.atan(Math.tan(deg2rad(horizontalFov) / 2) / ratioRatio));
	}

	static updateFOV() {
		if (!this.panels.fov || !this.panels.horizontalFov) return;

		let fov = GameInterfaceAPI.GetSettingFloat('fov_desired');
		fov = Math.round(this.fovToHorizontal(fov));

		if (!Number.isNaN(fov)) {
			this.panels.horizontalFov.text = fov;
		}
	}

	static updateHorizontalFov() {
		if (!this.panels.fov || !this.panels.horizontalFov) return;

		let fov = Number.parseFloat(this.panels.horizontalFov.text);
		fov = Math.round(this.horizontalToFov(fov));

		if (!Number.isNaN(fov)) {
			const fovText = this.panels.fov.FindChildTraverse('Value');
			fovText.text = fov;
			fovText.Submit();
		}
	}
}
