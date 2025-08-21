import { traverseChildren } from 'util/functions';

export abstract class SettingsPage  {
	/** Called when the tab is changed, e.g. from InputSettings to GeneralSettings */
	onSwitchedTo(): void {
		traverseChildren($.GetContextPanel()).forEach((panel) => {
			(panel as any).OnShow?.();
		});
	}

	resetSettingsRecursive(panel: GenericPanel) {
		traverseChildren(panel).forEach((child) => {
			if (panel.paneltype === 'SettingsSlider' || panel.paneltype === 'SettingsEnumDropDown') {
				panel.RestoreCVarDefault();
			} else if (panel.paneltype === 'SettingsKeyBinder') {
				// OptionsMenuAPI has already handled this, just refresh
				panel.OnShow?.();
			}
		});
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
}
