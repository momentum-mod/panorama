import {OnPanelLoad, PanelHandler } from 'util/module-helpers';
import * as Colors from 'util/colors'; 
import { SettingsPage } from './page';

@PanelHandler()
export class OnlineSettings extends SettingsPage implements OnPanelLoad {
	onPanelLoad() {
		$.RegisterConVarChangeListener('mom_playercolor_primary_hue', () => this.onlineSettingsUpdateModel());
	}

	ghostPreview: ModelPanel;
	ghostPrimaryColor: Panel;
	ghostSecondaryColor: Panel;

	onlineSettingsUpdateModel() {
		// Silly design of settings page JS means we need logic like this to cache panels
		if (!this.ghostPreview) {
			const onlineSettings = $('#OnlineSettings');
			this.ghostPreview = onlineSettings.FindChildInLayoutFile<ModelPanel>('GhostModelPreview');
			this.ghostPrimaryColor = onlineSettings.FindChildInLayoutFile('GhostPrimaryColor');
			this.ghostSecondaryColor = onlineSettings.FindChildInLayoutFile('GhostSecondaryColor');
		}

		this.ghostPreview.SetCameraFOV(50);
		this.ghostPreview.SetModelRotation(0, 180, 0); // Model faces away from us by default, rotate it towards us
		this.ghostPreview.SetMouseXRotationScale(0, 1, 0); // By default mouse X will rotate the X axis, but we want it to spin Y axis
		this.ghostPreview.SetMouseYRotationScale(0, 0, 0); // Disable mouse Y movement rotations
		this.ghostPreview.LookAtModel();
		this.ghostPreview.SetCameraOffset(-65, 0, 0);

		this.ghostPreview.SetLightAmbient(1, 1, 1);
		this.ghostPreview.SetDirectionalLightColor(0, 2, 2, 2);
		this.ghostPreview.SetDirectionalLightDirection(0, 1, 1, -1);

		this.ghostPrimaryColor.style.backgroundColor = Colors.tupleToRgbaString(
			Colors.hsvaToRgba([
				GameInterfaceAPI.GetSettingFloat('mom_playercolor_primary_hue'),
				GameInterfaceAPI.GetSettingFloat('mom_playercolor_primary_saturation'),
				GameInterfaceAPI.GetSettingFloat('mom_playercolor_primary_value'),
				255
			])
		);

		this.ghostSecondaryColor.style.backgroundColor = Colors.tupleToRgbaString(
			Colors.hsvaToRgba([
				GameInterfaceAPI.GetSettingFloat('mom_playercolor_secondary_hue'),
				GameInterfaceAPI.GetSettingFloat('mom_playercolor_secondary_saturation'),
				1,
				255
			])
		);
	}
}
