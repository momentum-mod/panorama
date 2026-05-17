import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { GamemodeInfo } from 'common/gamemode';

@PanelHandler()
class HudCustomizerApplyToOtherPresetsHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		gamemodePresetContainer: $<Panel>('#GamemodePresetContainer')
	};

	buttonList: Map<ToggleButton, { dropDown: DropDown; gamemodeID: string }> = new Map();

	private getNameFromId(id: string): string | undefined {
		return [...GamemodeInfo.values()].find((gamemode) => gamemode.id === id)?.name;
	}

	onPanelLoad() {
		const gamemodes = this.panels.cp
			.GetAttributeString('gamemodes', '')
			.split(',')
			.sort((a, b) => b.length - a.length);

		const orderedGamemodes = [...GamemodeInfo.values()]
			.map((info) => info.id)
			.filter((id) => gamemodes.includes(id));

		const getGamemodeForFile = (name: string) => gamemodes.find((id) => name.startsWith(id + '_'));
		const findFreeIndex = (gamemodeID: string, presetList: string[]) => {
			let i = 1;
			while (presetList.includes(`${gamemodeID}_preset_${i}`)) {
				i++;
			}
			return `preset_${i}`;
		};

		const presetList = this.panels.cp.GetAttributeString('presetList', '').split(',');

		for (const gamemodeID of orderedGamemodes) {
			const panel = $.CreatePanel('Panel', this.panels.gamemodePresetContainer, '', {
				class: 'mt-3',
				style: 'min-width: 400px'
			});
			panel.LoadLayoutSnippet('preset-select');

			const toggleButton = panel.FindChildInLayoutFile<ToggleButton>('ToggleButton');
			const dropdown = panel.FindChildInLayoutFile<DropDown>('DropDown');
			toggleButton.SetPanelEvent('onactivate', () => {
				dropdown.enabled = toggleButton.checked;
			});
			toggleButton.checked = true;

			const toggleButtonLabel = panel.FindChildInLayoutFile<Label>('ToggleButtonLabel');
			toggleButtonLabel.text = this.getNameFromId(gamemodeID);

			const presets = presetList
				.filter((name) => getGamemodeForFile(name) === gamemodeID)
				.map((name) => name.slice(gamemodeID.length + 1))
				.filter((name) => name !== 'default');

			const userPreset = $.persistentStorage.getItem(`hud-customizer.preset.${gamemodeID}`) as string;

			if (presets.length === 0 || !userPreset || userPreset === 'default') {
				presets.push(findFreeIndex(gamemodeID, presetList));
			}

			for (const preset of presets) {
				const presetPanel = $.CreatePanel('Label', dropdown, preset);
				presetPanel.text = preset;
				dropdown.AddOption(presetPanel);
			}

			dropdown.SetSelected(userPreset ?? presets.at(-1));

			this.buttonList.set(toggleButton, { dropDown: dropdown, gamemodeID });
		}
	}

	setAllButtons(enabled: boolean) {
		this.buttonList.forEach(({ dropDown }, toggleButton) => {
			toggleButton.checked = enabled;
			dropDown.enabled = enabled;
		});
	}

	onOkButtonPressed() {
		const callbackHandle = this.panels.cp.GetAttributeInt('callback', -1);

		const activeValues = [...this.buttonList.entries()]
			.filter(([toggleButton]) => toggleButton.checked)
			.map(([, { dropDown, gamemodeID }]) => {
				const option = dropDown.GetSelected();
				return { gamemodeID: gamemodeID, presetName: option.id };
			});

		if (callbackHandle !== -1) {
			UiToolkitAPI.InvokeJSCallback(callbackHandle, activeValues);
		}
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
