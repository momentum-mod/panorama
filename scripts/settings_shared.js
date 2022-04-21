'use strict';

class SettingsShared {
	static paintContainer;
	static videoSettingsPanel;

	static onChangedTab(newTab) {
		if (newTab === 'VideoSettings') {
			this.videoSettingsPanel ??= $('#VideoSettings');

			// Get the apply and discard buttons on the video settings screen
			const applyVideoSettingsButton = this.videoSettingsPanel.FindChildInLayoutFile('ApplyVideoSettingsButton');
			const discardVideoSettingsButton = this.videoSettingsPanel.FindChildInLayoutFile('DiscardVideoSettingsButton');

			// disabled as no user changes yet
			applyVideoSettingsButton.enabled = false;
			discardVideoSettingsButton.enabled = false;

			// Tell C++ to init controls from convars
			$.DispatchEvent('ChaosVideoSettingsInit');

			this.initTextureReplacementDropdown();
		} else if (newTab === 'OnlineSettings') {
			this.onlineSettingsUpdateModel();
		} else if (newTab === 'GameplaySettings') {
			this.updatePaintPreview();
		}

		const newTabPanel = $.GetContextPanel().FindChildInLayoutFile(newTab);
		this.refreshControlsRecursive(newTabPanel);
	}

	static refreshControlsRecursive(panel) {
		if (panel === null) return;

		panel.OnShow?.();

		panel.Children()?.forEach((child) => this.refreshControlsRecursive(child));
	}

	static resetSettingsRecursive(panel) {
		// TODO: Add support for Enums and Colours here, then include
		if (panel.paneltype === 'ChaosSettingsSlider' || panel.paneltype === 'ChaosSettingsEnumDropDown') {
			panel.RestoreCVarDefault();
		} else if (panel.paneltype === 'ChaosSettingsKeyBinder') {
			// OptionsMenuAPI has already handled this, just refresh
			panel.OnShow?.();
		} else {
			panel.Children()?.forEach((child) => this.resetSettingsRecursive(child));
		}
	}

	static resetControls(panelID) {
		this.showConfirmResetSettings('Are you sure you want to reset all controls?', () => {
			// TODO: remove this out once api is ported
			typeof OptionsMenuAPI !== typeof undefined
				? OptionsMenuAPI.RestoreKeybdMouseBindingDefaults()
				: $.Msg('Keybinds resetting not yet implemented! Gimme the API!! Grr!!!!');
			this.resetSettingsRecursive($.GetContextPanel().FindChildTraverse(panelID));
		});
	}

	static resetSettings(panelID) {
		this.showConfirmResetSettings('Are you sure you want to reset these settings?', () => {
			this.resetSettingsRecursive($.GetContextPanel().FindChildTraverse(panelID));
		});
	}

	static resetVideoSettings() {
		// For future: use same localisation string as above
		this.showConfirmResetSettings('Are you sure you want to reset these settings?', () => {
			$.DispatchEvent('ChaosVideoSettingsResetDefault');
			this.resetSettingsRecursive($.GetContextPanel());
			this.videoSettingsOnUserInputSubmit();
		});
	}

	static showConfirmResetSettings(message, resetFn) {
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle('Confirm', message, 'warning-popup', 'Discard', resetFn, 'Return', () => {}, 'dim');
	}

	// State logic to tracking if there are changes to apply or discard:
	// Changes in panel controls -> enable both
	// Reset button pressed -> enable both
	// Apply button pressed -> disable both
	// Discard button pressed -> disable both

	static videoSettingsOnUserInputSubmit() {
		$('#ApplyVideoSettingsButton').enabled = true;
		$('#DiscardVideoSettingsButton').enabled = true;
	}

	static videoSettingsResetUserInput() {
		$('#ApplyVideoSettingsButton').enabled = false;
		$('#DiscardVideoSettingsButton').enabled = false;
	}

	static videoSettingsDiscardChanges() {
		// Discard dialogue seems unnecessary here
		// this.showConfirmResetSettings('Are you sure you want to discard your changes to video settings?', () => {
		$.DispatchEvent('ChaosVideoSettingsInit');
		this.videoSettingsResetUserInput();
		// });
	}

	static videoSettingsApplyChanges() {
		$.DispatchEvent('ChaosApplyVideoSettings');
		this.videoSettingsResetUserInput();
	}

	static updatePaintPreview() {
		this.paintContainer ??= $('#GameplaySettings').FindChildInLayoutFile('PaintContainer');

		if (this.paintContainer.actuallayoutwidth === 0) {
			// Stupid hack. I can't figure out an appropriate event to handle when the panel is actually loaded
			$.Schedule(0.05, () => this.updatePaintPreview());
			return;
		}

		const width = this.paintContainer.actuallayoutwidth / this.paintContainer.actualuiscale_x;

		const color = GameInterfaceAPI.GetSettingColor('mom_paint_color');
		const scale = GameInterfaceAPI.GetSettingFloat('mom_paint_scale');

		const paintPanel = this.paintContainer.FindChild('PaintBlob');

		paintPanel.style.backgroundColor = color;
		paintPanel.style.width = scale * width + 'px';
	}

	static onlineSettingsUpdateModel() {
		const color = GameInterfaceAPI.GetSettingColor('mom_ghost_color');
		const bodygroup = GameInterfaceAPI.GetSettingInt('mom_ghost_bodygroup');

		const onlineSettingsPanel = $('#OnlineSettings');
		const ghostPreview = onlineSettingsPanel.FindChildInLayoutFile('GhostModelPreview');

		ghostPreview.SetCameraFOV(60.0);
		ghostPreview.SetModelRotationBoundsEnabled(true, false, false);
		ghostPreview.SetModelRotationBoundsX(-90.0, 90.0);
		ghostPreview.LookAtModel();
		ghostPreview.SetCameraOffset(-100.0, 0.0, 0.0);
		ghostPreview.SetModelColor(color);
		ghostPreview.SetModelBodygroup(1, bodygroup);
	}

	static initTextureReplacementDropdown() {
		const textures = {
			"None": "",
			"Noise": "error_replacement/noise_basecolor",
			"Grid": "error_replacement/grid_basecolor",
			"Grid with Noise": "error_replacement/grid-noise_basecolor"
		}

		/** @type {Image} @static */
		const imagePanel = this.videoSettingsPanel.FindChildTraverse('TextureReplacePreview');

		/** @type {Dropdown} @static */
		const dropdown = this.videoSettingsPanel.FindChildTraverse('MatErrorReplaceTexture').FindChildTraverse('DropDown');

		// Clear the dropdown
		dropdown.RemoveAllOptions();
		
		const updatePanel = (override) => {
			const selected = dropdown.GetSelected();

			let path = '';
			if (override) {
				const isInList = Object.values(textures).find((textureName) => override === textureName);

				if (isInList) {
					path = isInList;
				} else {
					// If we don't have the texture in the list, set the path directly to the override
					path = override;
					// Create our label so we can make it look nice
					$.CreatePanel('Label', dropdown, 'cvar-value', { text: `${path} (Custom)`, value: path });
				}

			} else {
				// Panorama won't let me store the texturePath value in the panel, so find it again based on the name.
				path = Object.entries(textures).find(([textureName, _]) => selected.text === textureName)[1];
			}

			// Find and destroy the label because it's not a real option
			const cvarLabel = dropdown.FindChild('cvar-value');
			if (cvarLabel && selected && selected.text !== `${path} (Custom)`) {
				cvarLabel.DeleteAsync(0);
			}

			imagePanel.SetHasClass('hide', !path);
			if (path) imagePanel.SetImage(`file://{materials}/${path}.vtf`);
		}

		dropdown.SetPanelEvent('onuserinputsubmit', updatePanel)

		Object.entries(textures).forEach(([textureName, texturePath], i) => {
			const item = $.CreatePanel('Label', dropdown, `Texture${i}`, { text: textureName, value: texturePath });
			dropdown.AddOption(item);
		});

		// Update the panel on init so it loads our texture
		updatePanel(GameInterfaceAPI.GetSettingString('mat_error_texture_advanced_basetexture'));
	}
}
