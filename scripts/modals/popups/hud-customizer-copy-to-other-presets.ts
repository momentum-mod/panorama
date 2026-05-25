import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { GamemodeInfo } from 'common/gamemode';

export type CopyToOtherPresetsData = {
	title: string;
	gamemodes: string[];
	presetList: string[];
	componentID: string;
	onConfirm: (componentID: string, presetList: { gamemodeID: string; presetName: string }[]) => void;
};

@PanelHandler()
class HudCustomizerCopyToOtherPresetsHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		gamemodePresetContainer: $<Panel>('#GamemodePresetContainer'),
		titleLabel: $<Label>('#TitleLabel')
	};

	buttonList: Map<ToggleButton, { dropDown: DropDown; gamemodeID: string }> = new Map();
	data: CopyToOtherPresetsData;

	private getNameFromId(id: string): string | undefined {
		return [...GamemodeInfo.values()].find((gamemode) => gamemode.id === id)?.name;
	}

	onPanelLoad() {
		const callbackHandle = this.panels.cp.GetAttributeInt('data', -1);
		if (callbackHandle !== -1) {
			this.data = UiToolkitAPI.InvokeJSCallback(callbackHandle) as any as CopyToOtherPresetsData;
		}
		this.panels.titleLabel.text = this.data.title;

		const gamemodes = this.data.gamemodes.sort((a, b) => b.length - a.length);
		const orderedGamemodes = [...GamemodeInfo.values()]
			.map((info) => info.id)
			.filter((id) => gamemodes[0] === '' || gamemodes.includes(id));

		const getGamemodeForFile = (name: string) => gamemodes.find((id) => name.startsWith(id + '_'));
		const findFreeIndex = (gamemodeID: string, presetList: string[]) => {
			const prefix = 'preset';
			let i = 1;
			while (presetList.includes(`${gamemodeID}_${prefix}_${i}`)) {
				i++;
			}
			return `${prefix}_${i}`;
		};

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

			const presets = this.data.presetList
				.filter((name) => getGamemodeForFile(name) === gamemodeID)
				.map((name) => name.slice(gamemodeID.length + 1))
				.filter((name) => name !== 'default');

			const userPreset = $.persistentStorage.getItem(`hud-customizer.preset.${gamemodeID}`) as string;

			for (const preset of presets) {
				const presetPanel = $.CreatePanel('Label', dropdown, preset);
				presetPanel.text = preset;
				dropdown.AddOption(presetPanel);
			}

			// Add 'Create New' option at the bottom of the preset list
			const createNewOption = findFreeIndex(gamemodeID, this.data.presetList);
			const presetPanel = $.CreatePanel('Label', dropdown, createNewOption);
			presetPanel.text = 'Create New';
			dropdown.AddOption(presetPanel);

			dropdown.SetSelected(userPreset ?? createNewOption);

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
		const componentID = this.data.componentID ?? null;

		const activeValues = [...this.buttonList.entries()]
			.filter(([toggleButton]) => toggleButton.checked)
			.map(([, { dropDown, gamemodeID }]) => {
				const option = dropDown.GetSelected();
				return { gamemodeID: gamemodeID, presetName: option.id };
			});

		this.data.onConfirm(componentID, activeValues);
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
