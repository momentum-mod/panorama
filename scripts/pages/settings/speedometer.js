const DEFAULT_GAMEMODE = 1; // Surf

class SpeedometerDetailObject {
	constructor(speedometerKV) {
		/** @type {string} */
		this.name = null;
		/** @type {Panel} */
		this.containingPanel = null;
		/** @type {Panel} */
		this.detailPanel = null;
		/** @type {Panel} */
		this.profileSettingContainer = null;
		/** @type {Panel} */
		this.axesContainer = null;
		/** @type {ToggleButton} */
		this.xaxisToggleButton = null;
		/** @type {ToggleButton} */
		this.yaxisToggleButton = null;
		/** @type {ToggleButton} */
		this.zaxisToggleButton = null;
		/** @type {DropDown} */
		this.colorModeDropdown = null;
		/** @type {DropDown} */
		this.colorProfileDropdown = null;
		/** @type {ToggleButton} */
		this.toggleButton = null;
		/** @type {Button} */
		this.discardButton = null;
		/** @type {Button} */
		this.deleteButton = null;
		/** @type {Button} */
		this.moveupButton = null;
		/** @type {Button} */
		this.movedownButton = null;
		/** @type {Label} */
		this.nameLabel = null;
		this.create(speedometerKV);
	}

	destroy() {
		this.containingPanel.DeleteAsync(0);
	}

	discardChanges(speedometerKV) {
		this.colorModeDropdown.SetSelectedIndex(speedometerKV['colorize']);
		const colorProfile = speedometerKV['color_profile'];
		if (colorProfile) this.colorProfileDropdown.SetSelected(colorProfile);
		this.markAsUnmodified();
	}

	markAsModified() {
		this.discardButton.enabled = true;
	}

	markAsUnmodified() {
		this.discardButton.enabled = false;
	}

	create(speedometerKV) {
		this.name = speedometerKV[SpeedometerDataKeys.CUSTOM_LABEL];
		this.type = speedometerKV[SpeedometerDataKeys.TYPE];

		this.containingPanel = $.CreatePanel('Panel', Speedometers.mainPanel, '');
		this.containingPanel.LoadLayoutSnippet('speedometer');

		this.detailPanel = this.containingPanel.FindChildInLayoutFile('SpeedometerDetailContainer');
		this.profileSettingContainer = this.detailPanel.FindChildInLayoutFile('SpeedometerColorProfileContainer');
		this.toggleButton = this.containingPanel.FindChildInLayoutFile('SpeedometerToggleBtn');
		this.discardButton = this.containingPanel.FindChildInLayoutFile('SpeedometerDiscardBtn');
		this.deleteButton = this.containingPanel.FindChildInLayoutFile('SpeedometerDeleteBtn');
		this.axesContainer = this.detailPanel.FindChildInLayoutFile('SpeedometerAxesContainer');
		this.xaxisToggleButton = this.axesContainer.FindChildInLayoutFile('SpeedometerXAxisToggleButton');
		this.yaxisToggleButton = this.axesContainer.FindChildInLayoutFile('SpeedometerYAxisToggleButton');
		this.zaxisToggleButton = this.axesContainer.FindChildInLayoutFile('SpeedometerZAxisToggleButton');
		this.colorModeDropdown = this.detailPanel.FindChildInLayoutFile('SpeedometerColorMode');
		this.colorProfileDropdown = this.detailPanel.FindChildInLayoutFile('SpeedometerColorProfile');
		this.moveupButton = this.containingPanel.FindChildInLayoutFile('SpeedometerMoveUpBtn');
		this.movedownButton = this.containingPanel.FindChildInLayoutFile('SpeedometerMoveDownBtn');
		this.nameLabel = this.toggleButton.FindChildInLayoutFile('SpeedometerName');
		this.nameLabel.text = `${$.Localize(this.name)} (${$.Localize(SpeedometerDispNames[this.type])})`;

		const enabledAxes = speedometerKV[SpeedometerDataKeys.ENABLED_AXES];
		this.xaxisToggleButton.SetSelected(enabledAxes[0]);
		this.yaxisToggleButton.SetSelected(enabledAxes[1]);
		this.zaxisToggleButton.SetSelected(enabledAxes[2]);

		this.colorModeDropdown.SetSelectedIndex(speedometerKV[SpeedometerDataKeys.COLOR_TYPE]);

		this.profileSettingContainer.SetHasClass(
			'settings-speedometer__settingcontainer--hidden',
			this.colorModeDropdown.GetSelected().id !== 'colormode1'
		);

		this.toggleButton.SetPanelEvent('onactivate', () =>
			this.detailPanel.SetHasClass('settings-speedometer__detail--hidden', !this.toggleButton.IsSelected())
		);
		this.discardButton.SetPanelEvent('onactivate', () => this.discardChanges(speedometerKV));
		this.deleteButton.SetPanelEvent('onactivate', () => Speedometers.deleteSpeedometer(this));
		this.moveupButton.SetPanelEvent('onactivate', () => Speedometers.reorderSpeedometer(this, true));
		this.movedownButton.SetPanelEvent('onactivate', () => Speedometers.reorderSpeedometer(this, false));

		this.updateProfileDropdown();
		const colProfileName = speedometerKV[SpeedometerDataKeys.RANGE_COL_PROF];
		if (colProfileName) this.colorProfileDropdown.SetSelected(colProfileName);

		this.colorModeDropdown.SetPanelEvent('oninputsubmit', () => {
			Speedometers.markSpeedometerAsModified(this);
			this.profileSettingContainer.SetHasClass(
				'settings-speedometer__settingcontainer--hidden',
				this.colorModeDropdown.GetSelected().id !== 'colormode1'
			);
		});
		this.colorProfileDropdown.SetPanelEvent('oninputsubmit', () => Speedometers.markSpeedometerAsModified(this));

		this.markAsUnmodified();
	}

	updateProfileDropdown() {
		const selColorProfile = this.colorProfileDropdown
			.GetSelected()
			?.GetAttributeString('unlocalized-profilename', '');
		this.colorProfileDropdown.SetSelectedIndex(0);

		for (let i = 1; i < this.colorProfileDropdown.AccessDropDownMenu().GetChildCount(); i++)
			this.colorProfileDropdown.RemoveOptionIndex(i);

		const profilesKV = SpeedometerSettingsAPI.GetColorProfiles();
		for (const profile of profilesKV) {
			const profileName = profile[RangeColorProfileKeys.PROFILE_NAME];
			/** @type {Label} */
			const optionPanel = $.CreatePanel('Label', this.colorProfileDropdown.AccessDropDownMenu(), profileName);
			optionPanel.SetAttributeString('unlocalized-profilename', profileName);
			optionPanel.text = $.Localize(profileName);
			this.colorProfileDropdown.AddOption(optionPanel);
		}

		// attempt to restore the old selection
		if (selColorProfile && this.colorProfileDropdown.HasOption(selColorProfile))
			this.colorProfileDropdown.SetSelected(selColorProfile);
	}

	saveToKV(speedometerKV) {
		speedometerKV[SpeedometerDataKeys.CUSTOM_LABEL] = this.name;
		speedometerKV[SpeedometerDataKeys.TYPE] = this.type;

		const selColorModePanel = this.colorModeDropdown.GetSelected();
		const selColorMode = selColorModePanel
			? selColorModePanel.GetAttributeInt('value', SpeedometerColorTypes.NONE)
			: SpeedometerColorTypes.NONE;

		const selColorProfilePanel = this.colorProfileDropdown.GetSelected();
		const profileName = selColorProfilePanel.GetAttributeString('unlocalized-profilename', '');

		speedometerKV[SpeedometerDataKeys.COLOR_TYPE] = selColorMode;
		if (selColorMode === SpeedometerColorTypes.RANGE)
			speedometerKV[SpeedometerDataKeys.RANGE_COL_PROF] = profileName;
		else delete speedometerKV[SpeedometerDataKeys.RANGE_COL_PROF];

		speedometerKV[SpeedometerDataKeys.ENABLED_AXES] = [
			this.xaxisToggleButton.IsSelected(),
			this.yaxisToggleButton.IsSelected(),
			this.zaxisToggleButton.IsSelected()
		];

		return speedometerKV;
	}
}

class Speedometers {
	/** @type {Panel} @static */
	static mainPanel = $('#Speedometers');
	static gamemode = DEFAULT_GAMEMODE;
	static keyvalues = null;
	/** @type {Array<SpeedometerDetailObject>} */
	static detailObjectList = [];

	/** @type {Button} @static */
	static addButton = $('#AddSpeedometerBtn');
	/** @type {Button} @static */
	static resetButton = $('#ResetSpeedometersBtn');
	/** @type {Button} @static */
	static discardButton = $('#DiscardSpeedometersBtn');

	static {
		$.RegisterForUnhandledEvent('OnSpeedometerSettingsLoaded', Speedometers.settingsLoaded.bind(this));
	}

	static settingsLoaded(success) {
		if (!success) {
			$.Warning('Failed to load speedometer settings from settings!');
			return;
		}
		this.create();
	}

	static updateGamemode(gamemode) {
		this.gamemode = gamemode;
		this.create();
	}

	static clearSpeedometers() {
		this.mainPanel.RemoveAndDeleteChildren();
		this.detailObjectList = [];
	}

	static deleteSpeedometer(detailObject) {
		detailObject?.destroy();
		const idx = this.detailObjectList.findIndex(
			(detailObjectInList) => detailObjectInList.name === detailObject.name
		);
		if (idx > -1) {
			this.detailObjectList.splice(idx, 1);
			this.markAsModified();
		}
	}

	static addSpeedometer() {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/speedometer-select.xml',
			`callback=${UiToolkitAPI.RegisterJSCallback((type, name) => this.addSpeedometerByType(type, name))}`
		);
	}

	static addSpeedometerByType(type, name) {
		// fill in some default data
		const speedoKV = {};
		speedoKV[SpeedometerDataKeys.CUSTOM_LABEL] = name;
		speedoKV[SpeedometerDataKeys.TYPE] = type;
		speedoKV[SpeedometerDataKeys.ENABLED_AXES] = [1, 1, 1];
		speedoKV[SpeedometerDataKeys.COLOR_TYPE] = SpeedometerColorTypes.NONE;

		this.detailObjectList.push(new SpeedometerDetailObject(speedoKV));
		this.markAsModified();
	}

	static markSpeedometerAsModified(detailObject) {
		detailObject?.markAsModified();
		this.markAsModified();
	}

	static reorderSpeedometer(detailObject, moveup) {
		const idx = this.detailObjectList.findIndex(
			(detailObjectInList) => detailObjectInList.name === detailObject.name
		);
		if (idx < 0) return;

		// find new place in array
		let newIdx = idx;
		if (moveup) newIdx--;
		else newIdx++;

		if (newIdx < 0) newIdx = this.detailObjectList.length - 1;
		else if (newIdx >= this.detailObjectList.length) newIdx = 0;

		// remove from current position
		this.detailObjectList.splice(idx, 1);

		// add at new index
		this.detailObjectList.splice(newIdx, 0, detailObject);

		for (const [i, detailObjectInList] of this.detailObjectList.entries()) {
			detailObjectInList.containingPanel.SetAttributeInt('speedo_index', i);
		}

		this.mainPanel.SortChildrenOnAttribute('speedo_index', true);
		this.markAsModified();
	}

	static create() {
		this.clearSpeedometers();
		this.keyvalues = SpeedometerSettingsAPI.GetSettings(this.gamemode);

		for (const speedoKV of this.keyvalues) {
			this.detailObjectList.push(new SpeedometerDetailObject(speedoKV));
		}

		this.markAsUnmodified();
	}

	static saveAllSpeedometers() {
		const keyvalues = this.detailObjectList.map((detailObject) => detailObject.saveToKV({}));

		if (!SpeedometerSettingsAPI.SaveSpeedometersFromJS(this.gamemode, keyvalues))
			$.Warning(`Failed to write speedometer of gamemode ${this.gamemode} to disk`);
		else this.markAsUnmodified();
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
		this.discardButton.enabled = true;
	}

	static markAsUnmodified() {
		this.discardButton.enabled = false;
	}

	static updateProfileDropdowns() {
		for (const detailObject of this.detailObjectList) detailObject?.updateProfileDropdown();
	}
}

class RangeColorObject {
	constructor(min, max, kvcolor, csscolor) {
		this.min = min;
		this.max = max;
		this.kvcolor = kvcolor;
		this.csscolor = csscolor;
	}

	saveToKV(rangeKV) {
		rangeKV['min'] = this.min;
		rangeKV['max'] = this.max;
		rangeKV['color'] = this.kvcolor;
	}

	static convertCSSToKV(color) {
		const kvColor = color
			.replaceAll(/[^\d,|]/, '')
			.split(',')
			.map((x) => Number.parseInt(x));
		kvColor[3] *= 255;
		return kvColor;
	}

	static convertKVToCSS([r, g, b, a]) {
		return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
	}
}

class RangeColorRangeDisplayObject {
	constructor(rangeObject, profileObject) {
		/** @type {Panel} */
		this.containingPanel = null;
		/** @type {Panel} */
		this.displayPanel = null;
		/** @type {Button} */
		this.deleteButton = null;
		this.create(rangeObject, profileObject);
	}

	getMin() {
		return this.displayPanel ? this.displayPanel.min : -1;
	}

	getMax() {
		return this.displayPanel ? this.displayPanel.max : -1;
	}

	destroy() {
		this.containingPanel.DeleteAsync(0);
	}

	clearDisplay() {
		this.containingPanel?.RemoveAndDeleteChildren();
	}

	create(rangeObject, profileObject) {
		this.clearDisplay();

		this.containingPanel = $.CreatePanel('Panel', profileObject.displaysPanel, '');
		this.containingPanel.LoadLayoutSnippet('range-color-display');

		this.displayPanel = this.containingPanel.FindChildInLayoutFile('RangeColorDisplay');
		this.displayPanel.SetRange(rangeObject.min, rangeObject.max, rangeObject.csscolor);
		this.deleteButton = this.containingPanel.FindChildInLayoutFile('RangeColorDisplayDeleteBtn');

		this.displayPanel.SetPanelEvent('onrangechange', () => {
			const color = this.displayPanel.color;
			const colorRangeObject = new RangeColorObject(
				this.displayPanel.min,
				this.displayPanel.max,
				RangeColorObject.convertCSSToKV(color),
				color
			);
			RangeColorProfiles.updateRangeInProfile(profileObject.name, colorRangeObject, this);
		});
		this.deleteButton.SetPanelEvent('onactivate', () =>
			RangeColorProfiles.deleteRangeFromProfile(profileObject.name, this)
		);
	}

	saveToKV(rangeKV) {
		const csscolor = this.displayPanel.color;
		const rangeObject = new RangeColorObject(
			this.displayPanel.min,
			this.displayPanel.max,
			RangeColorObject.convertCSSToKV(csscolor),
			csscolor
		);
		rangeObject.saveToKV(rangeKV);

		return rangeKV;
	}
}

class RangeColorProfileObject {
	constructor(name, profileKV) {
		/** @type {Panel} */
		this.profilePanel = null;
		/** @type {Panel} */
		this.displaysContainer = null;
		/** @type {Panel} */
		this.displaysPanel = null;
		/** @type {Button} */
		this.discardButton = null;
		/** @type {Button} */
		this.addButton = null;
		/** @type {Button} */
		this.deleteButton = null;
		/** @type {Button} */
		this.editButton = null;
		/** @type {ToggleButton} */
		this.toggleButton = null;
		/** @type {Label} */
		this.nameLabel = null;
		/** @type {Array<RangeColorRangeDisplayObject>} */
		this.displayObjectList = [];
		this.create(name, profileKV);
	}

	destroy() {
		this.profilePanel.DeleteAsync(0);
	}

	clearDisplays() {
		this.displaysPanel?.RemoveAndDeleteChildren();
		this.displayObjectList = [];
	}

	updateName(name) {
		this.name = name;
		this.nameLabel.text = $.Localize(this.name);
		this.markAsModified();
	}

	deleteRange(displayObject) {
		displayObject?.destroy();
		const idx = this.displayObjectList.indexOf(displayObject);
		if (idx > -1) {
			this.displayObjectList.splice(idx, 1);
			this.markAsModified();
		}
	}

	reorderDisplayPanels() {
		if (this.displayObjectList.length === 0 || this.displayObjectList.length === 1) return;
		// sort on min
		this.displayObjectList.sort((dispObj1, dispObj2) => dispObj1.getMin() - dispObj2.getMin());

		for (const [idx, displayObject] of this.displayObjectList.entries())
			displayObject.containingPanel.SetAttributeInt('range_disp_idx', idx);

		// for whatever reason, sorting on displaysPanel is not working, so just get the parent of these display objects and sort it
		this.displayObjectList[0].containingPanel.GetParent().SortChildrenOnAttribute('range_disp_idx', true);
	}

	updateRange(_rangeObject, _displayObject) {
		// it would be nice to enforce no gaps in bounds, but it is painful to even think about the functionality of that UI/UX wise
		this.reorderDisplayPanels();
		this.markAsModified();
	}

	addRange(rangeObject) {
		this.displayObjectList.push(new RangeColorRangeDisplayObject(rangeObject, this));
		this.reorderDisplayPanels();
		this.markAsModified();
	}

	discardChanges(profileKV) {
		this.createDisplayPanels(profileKV);
		this.markAsUnmodified();
	}

	createDisplayPanels(profileKV) {
		// remove all current display panels
		for (const displayObject of this.displayObjectList) displayObject?.destroy();
		this.displayObjectList = [];

		for (const rangeKV of profileKV) {
			const kvcolor = rangeKV['color'];
			const rangeObject = new RangeColorObject(
				rangeKV['min'],
				rangeKV['max'],
				kvcolor,
				RangeColorObject.convertKVToCSS(kvcolor)
			);
			this.displayObjectList.push(new RangeColorRangeDisplayObject(rangeObject, this));
		}
		this.reorderDisplayPanels();
	}

	create(profileName, profileKV) {
		this.clearDisplays();

		this.name = profileName;
		this.ogName = profileName; // for reverting to original name
		this.profilePanel = $.CreatePanel('Panel', RangeColorProfiles.mainPanel, '');
		this.profilePanel.LoadLayoutSnippet('range-color-profile');

		this.displaysContainer = this.profilePanel.FindChildInLayoutFile('RangeColorDisplaysContainer');
		this.displaysPanel = this.displaysContainer.FindChildInLayoutFile('RangeColorDisplays');

		this.addButton = this.displaysContainer.FindChildInLayoutFile('RangeColorAddBtn');
		this.discardButton = this.profilePanel.FindChildInLayoutFile('RangeColorDiscardBtn');
		this.deleteButton = this.profilePanel.FindChildInLayoutFile('RangeColorDeleteBtn');
		this.editButton = this.profilePanel.FindChildInLayoutFile('RangeColorEditNameBtn');
		this.toggleButton = this.profilePanel.FindChildInLayoutFile('RangeColorToggleBtn');

		this.nameLabel = this.toggleButton.FindChildInLayoutFile('RangeColorName');
		this.nameLabel.text = $.Localize(this.name);

		this.markAsUnmodified();

		this.addButton.SetPanelEvent('onactivate', () =>
			RangeColorProfiles.addRangeDisplayToProfile(
				this.name,
				new RangeColorObject(0, 1, '255 255 255 255', 'rgba(255,255,255,1)')
			)
		);
		this.discardButton.SetPanelEvent('onactivate', () =>
			RangeColorProfiles.discardChangesForProfile(this.ogName, this.name, profileKV)
		);
		this.toggleButton.SetPanelEvent('onactivate', () =>
			this.displaysContainer.SetHasClass(
				'settings-speedometer-rangecolor__displayscont--hidden',
				!this.toggleButton.IsSelected()
			)
		);
		this.deleteButton.SetPanelEvent('onactivate', () => RangeColorProfiles.deleteProfile(this.name));
		this.editButton.SetPanelEvent('onactivate', () =>
			RangeColorProfiles.makeColorProfileNamePopup(this.name, $.Localize('#Common_Edit'), (profileName) =>
				RangeColorProfiles.updateProfileName(this.name, profileName)
			)
		);

		this.createDisplayPanels(profileKV);
	}

	markAsModified() {
		this.discardButton.enabled = true;
	}

	markAsUnmodified() {
		this.ogName = this.name;
		this.discardButton.enabled = false;
	}

	saveToKV(profileKV) {
		profileKV = this.displayObjectList.map((displayObject) => displayObject.saveToKV({}));
		return profileKV;
	}
}

class RangeColorProfiles {
	/** @type {Panel} @static */
	static mainPanel = $('#SpeedometerColorProfiles');
	static keyvalues = null;
	/** @type {Map<string,RangeColorProfileObject>} */
	static profileObjectMap = new Map();

	/** @type {Button} @static */
	static addButton = $('#AddColorProfileBtn');
	/** @type {Button} @static */
	static resetButton = $('#ResetColorProfilesBtn');
	/** @type {Button} @static */
	static discardButton = $('#DiscardColorProfilesBtn');

	static {
		$.RegisterForUnhandledEvent('OnRangeColorProfilesLoaded', RangeColorProfiles.profilesLoaded.bind(this));
	}

	static profilesLoaded(success) {
		if (!success) {
			$.Warning('Failed to load range color profiles from settings!');
			return;
		}
		this.recreate();
	}

	static clearProfiles() {
		this.mainPanel.RemoveAndDeleteChildren();
		this.profileObjectMap = new Map();
	}

	static addProfile() {
		this.makeColorProfileNamePopup('', $.Localize('#Common_Create'), (profileName) =>
			this.addEmptyProfile(profileName)
		);
	}

	static addEmptyProfile(profileName) {
		if (this.profileObjectMap.get(profileName)) {
			$.Warning(`Adding profile ${profileName} that already exists!`);
			return;
		}
		const profileObject = new RangeColorProfileObject(profileName, []);
		this.profileObjectMap.set(profileName, profileObject);
		this.markAsModified();
	}

	static deleteProfile(profileName) {
		this.profileObjectMap.get(profileName)?.destroy();
		this.profileObjectMap.delete(profileName);
		this.markAsModified();
	}

	static updateProfileName(oldProfileName, profileName) {
		const profileObject = this.profileObjectMap.get(oldProfileName);
		if (!profileObject) {
			$.Warning(`Updating old profile name ${oldProfileName} which doesnt exist!`);
			return;
		}
		if (profileObject.name === profileName) return;

		profileObject.updateName(profileName);

		// rename key
		this.profileObjectMap.set(profileName, this.profileObjectMap.get(oldProfileName));
		this.profileObjectMap.delete(oldProfileName);

		this.markAsModified();
	}

	static addRangeDisplayToProfile(profileName, rangeObject) {
		const profileObject = this.profileObjectMap.get(profileName);
		if (!profileObject) {
			$.Warning(`Adding range to profile ${profileName} which doesnt exist!`);
			return;
		}

		profileObject.addRange(rangeObject);
		this.markAsModified();
	}

	static deleteRangeFromProfile(profileName, displayObject) {
		const profileObject = this.profileObjectMap.get(profileName);
		if (!profileObject) {
			$.Warning(`Deleting range from profile ${profileName} which doesnt exist!`);
			return;
		}
		profileObject.deleteRange(displayObject);
		this.markAsModified();
	}

	static updateRangeInProfile(profileName, rangeObject, displayObject) {
		const profileObject = this.profileObjectMap.get(profileName);
		if (!profileObject) {
			$.Warning(`Changing range in profile ${profileName} which doesnt exist!`);
			return;
		}
		profileObject.updateRange(rangeObject, displayObject);
		this.markAsModified();
	}

	static discardChangesForProfile(originalName, profileName, profileKV) {
		const profileObject = this.profileObjectMap.get(profileName);
		if (!profileKV || !profileObject) {
			$.Warning(`Discarding profile ${profileName} which doesnt exist!`);
			return;
		}
		this.updateProfileName(profileName, originalName);
		profileObject.discardChanges(profileKV);
		this.markAsUnmodified();
	}

	static recreate() {
		this.create();
		Speedometers.updateProfileDropdowns();
	}

	static create() {
		this.clearProfiles();
		this.markAsUnmodified();
		this.keyvalues = SpeedometerSettingsAPI.GetColorProfiles();

		for (const profile of this.keyvalues) {
			// store in a map for fast indexing based on profile name
			const profileName = profile[RangeColorProfileKeys.PROFILE_NAME];
			this.profileObjectMap.set(
				profileName,
				new RangeColorProfileObject(profileName, profile[RangeColorProfileKeys.PROFILE_RANGE_DATA])
			);
		}
	}

	static saveAllProfiles() {
		const keyvalues = [...this.profileObjectMap].map(([profileName, profileObject]) => {
			profileObject.markAsUnmodified();

			return {
				[RangeColorProfileKeys.PROFILE_NAME]: profileName,
				[RangeColorProfileKeys.PROFILE_RANGE_DATA]: profileObject.saveToKV([])
			};
		});

		if (SpeedometerSettingsAPI.SaveColorProfilesFromJS(keyvalues)) {
			this.markAsUnmodified();
			Speedometers.updateProfileDropdowns();
		} else $.Warning('Failed to write color profiles to disk');
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
		this.discardButton.enabled = true;
	}

	static markAsUnmodified() {
		this.discardButton.enabled = false;
	}

	static makeColorProfileNamePopup(prefilledText, OKBtnText, callback) {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/range-color-profile-name.xml',
			`profileNames=${this.profileObjectMap.keys()}&prefilledText=${prefilledText}&OKBtnText=${OKBtnText}&callback=${UiToolkitAPI.RegisterJSCallback(
				callback
			)}`
		);
	}
}

class SpeedometerSettings {
	/** @static @type {DropDown} */
	static gamemodeDropDown = $('#GamemodeDropDown');

	static loadSettings() {
		// order matches events fired from C++ when speedometer settings are loaded
		// will not initialize correctly if color profiles are loaded after speedometers
		RangeColorProfiles.create();
		Speedometers.create();
	}

	static updateGamemode() {
		const gamemodePanel = this.gamemodeDropDown.GetSelected();
		const gamemode = gamemodePanel ? gamemodePanel.GetAttributeInt('value', DEFAULT_GAMEMODE) : DEFAULT_GAMEMODE;
		Speedometers.updateGamemode(gamemode);
	}

	static saveSettings() {
		RangeColorProfiles.saveAllProfiles();
		Speedometers.saveAllSpeedometers();
	}

	static {
		$.RegisterForUnhandledEvent('SettingsSave', this.saveSettings.bind(this));

		// Save to file whenever the settings page gets closed as well
		$.RegisterForUnhandledEvent('MainMenuTabHidden', (tab) => tab === 'Settings' && this.saveSettings());
	}
}
