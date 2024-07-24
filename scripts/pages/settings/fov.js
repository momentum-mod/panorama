function deg2rad(x) {
	return (x / 180) * Math.PI;
}
function rad2deg(x) {
	return (x * 180) / Math.PI;
}

class Fov {
	static panels = {
		/** @type {SettingsSlider} @static */
		fov: $('#FOV'),
		/** @type {TextEntry} @static */
		horizontalFov: $('#FOV_Horizontal')
	};

	static loadSettings() {
		this.updateFOV();
	}

	static aspectRatio() {
		// find the display panel
		// there doesn't seem to be an api for this yet
		let panel = this.panels.fov;
		let parent = panel;
		while ((parent = panel.GetParent())) {
			panel = parent;
		}

		return panel.actuallayoutwidth / panel.actuallayoutheight;
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
