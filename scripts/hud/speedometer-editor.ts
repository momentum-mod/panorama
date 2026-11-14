import type { CustomizerRenderApi } from 'common/hud-customizer';
import {
	ColorRange,
	normalizeColorProfiles,
	normalizeSpeedometers,
	RangeColorProfile,
	SpeedometerColorType,
	SpeedometerDispNames,
	SpeedometerSettings,
	SpeedometerType
} from 'common/speedometer';
import { rgbaStringToTuple, tupleToRgbaString } from 'util/colors';

/**
 * Editors for the speedometer list and the range color profile list, drawn by the Speedometer HUD component into
 * CustomizerPropertyType.CUSTOM rows.
 *
 * Rules (see the HUD customizer): never modify a value handed out by the customizer. Every edit clones the list through
 * api.getValue(), modifies the clone and passes it to api.setValue().
 *
 * Programmatic dropdown selection fires oninputsubmit, so every refresh is guarded with a refreshing flag.
 *
 * Snippets resolve against the layout file of the parent panel, which is the customizer's, so everything used here
 * is defined in layout/hud/customizer.xml.
 */

export interface SpeedometerEditorContext {
	/** The color profiles currently in use by the HUD component */
	getColorProfiles(): RangeColorProfile[];

	/** Set by the speedometer editor while it exists, so the profile dropdown can follow profile changes */
	refreshSpeedometerEditor?: () => void;
}

const COLOR_TYPE_COUNT = 4;

function addRow(parent: Panel, snippet: string, variables: Record<string, string> = {}): Panel {
	const row = $.CreatePanel('Panel', parent, '');
	row.LoadLayoutSnippet(snippet);
	for (const [name, value] of Object.entries(variables)) row.SetDialogVariable(name, value);
	return row;
}

function addOption(dropdown: DropDown, id: string, text: string): Label {
	const option = $.CreatePanel('Label', dropdown, id);
	option.text = text;
	dropdown.AddOption(option);
	return option;
}

function getSelectedID(dropdown: DropDown): string {
	return dropdown.GetSelected()?.id ?? '';
}

export function renderSpeedometerEditor(row: Panel, api: CustomizerRenderApi, ctx: SpeedometerEditorContext): void {
	const ITEM_PREFIX = 'SpeedometerItem';
	const ADD_ID = 'SpeedometerAdd';
	const NONE_ID = 'SpeedometerNone';
	const PROFILE_NONE_ID = 'ProfileNone';
	const PROFILE_PREFIX = 'Profile';
	const COLOR_TYPE_PREFIX = 'ColorType';

	let selected = 0;
	let refreshing = false;

	const getList = () => normalizeSpeedometers(api.getValue());

	const selectorRow = addRow(row, 'dynamic-dropdown', { name: $.Localize('#Settings_Speedometer_Title') });
	const selector = selectorRow.FindChildTraverse<DropDown>('DropDown')!;

	const axesRow = addRow(row, 'dynamic-togglegroup', { name: $.Localize('#Settings_Speedometer_EnabledAxes') });
	const axisToggles = [0, 1, 2].map((i) => {
		axesRow.FindChildTraverse<Label>(`Toggle${i}Label`)!.text = ['X', 'Y', 'Z'][i];
		return axesRow.FindChildTraverse<ToggleButton>(`Toggle${i}`)!;
	});

	const colorRow = addRow(row, 'dynamic-dropdown', { name: $.Localize('#Settings_Speedometer_Colorize_Type') });
	const colorDropdown = colorRow.FindChildTraverse<DropDown>('DropDown')!;
	for (let i = 0; i < COLOR_TYPE_COUNT; i++) {
		addOption(colorDropdown, `${COLOR_TYPE_PREFIX}${i}`, $.Localize(`#Settings_Speedometer_Colorize_Type${i}`));
	}

	const profileRow = addRow(row, 'dynamic-dropdown', {
		name: $.Localize('#Settings_Speedometer_ColorProfile_Title')
	});
	const profileDropdown = profileRow.FindChildTraverse<DropDown>('DropDown')!;

	const buttonsRow = addRow(row, 'dynamic-list-buttons', { rename: '', delete: $.Localize('#Common_Delete') });
	const moveUpButton = buttonsRow.FindChildTraverse<Button>('MoveUpButton')!;
	const moveDownButton = buttonsRow.FindChildTraverse<Button>('MoveDownButton')!;
	buttonsRow.FindChildTraverse<Button>('RenameButton')!.visible = false;
	const deleteButton = buttonsRow.FindChildTraverse<Button>('DeleteButton')!;

	const getLabel = ({ custom_label, type }: SpeedometerSettings) =>
		`${$.Localize(custom_label)} (${$.Localize(SpeedometerDispNames.get(type)!)})`;

	const refresh = () => {
		if (!selector.IsValid()) return;

		refreshing = true;

		const list = getList();
		const hasItems = list.length > 0;
		selected = Math.max(Math.min(selected, list.length - 1), 0);
		const current: SpeedometerSettings | undefined = list[selected];

		selector.RemoveAllOptions();
		for (const [i, speedo] of list.entries()) addOption(selector, `${ITEM_PREFIX}${i}`, getLabel(speedo));
		if (!hasItems) addOption(selector, NONE_ID, $.Localize('#Customizer_Speedometer_None'));
		addOption(selector, ADD_ID, $.Localize('#Settings_Speedometer_Add'));
		selector.SetSelected(hasItems ? `${ITEM_PREFIX}${selected}` : NONE_ID);

		axesRow.visible = hasItems && current.type !== SpeedometerType.ENERGY;
		colorRow.visible = hasItems;
		profileRow.visible = hasItems && current.color_type === SpeedometerColorType.RANGE;
		buttonsRow.visible = hasItems;

		if (current) {
			for (const [i, toggle] of axisToggles.entries()) toggle.checked = current.enabled_axes[i];

			colorDropdown.SetSelected(`${COLOR_TYPE_PREFIX}${current.color_type}`);

			profileDropdown.RemoveAllOptions();
			addOption(profileDropdown, PROFILE_NONE_ID, $.Localize('#Settings_Speedometer_ColorProfile_Type0'));
			const profiles = ctx.getColorProfiles();
			for (const [i, { profile_name }] of profiles.entries()) {
				const option = addOption(profileDropdown, `${PROFILE_PREFIX}${i}`, $.Localize(profile_name));
				option.SetAttributeString('profile-name', profile_name);
			}

			// A stored profile that doesn't exist (anymore) shows as no profile, the stored value is left alone
			const profileIndex = profiles.findIndex(({ profile_name }) => profile_name === current.range_color_profile);
			profileDropdown.SetSelected(profileIndex === -1 ? PROFILE_NONE_ID : `${PROFILE_PREFIX}${profileIndex}`);
		}

		refreshing = false;
	};

	const commit = (list: SpeedometerSettings[]) => {
		api.setValue(list);
		refresh();
	};

	const modifyCurrent = (modify: (speedo: SpeedometerSettings) => void) => {
		const list = getList();
		const current = list[selected];
		if (!current) return;
		modify(current);
		commit(list);
	};

	selector.SetPanelEvent('oninputsubmit', () => {
		if (refreshing) return;

		const id = getSelectedID(selector);
		if (id === ADD_ID) {
			// Restore the previous selection right away, in case the popup is cancelled
			refresh();

			UiToolkitAPI.ShowCustomLayoutPopupParameters(
				'',
				'file://{resources}/layout/modals/popups/speedometer-select.xml',
				`speedometerNames=${getList()
					.map(({ custom_label }) => custom_label)
					.join(',')}&callback=${UiToolkitAPI.RegisterJSCallback((type: SpeedometerType, name: string) => {
					const list = getList();
					list.push({
						custom_label: name,
						type,
						enabled_axes: [true, true, true],
						color_type: SpeedometerColorType.NONE,
						range_color_profile: ''
					});
					selected = list.length - 1;
					commit(list);
				})}`
			);
		} else if (id.startsWith(ITEM_PREFIX)) {
			selected = Number(id.slice(ITEM_PREFIX.length));
			refresh();
		} else {
			refresh();
		}
	});

	for (const [i, toggle] of axisToggles.entries()) {
		toggle.SetPanelEvent('onactivate', () => {
			if (refreshing) return;
			const checked = toggle.checked;
			modifyCurrent((speedo) => (speedo.enabled_axes[i] = checked));
		});
	}

	colorDropdown.SetPanelEvent('oninputsubmit', () => {
		if (refreshing) return;
		const colorType = Number(getSelectedID(colorDropdown).slice(COLOR_TYPE_PREFIX.length));
		if (!(colorType >= 0 && colorType < COLOR_TYPE_COUNT)) return;
		modifyCurrent((speedo) => (speedo.color_type = colorType));
	});

	profileDropdown.SetPanelEvent('oninputsubmit', () => {
		if (refreshing) return;
		const option = profileDropdown.GetSelected();
		if (!option) return;
		const name = option.id === PROFILE_NONE_ID ? '' : option.GetAttributeString('profile-name', '');
		modifyCurrent((speedo) => (speedo.range_color_profile = name));
	});

	const moveCurrent = (up: boolean) => {
		const list = getList();
		if (list.length < 2 || !list[selected]) return;

		// Wraps around at the ends
		const newIndex = (selected + (up ? -1 : 1) + list.length) % list.length;
		const [item] = list.splice(selected, 1);
		list.splice(newIndex, 0, item);
		selected = newIndex;
		commit(list);
	};

	moveUpButton.SetPanelEvent('onactivate', () => moveCurrent(true));
	moveDownButton.SetPanelEvent('onactivate', () => moveCurrent(false));

	deleteButton.SetPanelEvent('onactivate', () => {
		const list = getList();
		if (!list[selected]) return;
		list.splice(selected, 1);
		commit(list);
	});

	refresh();
	ctx.refreshSpeedometerEditor = refresh;
}

/**
 * The speedometer editor's profile dropdown is refreshed by the HUD component whenever the profiles change
 * (see {@link SpeedometerEditorContext.refreshSpeedometerEditor}), which also covers resetting the style.
 */
export function renderColorProfileEditor(row: Panel, api: CustomizerRenderApi): void {
	const ITEM_PREFIX = 'ColorProfileItem';
	const ADD_ID = 'ColorProfileAdd';
	const NONE_ID = 'ColorProfileNone';

	let selected = 0;
	let refreshing = false;

	// The range rows, in the same order as the selected profile's ranges
	let rangeRows: Panel[] = [];

	const getList = () => normalizeColorProfiles(api.getValue());

	const selectorRow = addRow(row, 'dynamic-dropdown', { name: $.Localize('#Settings_Speedometer_ColorRange_Title') });
	const selector = selectorRow.FindChildTraverse<DropDown>('DropDown')!;

	const rangesPanel = $.CreatePanel('Panel', row, '', { class: 'hud-customizer-settings__custom' });

	const addRangeRow = addRow(row, 'dynamic-button', { name: $.Localize('#Settings_Speedometer_ColorRange_Add') });
	const buttonsRow = addRow(row, 'dynamic-list-buttons', {
		rename: $.Localize('#Common_Edit'),
		delete: $.Localize('#Common_Delete')
	});
	buttonsRow.FindChildTraverse<Button>('MoveUpButton')!.visible = false;
	buttonsRow.FindChildTraverse<Button>('MoveDownButton')!.visible = false;

	const getProfileNames = (list: RangeColorProfile[]) => list.map(({ profile_name }) => profile_name);

	const buildRangeRows = (ranges: ColorRange[]) => {
		rangesPanel.RemoveAndDeleteChildren();
		rangeRows = [];

		for (const [i, range] of ranges.entries()) {
			const rangeRow = addRow(rangesPanel, 'dynamic-rangecolor');
			const display = rangeRow.FindChildTraverse<RangeColorDisplay>('RangeColorDisplay')!;
			// Compact variant, see styles/components/range-color-display.scss
			display.AddClass('rangecolordisplay--compact');
			rangeRow.SetAttributeInt('range_sort', i);
			display.SetRange(range.min, range.max, tupleToRgbaString(range.color));

			display.SetPanelEvent('onrangechange', () => onRangeChanged(rangeRow, display));
			rangeRow.FindChildTraverse<Button>('DeleteButton')!.SetPanelEvent('onactivate', () => {
				const list = getList();
				const profile = list[selected];
				const index = rangeRows.indexOf(rangeRow);
				if (!profile || index === -1) return;
				profile.profile_ranges.splice(index, 1);
				commit(list);
			});

			rangeRows.push(rangeRow);
		}
	};

	const refresh = () => {
		if (!selector.IsValid()) return;

		refreshing = true;

		const list = getList();
		const hasItems = list.length > 0;
		selected = Math.max(Math.min(selected, list.length - 1), 0);
		const current: RangeColorProfile | undefined = list[selected];

		selector.RemoveAllOptions();
		for (const [i, { profile_name }] of list.entries()) {
			addOption(selector, `${ITEM_PREFIX}${i}`, $.Localize(profile_name));
		}
		if (!hasItems) addOption(selector, NONE_ID, $.Localize('#Customizer_ColorProfile_None'));
		addOption(selector, ADD_ID, $.Localize('#Settings_Speedometer_ColorProfile_Add'));
		selector.SetSelected(hasItems ? `${ITEM_PREFIX}${selected}` : NONE_ID);

		rangesPanel.visible = hasItems;
		addRangeRow.visible = hasItems;
		buttonsRow.visible = hasItems;

		buildRangeRows(current?.profile_ranges ?? []);

		refreshing = false;
	};

	const commit = (list: RangeColorProfile[]) => {
		api.setValue(list);
		refresh();
	};

	/**
	 * A range was edited. Writes it back, keeps the ranges sorted by min, and reorders the existing rows instead of
	 * rebuilding them so the entry that is being typed in keeps its focus.
	 */
	const onRangeChanged = (rangeRow: Panel, display: RangeColorDisplay) => {
		if (refreshing) return;

		const list = getList();
		const profile = list[selected];
		const index = rangeRows.indexOf(rangeRow);
		const range = profile?.profile_ranges[index];
		if (!range) return;

		const color = rgbaStringToTuple(display.color);
		const unchanged =
			range.min === display.min &&
			range.max === display.max &&
			range.color.every((channel, i) => channel === color[i]);
		if (unchanged) return;

		range.min = display.min;
		range.max = display.max;
		range.color = color;

		const order = profile.profile_ranges
			.map((r, i) => ({ r, row: rangeRows[i] }))
			.sort((a, b) => a.r.min - b.r.min);
		profile.profile_ranges = order.map(({ r }) => r);
		rangeRows = order.map(({ row }) => row);

		api.setValue(list);

		for (const [i, sortedRow] of rangeRows.entries()) sortedRow.SetAttributeInt('range_sort', i);
		rangesPanel.SortChildrenOnAttribute('range_sort', true);
	};

	const openNamePopup = (prefilledText: string, okText: string, callback: (name: string) => void) => {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/range-color-profile-name.xml',
			`profileNames=${getProfileNames(getList()).join(',')}&prefilledText=${prefilledText}&OKBtnText=${okText}&callback=${UiToolkitAPI.RegisterJSCallback(callback)}`
		);
	};

	selector.SetPanelEvent('oninputsubmit', () => {
		if (refreshing) return;

		const id = getSelectedID(selector);
		if (id === ADD_ID) {
			// Restore the previous selection right away, in case the popup is cancelled
			refresh();

			openNamePopup('', $.Localize('#Common_Create'), (name: string) => {
				const list = getList();
				list.push({ profile_name: name, profile_ranges: [] });
				selected = list.length - 1;
				commit(list);
			});
		} else if (id.startsWith(ITEM_PREFIX)) {
			selected = Number(id.slice(ITEM_PREFIX.length));
			refresh();
		} else {
			refresh();
		}
	});

	addRangeRow.FindChildTraverse<Button>('Button')!.SetPanelEvent('onactivate', () => {
		const list = getList();
		const profile = list[selected];
		if (!profile) return;
		profile.profile_ranges.push({ min: 0, max: 1, color: [255, 255, 255, 255] });
		profile.profile_ranges.sort((a, b) => a.min - b.min);
		commit(list);
	});

	buttonsRow.FindChildTraverse<Button>('RenameButton')!.SetPanelEvent('onactivate', () => {
		const profile = getList()[selected];
		if (!profile) return;

		// Speedometers referencing the old name are not updated, they behave as having no profile
		openNamePopup(profile.profile_name, $.Localize('#Common_Edit'), (name: string) => {
			const list = getList();
			if (!list[selected]) return;
			list[selected].profile_name = name;
			commit(list);
		});
	});

	buttonsRow.FindChildTraverse<Button>('DeleteButton')!.SetPanelEvent('onactivate', () => {
		const list = getList();
		if (!list[selected]) return;
		list.splice(selected, 1);
		commit(list);
	});

	refresh();
}
