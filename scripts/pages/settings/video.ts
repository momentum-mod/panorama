import { PanelHandler } from 'util/module-helpers';
import { SettingsPage } from './page';

@PanelHandler()
export class VideoSettings extends SettingsPage {
	videoSettingsPanel = $('#VideoSettings');

	override onSwitchedTo() {
		// Get the apply and discard buttons on the video settings screen
		const applyVideoSettingsButton = this.videoSettingsPanel.FindChildInLayoutFile('ApplyVideoSettingsButton');
		const discardVideoSettingsButton = this.videoSettingsPanel.FindChildInLayoutFile('DiscardVideoSettingsButton');

		// disabled as no user changes yet
		applyVideoSettingsButton.enabled = false;
		discardVideoSettingsButton.enabled = false;

		// Tell C++ to init controls from convars
		$.DispatchEvent('VideoSettingsInit');

		this.initTextureReplacementDropdown();
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

	resetVideoSettings() {
		// For future: use same localisation string as above
		this.showConfirmResetSettings($.Localize('#Settings_General_ResetSomething'), () => {
			$.DispatchEvent('VideoSettingsResetDefault');
			this.resetSettingsRecursive($.GetContextPanel());
			this.videoSettingsOnUserInputSubmit();
		});
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
}
