class SettingsShared {
	static paintContainer;
	static videoSettingsPanel;

	static onChangedTab(newTab) {
		switch (newTab) {
			case 'VideoSettings': {
				this.videoSettingsPanel ??= $('#VideoSettings');

				// Get the apply and discard buttons on the video settings screen
				const applyVideoSettingsButton =
					this.videoSettingsPanel.FindChildInLayoutFile('ApplyVideoSettingsButton');
				const discardVideoSettingsButton =
					this.videoSettingsPanel.FindChildInLayoutFile('DiscardVideoSettingsButton');

				// disabled as no user changes yet
				applyVideoSettingsButton.enabled = false;
				discardVideoSettingsButton.enabled = false;

				// Tell C++ to init controls from convars
				$.DispatchEvent('ChaosVideoSettingsInit');

				this.initTextureReplacementDropdown();

				break;
			}
			case 'OnlineSettings': {
				this.onlineSettingsUpdateModel();

				break;
			}
			case 'GameplaySettings': {
				this.updatePaintPreview();

				break;
			}
			// No default
		}

		const newTabPanel = $.GetContextPanel().FindChildInLayoutFile(newTab);
		this.refreshControlsRecursive(newTabPanel);
	}

	static refreshControlsRecursive(panel) {
		if (panel === null) return;

		panel.OnShow?.();

		for (const child of panel.Children() || []) this.refreshControlsRecursive(child);
	}

	static resetSettingsRecursive(panel) {
		// TODO: Add support for Enums and Colours here, then include
		if (panel.paneltype === 'ChaosSettingsSlider' || panel.paneltype === 'ChaosSettingsEnumDropDown') {
			panel.RestoreCVarDefault();
		} else if (panel.paneltype === 'ChaosSettingsKeyBinder') {
			// OptionsMenuAPI has already handled this, just refresh
			panel.OnShow?.();
		} else {
			for (const child of panel?.Children() || []) this.resetSettingsRecursive(child);
		}
	}

	static resetControls(panelID) {
		this.showConfirmResetSettings($.Localize('#Settings_General_ResetControls'), () => {
			// TODO: remove this out once api is ported
			typeof OptionsMenuAPI !== typeof undefined
				? OptionsMenuAPI.RestoreKeybdMouseBindingDefaults()
				: $.Msg('Keybinds resetting not yet implemented! Gimme the API!! Grr!!!!');
			this.resetSettingsRecursive($.GetContextPanel().FindChildTraverse(panelID));
		});
	}

	static resetSettings(panelID) {
		this.showConfirmResetSettings($.Localize('#Settings_General_ResetSomething'), () => {
			this.resetSettingsRecursive($.GetContextPanel().FindChildTraverse(panelID));
		});
	}

	static resetVideoSettings() {
		// For future: use same localisation string as above
		this.showConfirmResetSettings($.Localize('#Settings_General_ResetSomething'), () => {
			$.DispatchEvent('ChaosVideoSettingsResetDefault');
			this.resetSettingsRecursive($.GetContextPanel());
			this.videoSettingsOnUserInputSubmit();
		});
	}

	static showConfirmResetSettings(message, resetFn) {
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
			$.Localize('#Settings_General_Apply'),
			message,
			'warning-popup',
			$.Localize('#Action_Discard'),
			resetFn,
			$.Localize('#Action_Return'),
			() => {},
			'dim'
		);
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

	static showImportExportDialogue(localeString, panelID) {
		const section = $.GetContextPanel().FindChildTraverse(panelID);

		const cvars = [];

		const findCvarsRecursive = (panel) => {
			if (panel.paneltype && this.isSettingsPanel(panel) && panel.convar) cvars.push(panel.convar);
			for (const child of panel?.Children() || []) findCvarsRecursive(child);
		};

		findCvarsRecursive(section);

		let cvarParams = '';
		for (const [i, cvar] in cvars.entries())
			cvarParams += (index !== 0 ? '&' : '') + 'cvar' + (index + 1) + '=' + cvar;

		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/import-export-settings.xml',
			`${cvarParams}&name=${localeString}`
		);
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

		ghostPreview.SetCameraFOV(60);
		ghostPreview.SetModelRotationBoundsEnabled(true, false, false);
		ghostPreview.SetModelRotationBoundsX(-90, 90);
		ghostPreview.LookAtModel();
		ghostPreview.SetCameraOffset(-100, 0, 0);
		ghostPreview.SetModelColor(color);
		ghostPreview.SetModelBodygroup(1, bodygroup);
	}

	static initTextureReplacementDropdown() {
		const textures = {
			'#Settings_TextureReplace_Texture_None': '',
			'#Settings_TextureReplace_Texture_Noise': 'error_replacement/noise_basecolor',
			'#Settings_TextureReplace_Texture_Grid': 'error_replacement/grid_basecolor',
			'#Settings_TextureReplace_Texture_GridWithNoise': 'error_replacement/grid-noise_basecolor'
		};

		/** @type {Image} @static */
		const imagePanel = this.videoSettingsPanel.FindChildTraverse('TextureReplacePreview');

		/** @type {DropDown} @static */
		const dropdown = this.videoSettingsPanel
			.FindChildTraverse('MatErrorReplaceTexture')
			.FindChildTraverse('DropDown');

		// Clear the dropdown
		dropdown.RemoveAllOptions();

		const updatePanel = (override) => {
			const selected = dropdown.GetSelected();

			let path = '';
			if (override) {
				const valueIfInList = Object.values(textures).find((textureName) => override === textureName);

				if (valueIfInList) {
					path = valueIfInList;
				} else {
					// If we don't have the texture in the list, set the path directly to the override
					path = override;
					// Create our label so we can make it look nice
					$.CreatePanel('Label', dropdown, 'cvar-value', {
						text: `${path} (${$.Localize('#Settings_TextureReplace_Texture_Custom')})`,
						value: path
					});
				}
			} else if (selected) {
				// Panorama won't let me store the texturePath value in the panel, so find it again based on the name.
				// The $.Localize() is rather silly but once the panel's text has been set to a localised string, it differs
				// for the token `texturename`. We could localize the object keys in `textures` themselves, but I'm worried
				// V8 would have issues with weird chars in there.
				path = Object.entries(textures).find(
					([textureName, _]) => selected.text === $.Localize(textureName)
				)[1];
			}

			// Find and destroy the label because it's not a real option
			const cvarLabel = dropdown.FindChild('cvar-value');
			if (cvarLabel && selected && selected?.text !== `${path} (Custom)`) {
				cvarLabel.DeleteAsync(0);
			}

			imagePanel.SetHasClass('hide', !path);
			if (path) imagePanel.SetImage(`file://{materials}/${path}.vtf`);
		};

		dropdown.SetPanelEvent('onuserinputsubmit', updatePanel);

		// Update the panel the first time it gets loaded, passing in an override. This will ensure
		// the correct texture is set, even if the dropdown hasn't been populated yet.
		if (dropdown.AccessDropDownMenu().GetChildCount() === 0) {
			updatePanel(GameInterfaceAPI.GetSettingString('mat_error_texture_advanced_basetexture'));
		}

		for (const [i, [textureName, texturePath]] of Object.entries(textures).entries()) {
			const item = $.CreatePanel('Label', dropdown, `Texture${i}`, {
				text: $.Localize(textureName),
				value: texturePath
			});
			dropdown.AddOption(item);
		}
	}

	static isSettingsPanel(panel) {
		return [
			'ChaosSettingsEnum',
			'ChaosSettingsSlider',
			'ChaosSettingsEnumDropDown',
			'ChaosSettingsKeyBinder',
			'ChaosSettingsToggle',
			'ConVarColorDisplay'
		].includes(panel.paneltype);
	}
}
