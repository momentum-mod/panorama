import { PanelHandler } from 'util/module-helpers';
import { rgbaStringToTuple, RgbaTuple, tupleToRgbaString } from 'util/colors';
import { SpeedometerColorType, SpeedometerDispNames, SpeedometerType } from 'common/speedometer';
import { Gamemode } from 'common/web';
import { GamemodeInfo } from 'common/gamemode';

const DEFAULT_GAMEMODE = Gamemode.SURF;

class Speedometer {
	name: string;
	type: SpeedometerType;

	readonly panels: {
		container: Panel;
		name: Label;
		detail: Panel;
		profileSetting: Panel;
		toggle: ToggleButton;
		discard: Button;
		delete: Button;
		axes: Panel;
		xaxisToggle: ToggleButton;
		yaxisToggle: ToggleButton;
		zaxisToggle: ToggleButton;
		colorMode: DropDown;
		colorProfile: DropDown;
		moveup: Button;
		movedown: Button;
	};

	constructor(speedo: SpeedometerSettingsAPI.Settings) {
		this.name = speedo.custom_label;
		this.type = speedo.type;

		const container = $.CreatePanel('Panel', Speedometers.panels.main, '');
		container.LoadLayoutSnippet('speedometer');

		this.panels = {
			container,
			name: container.FindChildInLayoutFile('SpeedometerName'),
			detail: container.FindChildInLayoutFile('SpeedometerDetailContainer'),
			profileSetting: container.FindChildInLayoutFile('SpeedometerColorProfileContainer'),
			toggle: container.FindChildInLayoutFile('SpeedometerToggleBtn'),
			discard: container.FindChildInLayoutFile('SpeedometerDiscardBtn'),
			delete: container.FindChildInLayoutFile('SpeedometerDeleteBtn'),
			axes: container.FindChildInLayoutFile('SpeedometerAxesContainer'),
			xaxisToggle: container.FindChildInLayoutFile('SpeedometerXAxisToggleButton'),
			yaxisToggle: container.FindChildInLayoutFile('SpeedometerYAxisToggleButton'),
			zaxisToggle: container.FindChildInLayoutFile('SpeedometerZAxisToggleButton'),
			colorMode: container.FindChildInLayoutFile('SpeedometerColorMode'),
			colorProfile: container.FindChildInLayoutFile('SpeedometerColorProfile'),
			moveup: container.FindChildInLayoutFile('SpeedometerMoveUpBtn'),
			movedown: container.FindChildInLayoutFile('SpeedometerMoveDownBtn')
		};

		this.panels.name.text = `${$.Localize(this.name)} (${$.Localize(SpeedometerDispNames.get(this.type))})`;

		const enabledAxes = speedo.enabled_axes;
		this.panels.xaxisToggle.SetSelected(enabledAxes[0]);
		this.panels.yaxisToggle.SetSelected(enabledAxes[1]);
		this.panels.zaxisToggle.SetSelected(enabledAxes[2]);

		this.panels.colorMode.SetSelectedIndex(speedo.color_type);

		this.panels.profileSetting.SetHasClass(
			'settings-speedometer__settingcontainer--hidden',
			this.panels.colorMode.GetSelected().id !== 'colormode1'
		);

		this.panels.toggle.SetPanelEvent('onactivate', () =>
			this.panels.detail.SetHasClass('settings-speedometer__detail--hidden', !this.panels.toggle.IsSelected())
		);
		this.panels.discard.SetPanelEvent('onactivate', () => this.discardChanges(speedo));
		this.panels.delete.SetPanelEvent('onactivate', () => Speedometers.deleteSpeedometer(this));
		this.panels.moveup.SetPanelEvent('onactivate', () => Speedometers.reorderSpeedometer(this, true));
		this.panels.movedown.SetPanelEvent('onactivate', () => Speedometers.reorderSpeedometer(this, false));

		this.updateProfileDropdown();
		if (speedo.range_color_profile) {
			this.panels.colorProfile.SetSelected(speedo.range_color_profile);
		}

		this.panels.colorMode.SetPanelEvent('oninputsubmit', () => {
			Speedometers.markSpeedometerAsModified(this);
			this.panels.profileSetting.SetHasClass(
				'settings-speedometer__settingcontainer--hidden',
				this.panels.colorMode.GetSelected().id !== 'colormode1'
			);
		});
		this.panels.colorProfile.SetPanelEvent('oninputsubmit', () => Speedometers.markSpeedometerAsModified(this));

		this.markAsUnmodified();
	}

	destroy() {
		this.panels.container.DeleteAsync(0);
	}

	discardChanges(speedo: SpeedometerSettingsAPI.Settings) {
		this.panels.colorMode.SetSelectedIndex(0);
		if (speedo.range_color_profile) {
			this.panels.colorProfile.SetSelected(speedo.range_color_profile);
		}
		this.markAsUnmodified();
	}

	markAsModified() {
		this.panels.discard.enabled = true;
	}

	markAsUnmodified() {
		this.panels.discard.enabled = false;
	}

	updateProfileDropdown() {
		const selColorProfile = this.panels.colorProfile
			.GetSelected()
			?.GetAttributeString('unlocalized-profilename', '');
		this.panels.colorProfile.SetSelectedIndex(0);

		for (let i = 1; i < this.panels.colorProfile.AccessDropDownMenu().GetChildCount(); i++)
			this.panels.colorProfile.RemoveOptionIndex(i);

		for (const { profile_name } of SpeedometerSettingsAPI.GetColorProfiles()) {
			const optionLabel = $.CreatePanel('Label', this.panels.colorProfile.AccessDropDownMenu(), profile_name);
			optionLabel.SetAttributeString('unlocalized-profilename', profile_name);
			optionLabel.text = $.Localize(profile_name);
			this.panels.colorProfile.AddOption(optionLabel);
		}

		// attempt to restore the old selection
		if (selColorProfile && this.panels.colorProfile.HasOption(selColorProfile))
			this.panels.colorProfile.SetSelected(selColorProfile);
	}

	save(): SpeedometerSettingsAPI.Settings {
		const speedo: Partial<SpeedometerSettingsAPI.Settings> = {
			custom_label: this.name,
			type: this.type
		};

		const selColorModePanel = this.panels.colorMode.GetSelected();
		const selColorMode = selColorModePanel
			? selColorModePanel.GetAttributeInt('value', SpeedometerColorType.NONE)
			: SpeedometerColorType.NONE;

		const selColorProfilePanel = this.panels.colorProfile.GetSelected();
		const profileName = selColorProfilePanel.GetAttributeString('unlocalized-profilename', '');

		speedo.color_type = selColorMode;
		if (selColorMode === SpeedometerColorType.RANGE) {
			speedo.range_color_profile = profileName;
		}

		speedo.enabled_axes = [
			this.panels.xaxisToggle.IsSelected(),
			this.panels.yaxisToggle.IsSelected(),
			this.panels.zaxisToggle.IsSelected()
		];

		return speedo as SpeedometerSettingsAPI.Settings;
	}
}

@PanelHandler({ static: true })
class Speedometers {
	static readonly panels = {
		main: $('#Speedometers'),
		add: $('#AddSpeedometerBtn'),
		reset: $('#ResetSpeedometersBtn'),
		discard: $('#DiscardSpeedometersBtn')
	};

	static settings: SpeedometerSettingsAPI.Settings[] = [];
	static gamemode: Gamemode = DEFAULT_GAMEMODE;
	static details: Speedometer[];

	static {
		$.RegisterForUnhandledEvent('OnSpeedometerSettingsLoaded', (succ) => this.settingsLoaded(succ));
	}

	static settingsLoaded(success: boolean) {
		if (!success) {
			$.Warning('Failed to load speedometer settings from settings!');
			return;
		}

		this.init();
	}

	static updateGamemode(gamemode: Gamemode) {
		if (this.details) {
			this.saveAllSpeedometers();
		}
		this.gamemode = gamemode;
		this.init();
	}

	static deleteSpeedometer(detail?: Speedometer) {
		detail?.destroy();
		const idx = this.details?.findIndex(({ name }) => name === detail.name) ?? -1;
		if (idx > -1) {
			this.details.splice(idx, 1);
			this.markAsModified();
		}
	}

	static addSpeedometer() {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/speedometer-select.xml',
			`speedometerNames=${this.details?.map((x) => x.name).join(',')}&callback=${UiToolkitAPI.RegisterJSCallback(
				(type, name) => this.addSpeedometerByType(type, name)
			)}`
		);
	}

	static addSpeedometerByType(type: SpeedometerType, name: string) {
		this.details?.push(
			new Speedometer({
				// fill in some default data
				custom_label: name,
				type,
				color_type: SpeedometerColorType.NONE,
				enabled_axes: [true, true, true]
			})
		);

		this.markAsModified();
	}

	static markSpeedometerAsModified(detail?: Speedometer) {
		detail?.markAsModified();
		this.markAsModified();
	}

	static reorderSpeedometer(detail: Speedometer, moveup: boolean) {
		const idx = this.details?.findIndex(({ name }) => name === detail.name) ?? -1;
		if (idx < 0) return;

		// find new place in array
		let newIdx = idx + (moveup ? -1 : 1);

		if (newIdx < 0) {
			newIdx = this.details?.length - 1;
		} else if (newIdx >= this.details?.length) {
			newIdx = 0;
		}

		// remove from current position
		this.details?.splice(idx, 1);

		// add at new index
		this.details?.splice(newIdx, 0, detail);

		for (const [i, detailObjectInList] of this.details?.entries() ?? []) {
			detailObjectInList.panels.container.SetAttributeInt('speedo_index', i);
		}

		this.panels.main.SortChildrenOnAttribute('speedo_index', true);
		this.markAsModified();
	}

	static init() {
		this.panels.main.RemoveAndDeleteChildren();

		this.settings = SpeedometerSettingsAPI.GetSettings(this.gamemode) ?? [];
		this.details = this.settings.map((speedo) => new Speedometer(speedo));

		this.markAsUnmodified();
	}

	static saveAllSpeedometers() {
		const speedos = this.details.map((detail) => detail.save());

		if (
			!SpeedometerSettingsAPI.SaveSpeedometersFromJS(this.gamemode, speedos as SpeedometerSettingsAPI.Settings[])
		) {
			$.Warning(`Failed to write speedometer of gamemode ${this.gamemode} to disk`);
		} else {
			this.markAsUnmodified();
		}
	}

	static resetToDefault() {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			'Reset Speedometers',
			'Reset all speedometers to default? Your current speedometer config will be unrecoverable.',
			'ok-cancel-popup',
			() => {
				// this will fire an event for loading
				SpeedometerSettingsAPI.ResetSpeedometersToDefault(this.gamemode);
			},
			() => {}
		);
	}

	static markAsModified() {
		this.panels.discard.enabled = true;
	}

	static markAsUnmodified() {
		this.panels.discard.enabled = false;
	}

	static updateProfileDropdowns() {
		for (const detailObject of this.details ?? []) {
			detailObject?.updateProfileDropdown();
		}
	}
}

class RangeColor {
	readonly min: float;
	readonly max: float;
	readonly kvcolor: RgbaTuple;
	readonly csscolor: color;

	constructor(min: float, max: float, kvcolor: RgbaTuple, csscolor: color) {
		this.min = min;
		this.max = max;
		this.kvcolor = kvcolor;
		this.csscolor = csscolor;
	}
}

class RangeColorRangeDisplay {
	readonly panels: {
		container: Panel;
		display: RangeColorDisplay;
		delete: Button;
	};

	constructor(rangeColor: RangeColor, profileObject: RangeColorProfile) {
		this.clearDisplay();

		const container = $.CreatePanel('Panel', profileObject.panels.displays, '');
		container.LoadLayoutSnippet('range-color-display');

		this.panels = {
			container,
			display: container.FindChildInLayoutFile('RangeColorDisplay'),
			delete: container.FindChildInLayoutFile('RangeColorDisplayDeleteBtn')
		};

		this.panels.display.SetRange(rangeColor.min, rangeColor.max, rangeColor.csscolor);
		this.panels.display.SetPanelEvent('onrangechange', () => {
			RangeColorProfileHandler.updateRangeInProfile(profileObject.name);
		});

		this.panels.delete.SetPanelEvent('onactivate', () =>
			RangeColorProfileHandler.deleteRangeFromProfile(profileObject.name, this)
		);
	}

	get min() {
		return this.panels.display?.min ?? -1;
	}

	get max() {
		return this.panels.display?.max ?? -1;
	}

	destroy() {
		this.panels.container.DeleteAsync(0);
	}

	clearDisplay() {
		this.panels?.container?.RemoveAndDeleteChildren();
	}

	save(): SpeedometerSettingsAPI.RangeColorProfile {
		return {
			min: this.panels.display.min,
			max: this.panels.display.max,
			color: rgbaStringToTuple(this.panels.display.color)
		};
	}
}

class RangeColorProfile {
	name: string;
	ogName: string;

	readonly panels: {
		profile: Panel;
		displaysContainer: Panel;
		displays: Panel;
		discard: Button;
		add: Button;
		delete: Button;
		edit: Button;
		toggle: ToggleButton;
		name: Label;
	};

	displays: RangeColorRangeDisplay[] = [];

	constructor(name: string, profiles: SpeedometerSettingsAPI.RangeColorProfile[]) {
		this.clearDisplays();

		this.name = name;
		this.ogName = name; // for reverting to original name
		const profilePanel = $.CreatePanel('Panel', RangeColorProfileHandler.panels.main, '');
		profilePanel.LoadLayoutSnippet('range-color-profile');

		const displaysContainer = profilePanel.FindChildInLayoutFile<Panel>('RangeColorDisplaysContainer');
		const toggle = profilePanel.FindChildInLayoutFile<ToggleButton>('RangeColorToggleBtn');

		this.panels = {
			profile: profilePanel,
			displaysContainer,
			displays: displaysContainer.FindChildInLayoutFile('RangeColorDisplays'),
			add: displaysContainer.FindChildInLayoutFile('RangeColorAddBtn'),
			discard: profilePanel.FindChildInLayoutFile('RangeColorDiscardBtn'),
			delete: profilePanel.FindChildInLayoutFile('RangeColorDeleteBtn'),
			edit: profilePanel.FindChildInLayoutFile('RangeColorEditNameBtn'),
			toggle,
			name: toggle.FindChildInLayoutFile('RangeColorName')
		};

		this.panels.name.text = $.Localize(this.name);

		this.markAsUnmodified();

		this.panels.add.SetPanelEvent('onactivate', () =>
			RangeColorProfileHandler.addRangeDisplayToProfile(
				this.name,
				new RangeColor(0, 1, [255, 255, 255, 255], 'rgba(255, 255, 255, 1)')
			)
		);
		this.panels.discard.SetPanelEvent('onactivate', () =>
			RangeColorProfileHandler.discardChangesForProfile(this.ogName, this.name, profiles)
		);
		this.panels.toggle.SetPanelEvent('onactivate', () =>
			this.panels.displaysContainer.SetHasClass(
				'settings-speedometer-rangecolor__displayscont--hidden',
				!this.panels.toggle.IsSelected()
			)
		);
		this.panels.delete.SetPanelEvent('onactivate', () => RangeColorProfileHandler.deleteProfile(this.name));
		this.panels.edit.SetPanelEvent('onactivate', () =>
			RangeColorProfileHandler.makeColorProfileNamePopup(
				this.name,
				$.Localize('#Common_Edit'),
				(profileName: string) => RangeColorProfileHandler.updateProfileName(this.name, profileName)
			)
		);

		this.createDisplayPanels(profiles);
	}

	destroy() {
		this.panels.profile.DeleteAsync(0);
	}

	clearDisplays() {
		this.panels?.displays?.RemoveAndDeleteChildren();
		this.displays = [];
	}

	updateName(name: string) {
		this.name = name;
		this.panels.name.text = $.Localize(this.name);
		this.markAsModified();
	}

	deleteRange(display?: RangeColorRangeDisplay) {
		display?.destroy();
		const idx = this.displays.indexOf(display);
		if (idx > -1) {
			this.displays.splice(idx, 1);
			this.markAsModified();
		}
	}

	reorderDisplayPanels() {
		if (this.displays.length === 0 || this.displays.length === 1) return;
		// sort on min
		this.displays.sort((display1, display2) => display1.min - display2.min);

		for (const [idx, display] of this.displays.entries())
			display.panels.container.SetAttributeInt('range_disp_idx', idx);

		// for whatever reason, sorting on displaysPanel is not working, so just get the parent of these display objects and sort it
		this.displays[0].panels.display.GetParent().SortChildrenOnAttribute('range_disp_idx', true);
	}

	updateRange() {
		// it would be nice to enforce no gaps in bounds, but it is painful to even think about the functionality of that UI/UX wise
		this.reorderDisplayPanels();
		this.markAsModified();
	}

	addRange(range: RangeColor) {
		this.displays.push(new RangeColorRangeDisplay(range, this));
		this.reorderDisplayPanels();
		this.markAsModified();
	}

	discardChanges(range: SpeedometerSettingsAPI.RangeColorProfile[]) {
		this.createDisplayPanels(range);
		this.markAsUnmodified();
	}

	createDisplayPanels(ranges: SpeedometerSettingsAPI.RangeColorProfile[]) {
		// remove all current display panels
		this.displays.forEach((display) => display?.destroy());
		this.displays = ranges.map(
			(range) =>
				new RangeColorRangeDisplay(
					new RangeColor(range.min, range.max, range.color, tupleToRgbaString(range.color)),
					this
				)
		);

		this.reorderDisplayPanels();
	}

	markAsModified() {
		this.panels.discard.enabled = true;
	}

	markAsUnmodified() {
		this.ogName = this.name;
		this.panels.discard.enabled = false;
	}

	save() {
		return this.displays.map((display) => display.save());
	}
}

@PanelHandler({ static: true })
class RangeColorProfileHandler {
	static readonly panels = {
		main: $<Panel>('#SpeedometerColorProfiles'),
		add: $<Button>('#AddColorProfileBtn'),
		reset: $<Button>('#ResetColorProfilesBtn'),
		discard: $<Button>('#DiscardColorProfilesBtn')
	};

	static profiles: Map<string, RangeColorProfile> = new Map();

	static {
		$.RegisterForUnhandledEvent('OnRangeColorProfilesLoaded', (succ) => this.profilesLoaded(succ));
	}

	static profilesLoaded(success: boolean) {
		if (!success) {
			$.Warning('Failed to load range color profiles from settings!');
			return;
		}

		this.recreate();
	}

	static addProfile() {
		this.makeColorProfileNamePopup('', $.Localize('#Common_Create'), (name) => this.addEmptyProfile(name));
	}

	static addEmptyProfile(name: string) {
		if (this.profiles.get(name)) {
			$.Warning(`Adding profile ${name} that already exists!`);
			return;
		}

		this.profiles.set(name, new RangeColorProfile(name, []));
		this.markAsModified();
	}

	static deleteProfile(name: string) {
		this.profiles.get(name)?.destroy();
		this.profiles.delete(name);
		this.markAsModified();
	}

	static updateProfileName(oldName: string, name: string) {
		const profile = this.profiles.get(oldName);
		if (!profile) {
			$.Warning(`Updating old profile name ${oldName} which doesnt exist!`);
			return;
		}

		if (profile.name === name) return;

		profile.updateName(name);

		// rename key
		this.profiles.set(name, this.profiles.get(oldName));
		this.profiles.delete(oldName);

		this.markAsModified();
	}

	static addRangeDisplayToProfile(name: string, range: RangeColor) {
		const profile = this.profiles.get(name);
		if (!profile) {
			$.Warning(`Adding range to profile ${name} which doesnt exist!`);
			return;
		}

		profile.addRange(range);
		this.markAsModified();
	}

	static deleteRangeFromProfile(name: string, display: RangeColorRangeDisplay) {
		const profile = this.profiles.get(name);
		if (!profile) {
			$.Warning(`Deleting range from profile ${name} which doesnt exist!`);
			return;
		}
		profile.deleteRange(display);
		this.markAsModified();
	}

	static updateRangeInProfile(name: string) {
		const profile = this.profiles.get(name);
		if (!profile) {
			$.Warning(`Changing range in profile ${name} which doesnt exist!`);
			return;
		}
		profile.updateRange();
		this.markAsModified();
	}

	static discardChangesForProfile(
		ogName: string,
		name: string,
		ogProfiles: SpeedometerSettingsAPI.RangeColorProfile[]
	) {
		const profile = this.profiles.get(name);

		if (!ogProfiles || !profile) {
			$.Warning(`Discarding profile ${name} which doesnt exist!`);
			return;
		}

		this.updateProfileName(name, ogName);
		profile.discardChanges(ogProfiles);

		this.markAsUnmodified();
	}

	static recreate() {
		this.create();
		Speedometers.updateProfileDropdowns();
	}

	static create() {
		this.panels.main.RemoveAndDeleteChildren();

		this.profiles = new Map(
			SpeedometerSettingsAPI.GetColorProfiles().map(({ profile_name, profile_ranges }) => [
				profile_name,
				new RangeColorProfile(profile_name, profile_ranges)
			])
		);

		this.markAsUnmodified();
	}

	static saveAllProfiles(): void {
		const saveData = this.profiles
			.entries()
			.map(([name, range]) => {
				range.markAsUnmodified();

				return {
					profile_name: name,
					profile_ranges: range.save()
				};
			})
			.toArray();

		if (SpeedometerSettingsAPI.SaveColorProfilesFromJS(saveData)) {
			this.markAsUnmodified();
			Speedometers.updateProfileDropdowns();
		} else {
			$.Warning('Failed to write color profiles to disk!');
		}
	}

	static resetToDefault() {
		UiToolkitAPI.ShowGenericPopupOkCancel(
			'Reset Range Color Profiles',
			'Reset all range color profiles to default? Your current range color profiles config will be unrecoverable.',
			'ok-cancel-popup',
			() => {
				// this will fire an event for loading
				SpeedometerSettingsAPI.ResetColorProfilesToDefault();
			},
			() => {}
		);
	}

	static markAsModified() {
		this.panels.discard.enabled = true;
	}

	static markAsUnmodified() {
		this.panels.discard.enabled = false;
	}

	static makeColorProfileNamePopup(prefilledText: string, OKBtnText: string, callback: (name: string) => void) {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/range-color-profile-name.xml',
			`profileNames=${[
				this.profiles.keys().toArray().join(',')
			]}&prefilledText=${prefilledText}&OKBtnText=${OKBtnText}&callback=${UiToolkitAPI.RegisterJSCallback(
				callback
			)}`
		);
	}
}

@PanelHandler({ static: true })
class SpeedometerSettingsHandler {
	static readonly panels = {
		gamemode: $<DropDown>('#GamemodeDropDown')
	};

	static {
		$.RegisterForUnhandledEvent('SettingsSave', () => this.saveSettings());

		// Save to file whenever the settings page gets closed as well
		$.RegisterForUnhandledEvent('MainMenuTabHidden', (tab) => tab === 'Settings' && this.saveSettings());
	}

	static onPanelLoad() {
		const dropdown = this.panels.gamemode.AccessDropDownMenu();
		for (const [gamemode, { id, i18n }] of GamemodeInfo.entries()) {
			const option = $.CreatePanel('Label', dropdown, id);
			option.text = $.Localize(i18n);
			option.SetAttributeInt('value', gamemode);
			this.panels.gamemode.AddOption(option);
		}

		this.panels.gamemode.SetSelectedIndex(GameModeAPI.GetMetaGameMode() - 1);
	}

	static loadSettings() {
		// order matches events fired from C++ when speedometer settings are loaded
		// will not initialize correctly if color profiles are loaded after speedometers
		RangeColorProfileHandler.create();
		Speedometers.init();
	}

	static updateGamemode() {
		const gamemodePanel = this.panels.gamemode.GetSelected();
		const gamemode = gamemodePanel ? gamemodePanel.GetAttributeInt('value', DEFAULT_GAMEMODE) : DEFAULT_GAMEMODE;
		Speedometers.updateGamemode(gamemode);
	}

	static saveSettings() {
		RangeColorProfileHandler.saveAllProfiles();
		Speedometers.saveAllSpeedometers();
	}
}
