import { PanelHandler } from 'util/module-helpers';
import { isSettingsPanel } from 'common/settings';
import { traverseChildren } from 'util/functions';

@PanelHandler()
export class SettingsPage {
	paintContainer: Panel;
	videoSettingsPanel: Panel;

	onChangedTab(newTab: string) {
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
				$.DispatchEvent('VideoSettingsInit');

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

	refreshControlsRecursive(panel: GenericPanel) {
		if (panel === null) return;

		(panel as any).OnShow?.();

		for (const child of panel.Children() || []) this.refreshControlsRecursive(child);
	}

	resetSettingsRecursive(panel: GenericPanel) {
		// TODO: Add support for Enums and Colours here, then include
		if (panel.paneltype === 'SettingsSlider' || panel.paneltype === 'SettingsEnumDropDown') {
			panel.RestoreCVarDefault();
		} else if (panel.paneltype === 'SettingsKeyBinder') {
			// OptionsMenuAPI has already handled this, just refresh
			panel.OnShow?.();
		} else {
			for (const child of panel?.Children() || []) this.resetSettingsRecursive(child);
		}
	}

	resetControls(panelID: string) {
		this.showConfirmResetSettings($.Localize('#Settings_General_ResetControls'), () => {
			OptionsMenuAPI?.RestoreKeybdMouseBindingDefaults?.();
			this.resetSettingsRecursive($.GetContextPanel().FindChildTraverse(panelID));
		});
	}

	resetSettings(panelID: string) {
		this.showConfirmResetSettings($.Localize('#Settings_General_ResetSomething'), () => {
			this.resetSettingsRecursive($.GetContextPanel().FindChildTraverse(panelID));
		});
	}

	resetVideoSettings() {
		// For future: use same localisation string as above
		this.showConfirmResetSettings($.Localize('#Settings_General_ResetSomething'), () => {
			$.DispatchEvent('VideoSettingsResetDefault');
			this.resetSettingsRecursive($.GetContextPanel());
			this.videoSettingsOnUserInputSubmit();
		});
	}

	showConfirmResetSettings(message: string, resetFn: () => void) {
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

	videoSettingsOnUserInputSubmit() {
		$('#ApplyVideoSettingsButton').enabled = true;
		$('#DiscardVideoSettingsButton').enabled = true;
	}

	videoSettingsResetUserInput() {
		$('#ApplyVideoSettingsButton').enabled = false;
		$('#DiscardVideoSettingsButton').enabled = false;
	}

	videoSettingsDiscardChanges() {
		// Discard dialogue seems unnecessary here
		// this.showConfirmResetSettings('Are you sure you want to discard your changes to video settings?', () => {
		$.DispatchEvent('VideoSettingsInit');
		this.videoSettingsResetUserInput();
		// });
	}

	videoSettingsApplyChanges() {
		$.DispatchEvent('ApplyVideoSettings');
		this.videoSettingsResetUserInput();
	}

	showImportExportDialogue(localeString: string, panelID: string) {
		const section = $.GetContextPanel().FindChildTraverse(panelID);

		const cvars = traverseChildren(section)
			.filter((panel) => isSettingsPanel(panel) && panel.paneltype !== 'SettingsKeyBinder')
			.map((panel) => panel.convar)
			.toArray();

		let cvarParams = '';
		for (const [i, cvar] of cvars.entries()) cvarParams += (i !== 0 ? '&' : '') + 'cvar' + (i + 1) + '=' + cvar;

		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/import-export-settings.xml',
			`${cvarParams}&name=${localeString}`
		);
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
		const scale = GameInterfaceAPI.GetSettingFloat('mom_paint_scale');

		const paintPanel = this.paintContainer.FindChild<Panel>('PaintBlob');

		paintPanel.style.backgroundColor = color;
		paintPanel.style.width = scale * width + 'px';
	}

	onlineSettingsUpdateModel() {
		const color = GameInterfaceAPI.GetSettingColor('mom_ghost_color');
		const bodygroup = GameInterfaceAPI.GetSettingInt('mom_ghost_bodygroup');

		const onlineSettingsPanel = $('#OnlineSettings');
		const ghostPreview = onlineSettingsPanel.FindChildInLayoutFile<ModelPanel>('GhostModelPreview');

		ghostPreview.SetCameraFOV(60);
		ghostPreview.SetModelRotationBoundsEnabled(true, false, false);
		ghostPreview.SetModelRotationBoundsX(-90, 90);
		ghostPreview.LookAtModel();
		ghostPreview.SetCameraOffset(-100, 0, 0);
		ghostPreview.SetModelColor(color);
		ghostPreview.SetModelBodygroup(1, bodygroup);
	}

	initTextureReplacementDropdown() {
		const textures = {
			'#Settings_TextureReplace_Texture_None': '',
			'#Settings_TextureReplace_Texture_Noise': 'error_replacement/noise_basecolor',
			'#Settings_TextureReplace_Texture_Grid': 'error_replacement/grid_basecolor',
			'#Settings_TextureReplace_Texture_GridWithNoise': 'error_replacement/grid-noise_basecolor'
		};

		const imagePanel = this.videoSettingsPanel.FindChildTraverse<Image>('TextureReplacePreview');

		const dropdown = this.videoSettingsPanel
			.FindChildTraverse('MatErrorReplaceTexture')
			.FindChildTraverse<DropDown>('DropDown');

		// Clear the dropdown
		dropdown.RemoveAllOptions();

		const updatePanel = (override: string) => {
			const selected = dropdown.GetSelected<Label>();

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
}
