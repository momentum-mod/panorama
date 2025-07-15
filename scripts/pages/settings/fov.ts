import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import * as MomMath from 'util/math';

@PanelHandler()
export class FovHandler implements OnPanelLoad {
	readonly panels = {
		fovSlider: $<SettingsSlider>('#FOV'),
		horizontalFov: $<TextEntry>('#FOV_Horizontal'),
		aspectRatio: $<DropDown>('#FOV_Horizontal_AspectRatioEnum')
	};

	onPanelLoad() {
		this.updateFov();
	}

	get aspectRatio(): number {
		const id = this.panels.aspectRatio.GetSelected().id;
		switch (id) {
			case 'aspectratio0':
				return 4 / 3;
			case 'aspectratio1':
				return 16 / 9;
			case 'aspectratio2':
				return 16 / 10;
			default:
				return Number.NaN;
		}
	}

	// Based on https://casualhacks.net/Source-FOV-calculator.html
	fovToHorizontal(fov: number): number {
		const ratioRatio = this.aspectRatio / (4 / 3);
		return 2 * MomMath.rad2deg(Math.atan(Math.tan(MomMath.deg2rad(fov) / 2) * ratioRatio));
	}

	horizontalToFov(horizontalFov: number): number {
		const ratioRatio = this.aspectRatio / (4 / 3);
		return 2 * MomMath.rad2deg(Math.atan(Math.tan(MomMath.deg2rad(horizontalFov) / 2) / ratioRatio));
	}

	updateFov(): void {
		if (!this.panels.fovSlider || !this.panels.horizontalFov) return;

		let fov = GameInterfaceAPI.GetSettingFloat('fov_desired');
		fov = Math.round(this.fovToHorizontal(fov));

		if (!Number.isNaN(fov)) {
			this.panels.horizontalFov.text = fov.toString();
		}
	}

	updateHorizontalFov(): void {
		if (!this.panels.fovSlider || !this.panels.horizontalFov) return;

		let fov = Number.parseFloat(this.panels.horizontalFov.text);
		fov = Math.round(this.horizontalToFov(fov));

		if (!Number.isNaN(fov)) {
			const fovText = this.panels.fovSlider.FindChildTraverse<TextEntry>('Value');
			fovText.text = fov.toString();
			fovText.Submit();
		}
	}
}
