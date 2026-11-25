import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { GamemodeInfoList, GamemodeInfoProperties } from 'common/gamemode';

export type PresetRef = { gamemodeID: string; presetName: string };

export type CopyToOtherPresetsData = {
	title: string;
	gamemodes: GamemodeInfoProperties[];
	presetList: string[];
	savedPresetList: string[];
	currentGamemodeID: string;
	currentPreset: string;
	componentID?: string;
	onConfirm: (componentID: string | null, source: PresetRef, targets: PresetRef[]) => void;
};

type SourceRow = {
	rowPanel: Panel;
	dropDown: DropDown;
	gamemodeID: string;
};

type TargetRow = {
	rowPanel: Panel;
	dropDown: DropDown;
	gamemodeID: string;
};

@PanelHandler()
class HudCustomizerCopyToOtherPresetsHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		titleLabel: $<Label>('#TitleLabel'),
		sourceContainer: $<Panel>('#SourcePresetContainer'),
		noSourcesLabel: $<Label>('#NoSourcesLabel'),
		gamemodePresetContainer: $<Panel>('#GamemodePresetContainer'),
		confirmButton: $<Button>('#ConfirmButton')
	};

	sourceRows: Map<RadioButton, SourceRow> = new Map();
	buttonList: Map<ToggleButton, TargetRow> = new Map();
	selectedSource?: RadioButton;
	data: CopyToOtherPresetsData;

	onPanelLoad() {
		const callbackHandle = this.panels.cp.GetAttributeInt('data', -1);
		if (callbackHandle !== -1) {
			this.data = UiToolkitAPI.InvokeJSCallback(callbackHandle) as any as CopyToOtherPresetsData;
		} else {
			throw new Error('Missing callback for copy-to-other-presets data');
		}

		this.panels.titleLabel.text = this.data.title;

		const getGamemodeForFile = (name: string) =>
			GamemodeInfoList.find((info) => name.startsWith(info.id + '_'))?.id;

		const presetsFor = (list: string[], gamemodeID: string) => [
			...new Set(
				list
					.filter((name) => getGamemodeForFile(name) === gamemodeID)
					.map((name) => name.slice(gamemodeID.length + 1))
					.filter((name) => name !== 'default')
			)
		];

		const findFreeIndex = (gamemodeID: string, presetList: string[]) => {
			const prefix = 'preset';
			let i = 1;
			while (presetList.includes(`${gamemodeID}_${prefix}_${i}`)) {
				i++;
			}
			return `${prefix}_${i}`;
		};

		// Populate Copy From (single select, saved presets only)
		for (const { id: gamemodeID, name: gamemodeName } of this.data.gamemodes) {
			const presets = presetsFor(this.data.savedPresetList, gamemodeID);
			if (presets.length === 0) continue;

			const panel = $.CreatePanel('Panel', this.panels.sourceContainer, '');
			panel.LoadLayoutSnippet('source-select');

			const radioButton = panel.FindChildInLayoutFile<RadioButton>('RadioButton');
			const dropdown = panel.FindChildInLayoutFile<DropDown>('DropDown');

			panel.FindChildInLayoutFile<Label>('RadioButtonLabel').text = gamemodeName;

			for (const preset of presets) {
				const presetPanel = $.CreatePanel('Label', dropdown, preset);
				presetPanel.text = preset;
				dropdown.AddOption(presetPanel);
			}

			const defaultPreset =
				gamemodeID === this.data.currentGamemodeID
					? (presets.find((preset) => preset !== this.data.currentPreset) ?? presets[0])
					: (() => {
							const userPreset = $.persistentStorage.getItem(
								`hud-customizer.preset.${gamemodeID}`
							) as string;
							return presets.includes(userPreset) ? userPreset : presets[0];
						})();
			dropdown.SetSelected(defaultPreset);

			radioButton.SetPanelEvent('onactivate', () => this.selectSourceRow(radioButton));
			dropdown.SetPanelEvent('oninputsubmit', () => this.updateConfirm());

			this.sourceRows.set(radioButton, { rowPanel: panel, dropDown: dropdown, gamemodeID });
		}

		this.panels.noSourcesLabel.visible = this.sourceRows.size === 0;

		const defaultSource =
			[...this.sourceRows.entries()].find(([, row]) => row.gamemodeID !== this.data.currentGamemodeID)?.[0] ??
			this.sourceRows.keys().next().value;
		if (defaultSource) {
			defaultSource.SetSelected(true);
			this.selectSourceRow(defaultSource);
		}

		// Populate Copy To (multi select, current gamemode enabled by default)
		for (const { id: gamemodeID, name: gamemodeName } of this.data.gamemodes) {
			const panel = $.CreatePanel('Panel', this.panels.gamemodePresetContainer, '');
			panel.LoadLayoutSnippet('preset-select');

			const toggleButton = panel.FindChildInLayoutFile<ToggleButton>('ToggleButton');
			const dropdown = panel.FindChildInLayoutFile<DropDown>('DropDown');
			const isCurrentGamemode = gamemodeID === this.data.currentGamemodeID;

			panel.FindChildInLayoutFile<Label>('ToggleButtonLabel').text = gamemodeName;

			const presets = presetsFor(this.data.presetList, gamemodeID);

			for (const preset of presets) {
				const presetPanel = $.CreatePanel('Label', dropdown, preset);
				presetPanel.text = preset;
				dropdown.AddOption(presetPanel);
			}

			// Add 'Create New' option at the bottom of the preset list
			const createNewOption = findFreeIndex(gamemodeID, this.data.presetList);
			const presetPanel = $.CreatePanel('Label', dropdown, createNewOption);
			presetPanel.text = $.Localize('#Customizer_Preset_CreateNew');
			dropdown.AddOption(presetPanel);

			const preferredPreset = isCurrentGamemode
				? this.data.currentPreset
				: ($.persistentStorage.getItem(`hud-customizer.preset.${gamemodeID}`) as string);
			const defaultTarget =
				preferredPreset && preferredPreset !== 'default' && presets.includes(preferredPreset)
					? preferredPreset
					: createNewOption;
			dropdown.SetSelected(defaultTarget);

			toggleButton.checked = isCurrentGamemode;
			dropdown.enabled = isCurrentGamemode;
			panel.SetHasClass('copy-preset-popup__row--selected', isCurrentGamemode);

			toggleButton.SetPanelEvent('onactivate', () => {
				dropdown.enabled = toggleButton.checked;
				panel.SetHasClass('copy-preset-popup__row--selected', toggleButton.checked);
				this.updateConfirm();
			});

			dropdown.SetPanelEvent('oninputsubmit', () => this.updateConfirm());

			this.buttonList.set(toggleButton, {
				rowPanel: panel,
				dropDown: dropdown,
				gamemodeID
			});
		}

		this.updateConfirm();
	}

	selectSourceRow(selected: RadioButton) {
		this.selectedSource = selected;
		this.sourceRows.forEach(({ rowPanel, dropDown }, radioButton) => {
			const isSelected = radioButton === selected;
			dropDown.enabled = isSelected;
			rowPanel.SetHasClass('copy-preset-popup__row--selected', isSelected);
		});
		this.updateConfirm();
	}

	setAllButtons(enabled: boolean) {
		this.buttonList.forEach(({ rowPanel, dropDown }, toggleButton) => {
			toggleButton.checked = enabled;
			dropDown.enabled = enabled;
			rowPanel.SetHasClass('copy-preset-popup__row--selected', enabled);
		});
		this.updateConfirm();
	}

	getSource(): PresetRef | null {
		if (!this.selectedSource) return null;
		const row = this.sourceRows.get(this.selectedSource);
		const option = row?.dropDown.GetSelected();
		if (!row || !option) return null;
		return { gamemodeID: row.gamemodeID, presetName: option.id };
	}

	getTargets(): PresetRef[] {
		const source = this.getSource();
		return [...this.buttonList.entries()]
			.filter(([toggleButton]) => toggleButton.checked)
			.map(([, { dropDown, gamemodeID }]) => ({
				gamemodeID,
				presetName: dropDown.GetSelected().id
			}))
			.filter(
				(target) =>
					!source || target.gamemodeID !== source.gamemodeID || target.presetName !== source.presetName
			);
	}

	updateConfirm() {
		this.panels.confirmButton.enabled = Boolean(this.getSource()) && this.getTargets().length > 0;
	}

	onOkButtonPressed() {
		const source = this.getSource();
		const targets = this.getTargets();
		if (!source || targets.length === 0) return;

		const componentID = this.data.componentID ?? null;
		this.data.onConfirm(componentID, source, targets);
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
