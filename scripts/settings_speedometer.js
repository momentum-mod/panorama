'use_strict';

const UnitsType = {
	UPS: 0,
	KMH: 1,
	MPH: 2
};
const ColormodeType = {
	None: 0,
	Range: 1,
	Comparison: 2,
	ComparisonSep: 3
};
const SpeedoIDs = {
	AbsSpeedometer: 0,
	HorizSpeedometer: 1,
	VertSpeedometer: 2,
	EnergySpeedometer: 3,
	ExplosiveJumpVelocity: 4,
	LastJumpVelocity: 5,
	RampBoardVelocity: 6,
	RampLeaveVelocity: 7,
	StageEnterExitAbsVelocity: 8,
	StageEnterExitHorizVelocity: 9
};
const SpeedoDisplayNames = [ // TODO: localize
	'Absolute',
	'Horizontal',
	'Vertical',
	'Energy',
	'Explosive Jump',
	'Jump',
	'Ramp Board',
	'Ramp Leave',
	'Stage Absolute',
	'Stage Horizontal'
];


class SpeedometerDetailObject {
	constructor(id, speedometerKV, orderIndex) {
		this.containingPanel = null;
		this.detailPanel = null;
		this.unitsSettingContainer = null;
		this.profileSettingContainer = null;
		this.unitsDropdown = null;
		this.colorModeDropdown = null;
		this.colorProfileDropdown = null;
		this.toggleButton = null;
		this.applyButton = null;
		this.discardButton = null;
		this.deleteButton = null;
		this.moveupButton = null;
		this.movedownButton = null;
		this.nameLabel = null;
		this.create(id, speedometerKV, orderIndex);
	}
	destroy() {
		this.containingPanel.DeleteAsync(0.0);
	}
	discardChanges(speedometerKV) {
		if (this.id !== SpeedoIDs.EnergySpeedometer)
			this.unitsDropdown.SetSelectedIndex(speedometerKV['units']);
		this.colorModeDropdown.SetSelectedIndex(speedometerKV['colorize']);
		const colorProfile = speedometerKV['color_profile'];
		if (colorProfile)
			this.colorProfileDropdown.SetSelected(colorProfile);
		this.markAsUnmodified();
	}
	markAsModified() {
		this.discardButton.enabled = true;
		this.applyButton.enabled = true;
	}
	markAsUnmodified() {
		this.discardButton.enabled = false;
		this.applyButton.enabled = false;
	}
	create(id, speedometerKV, orderIndex) {
		this.id = id;

		this.containingPanel = $.CreatePanel('Panel', Speedometers.mainPanel, '');
		this.containingPanel.SetAttributeInt('order_index', orderIndex);
		this.containingPanel.LoadLayoutSnippet('speedometer');

		this.detailPanel = this.containingPanel.FindChildInLayoutFile('SpeedometerDetailContainer');
		this.unitsSettingContainer = this.detailPanel.FindChildInLayoutFile('SpeedometerUnitsContainer');
		this.profileSettingContainer = this.detailPanel.FindChildInLayoutFile('SpeedometerColorProfileContainer');
		this.toggleButton = this.containingPanel.FindChildInLayoutFile('SpeedometerToggleBtn');
		this.applyButton = this.containingPanel.FindChildInLayoutFile('SpeedometerApplyBtn');
		this.discardButton = this.containingPanel.FindChildInLayoutFile('SpeedometerDiscardBtn');
		this.deleteButton = this.containingPanel.FindChildInLayoutFile('SpeedometerDeleteBtn');
		this.unitsDropdown = this.detailPanel.FindChildInLayoutFile('SpeedometerUnits');
		this.colorModeDropdown = this.detailPanel.FindChildInLayoutFile('SpeedometerColorMode');
		this.colorProfileDropdown = this.detailPanel.FindChildInLayoutFile('SpeedometerColorProfile');
		this.moveupButton = this.containingPanel.FindChildInLayoutFile('SpeedometerMoveUpBtn');
		this.movedownButton = this.containingPanel.FindChildInLayoutFile('SpeedometerMoveDownBtn');
		this.nameLabel = this.toggleButton.FindChildInLayoutFile('SpeedometerName');
		this.nameLabel.text = SpeedoDisplayNames[id];

		this.colorModeDropdown.SetSelectedIndex(speedometerKV['colorize']);

		if (id === SpeedoIDs.EnergySpeedometer) {
			this.unitsSettingContainer.visible = false;
		}
		else {
			this.unitsDropdown.SetSelectedIndex(speedometerKV['units']);
			this.unitsDropdown.SetPanelEvent('oninputsubmit', () => Speedometers.markSpeedometerAsModified(this.id));
		}
		this.profileSettingContainer.SetHasClass('speedometer__settingcontainer--hidden', this.colorModeDropdown.GetSelected().id !== 'colormode1');

		this.toggleButton.SetPanelEvent('onactivate', () => { this.detailPanel.SetHasClass('speedometer__detail--hidden', !this.toggleButton.IsSelected()); });
		this.discardButton.SetPanelEvent('onactivate', () => Speedometers.discardChangesForSpeedometer(this.id, speedometerKV));
		this.applyButton.SetPanelEvent('onactivate', () => Speedometers.saveSpeedometer(this.id));
		this.deleteButton.SetPanelEvent('onactivate', () => Speedometers.deleteSpeedometer(this.id));
		this.moveupButton.SetPanelEvent('onactivate', () => Speedometers.reorderSpeedometer(this.id, true));
		this.movedownButton.SetPanelEvent('onactivate', () => Speedometers.reorderSpeedometer(this.id, false));

		this.updateProfileDropdown();
		const colProfileName = speedometerKV['color_profile'];
		if (colProfileName)
			this.colorProfileDropdown.SetSelected(colProfileName);

		this.colorModeDropdown.SetPanelEvent('oninputsubmit', () => {
			Speedometers.markSpeedometerAsModified(this.id);
			this.profileSettingContainer.SetHasClass('speedometer__settingcontainer--hidden', this.colorModeDropdown.GetSelected().id !== 'colormode1');
		});
		this.colorProfileDropdown.SetPanelEvent('oninputsubmit', () => Speedometers.markSpeedometerAsModified(this.id));

		this.markAsUnmodified();
	}
	updateProfileDropdown() {
		const selColorProfile = this.colorProfileDropdown.GetSelected()?.text;
		this.colorProfileDropdown.SetSelectedIndex(0);

		let profilesKV = SpeedometerSettingsAPI.GetColorProfiles();
		for (let i = 1; i < this.colorProfileDropdown.AccessDropDownMenu().GetChildCount(); i++) this.colorProfileDropdown.RemoveOptionIndex(i);
		Object.keys(profilesKV).forEach(profileName => {
			let optionPanel = $.CreatePanel('Label', this.colorProfileDropdown.AccessDropDownMenu(), profileName);
			optionPanel.text = profileName;
			this.colorProfileDropdown.AddOption(optionPanel);
		});

		// attempt to restore the old selection
		if (selColorProfile && this.colorProfileDropdown.HasOption(selColorProfile))
			this.colorProfileDropdown.SetSelected(selColorProfile);
	}
	saveToKV(speedometerKV) {
		if (this.id !== SpeedoIDs.EnergySpeedometer) {
			const selUnitsPanel = this.unitsDropdown.GetSelected();
			const selUnits = selUnitsPanel ? selUnitsPanel.GetAttributeInt('value', UnitsType.UPS) : UnitsType.UPS;
			speedometerKV['units'] = selUnits;
		}
		const selColorModePanel = this.colorModeDropdown.GetSelected();
		const selColorMode = selColorModePanel ? selColorModePanel.GetAttributeInt('value', ColormodeType.None) : ColormodeType.None;
		const selColorProfilePanel = this.colorProfileDropdown.GetSelected();

		speedometerKV['visible'] = this.containingPanel.visible;
		speedometerKV['colorize'] = selColorMode;
		if (selColorMode === ColormodeType.Range)
			speedometerKV['color_profile'] = selColorProfilePanel?.text;
		else
			delete speedometerKV['color_profile'];
	}
}
class Speedometers {
	static mainPanel = $('#Speedometers');
	static gamemode = 0;
	static keyvalues = null;
	static objectList = {};
	
	static addButton = $('#AddSpeedometerBtn');
	static resetButton = $('#ResetSpeedometersBtn');
	static discardButton = $('#DiscardSpeedometersBtn');
	static saveButton = $('#SaveSpeedometersBtn');

	static {
		$.RegisterForUnhandledEvent('OnSpeedometerSettingsLoaded', Speedometers.settingsLoaded);
	}
	static settingsLoaded(success) {
		if (!success) {
			$.Warning('Failed to load speedometer settings from settings!');
			return;
		}
		Speedometers.create();
	}

	static updateGamemode(gamemode) {
		Speedometers.gamemode = gamemode;
		Speedometers.create();
	}

	static clearSpeedometers() {
		Speedometers.mainPanel.RemoveAndDeleteChildren();
		Speedometers.objectList = {};
	}
	static deleteSpeedometer(id) {
		Speedometers.objectList[id]?.destroy();
		delete Speedometers.objectList[id];
		Speedometers.markAsModified();
	}
	static addSpeedometer() {
		let disabledIDs = [];
		Object.keys(SpeedoIDs).filter(speedoName => Speedometers.objectList[SpeedoIDs[speedoName]] === undefined).forEach(speedoName => disabledIDs.push(SpeedoIDs[speedoName]));
		if (disabledIDs.length === 0) return; // nothing is disabled, dont bother showing popup
		UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_speedometerselect.xml',
			`disabledIDs=${disabledIDs}&callback=${UiToolkitAPI.RegisterJSCallback(id => Speedometers.addSpeedometerByID(id))}`);
	}
	static addSpeedometerByID(id) {
		let speedoName = Object.keys(SpeedoIDs)[id];
		let speedoKV = Speedometers.keyvalues[speedoName];
		speedoKV['visible'] = true;

		Speedometers.objectList[id] = new SpeedometerDetailObject(id, speedoKV, Object.keys(SpeedoIDs).length - 1);
		Speedometers.markAsModified();
	}
	static discardChangesForSpeedometer(id, speedometerKV) {
		let speedometerObject = Speedometers.objectList[id];
		if (!speedometerKV || !speedometerObject) {
			$.Warning(`Discarding changes for speedometer ${id} which doesnt exist!`);
			return;
		}
		speedometerObject.discardChanges(speedometerKV);
	}
	static markSpeedometerAsModified(id) {
		let speedometerObject = Speedometers.objectList[id];
		if (!speedometerObject) {
			$.Warning(`Changing speedometer ${id} which doesnt exist!`);
			return;
		}
		speedometerObject.markAsModified();
		Speedometers.markAsModified();
	}
	static saveSpeedometer(id) {
		let speedoName = Object.keys(SpeedoIDs)[id];
		Speedometers.keyvalues[speedoName] = {};
		let speedoObject = Speedometers.objectList[id];
		speedoObject.saveToKV(Speedometers.keyvalues[speedoName]);
		speedoObject.markAsUnmodified();
		if (!SpeedometerSettingsAPI.SaveSpeedometersFromJS(Speedometers.gamemode, Speedometers.keyvalues))
			$.Warning(`Failed to write speedometer of gamemode ${Speedometers.gamemode} to disk`);
	}
	static reorderSpeedometer(id, moveup) {
		let speedometerObject = Speedometers.objectList[id];
		if (!speedometerObject) {
			$.Warning(`Reordering speedometer ${id} which doesnt exist!`);
			return;
		}
		let childIndex = Speedometers.mainPanel.GetChildIndex(speedometerObject.containingPanel);
		if (moveup) {
			childIndex--;
			if (childIndex < 0)
				Speedometers.mainPanel.MoveChildAfter(speedometerObject.containingPanel, Speedometers.mainPanel.GetLastChild());
			else
				Speedometers.mainPanel.MoveChildBefore(speedometerObject.containingPanel, Speedometers.mainPanel.GetChild(childIndex));
		}
		else {
			childIndex++;
			if (childIndex < Speedometers.mainPanel.GetChildCount())
				Speedometers.mainPanel.MoveChildAfter(speedometerObject.containingPanel, Speedometers.mainPanel.GetChild(childIndex));
			else
				Speedometers.mainPanel.MoveChildBefore(speedometerObject.containingPanel, Speedometers.mainPanel.GetFirstChild());
		}
		Speedometers.markAsModified();
	}

	static create() {
		Speedometers.clearSpeedometers();
		Speedometers.keyvalues = SpeedometerSettingsAPI.GetSettings(Speedometers.gamemode);
		Object.keys(Speedometers.keyvalues).filter(speedoName => speedoName !== 'order').forEach(speedoName => {
			let speedoKV = Speedometers.keyvalues[speedoName];
			if (speedoKV['visible'] === 0) return;

			let id = SpeedoIDs[speedoName];
			Speedometers.objectList[id] = new SpeedometerDetailObject(id, speedoKV, Speedometers.keyvalues['order'][speedoName]);
		});

		Speedometers.mainPanel.SortChildrenOnAttribute('order_index', true);
		Speedometers.markAsUnmodified();
	}
	static saveAllSpeedometers() {
		Object.keys(Speedometers.objectList).forEach(id => {
			let speedoName = Object.keys(SpeedoIDs)[id];
			Speedometers.keyvalues[speedoName] = {};
			let speedoObject = Speedometers.objectList[id];
			Speedometers.keyvalues['order'][speedoName] = Speedometers.mainPanel.GetChildIndex(speedoObject.containingPanel);
			speedoObject.saveToKV(Speedometers.keyvalues[speedoName]);
			speedoObject.markAsUnmodified();
		});

		let orderCtr = Speedometers.mainPanel.GetChildCount();
		Object.keys(SpeedoIDs).filter(speedoName => Speedometers.objectList[SpeedoIDs[speedoName]] === undefined).forEach(speedoName => {
			// make sure speedometers that arent visible (their panels are deleted) have an ordering that's above
			// the speedometers that are actually visible
			Speedometers.keyvalues['order'][speedoName] = orderCtr++;
			Speedometers.keyvalues[speedoName]['visible'] = false;
		});
		Speedometers.markAsUnmodified();
		if (!SpeedometerSettingsAPI.SaveSpeedometersFromJS(Speedometers.gamemode, Speedometers.keyvalues))
			$.Warning(`Failed to write speedometer of gamemode ${Speedometers.gamemode} to disk`);
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
		Speedometers.discardButton.enabled = true;
		Speedometers.saveButton.enabled = true;
	}
	static markAsUnmodified() {
		Speedometers.discardButton.enabled = false;
		Speedometers.saveButton.enabled = false;
	}
	static updateProfileDropdowns() {
		Object.keys(Speedometers.objectList).forEach(id => Speedometers.objectList[id]?.updateProfileDropdown());
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
		const splitColor = color.replace(/[^\d|,]/g, '').split(',');
		return `${splitColor[0]} ${splitColor[1]} ${splitColor[2]} ${splitColor[3] * 255}`;
	}
	static convertKVToCSS(color) {
		const splitColor = color.split(' ');
		return `rgba(${splitColor[0]}, ${splitColor[1]}, ${splitColor[2]}, ${splitColor[3] / 255})`;
	}
}
class RangeColorRangeDisplayObject {
	constructor(id, rangeObject, profileObject) {
		this.containingPanel = null;
		this.displayPanel = null;
		this.deleteButton = null;
		this.create(id, rangeObject, profileObject);
	}
	isEqualTo(other) {
		// displayObjectList is mostly just a suped up children list, so this should be enough for equality
		return this.containingPanel === other.containingPanel;
	}
	getMin() {
		return this.displayPanel ? this.displayPanel.min : -1;
	}
	getMax() {
		return this.displayPanel ? this.displayPanel.max : -1;
	}
	destroy() {
		this.containingPanel.DeleteAsync(0.0);
	}
	clearDisplay() {
		this.containingPanel?.RemoveAndDeleteChildren();
	}
	create(id, rangeObject, profileObject) {
		this.clearDisplay();
		this.id = id;

		this.containingPanel = $.CreatePanel('Panel', profileObject.displaysPanel, '');
		this.containingPanel.LoadLayoutSnippet('range-color-display');

		this.displayPanel = this.containingPanel.FindChildInLayoutFile('RangeColorDisplay');
		this.displayPanel.SetRange(rangeObject.min, rangeObject.max, rangeObject.csscolor);
		this.deleteButton = this.containingPanel.FindChildInLayoutFile('RangeColorDisplayDeleteBtn');

		this.displayPanel.SetPanelEvent('onrangechange', () => {
			const color = this.displayPanel.color;
			const colorRangeObject = new RangeColorObject(this.displayPanel.min, this.displayPanel.max, RangeColorObject.convertCSSToKV(color), color);
			RangeColorProfiles.updateRangeInProfile(profileObject.name, this.id, colorRangeObject);
		});
		this.deleteButton.SetPanelEvent('onactivate', () => RangeColorProfiles.deleteRangeFromProfile(profileObject.name, this.id));
	}
	saveToKV(rangeKV) {
		const csscolor = this.displayPanel.color;
		let rangeObject = new RangeColorObject(this.displayPanel.min, this.displayPanel.max, RangeColorObject.convertCSSToKV(csscolor), csscolor);
		rangeObject.saveToKV(rangeKV);
	}
}
class RangeColorProfileObject {
	constructor(name, profileKV) {
		this.profilePanel = null;
		this.displaysContainer = null;
		this.displaysPanel = null;
		this.discardButton = null;
		this.applyButton = null;
		this.addButton = null;
		this.deleteButton = null;
		this.editButton = null;
		this.toggleButton = null;
		this.nameLabel = null;
		this.displayObjectList = null;
		this.create(name, profileKV);
	}
	destroy() {
		this.profilePanel.DeleteAsync(0.0);
	}
	clearDisplays() {
		this.displaysPanel?.RemoveAndDeleteChildren();
		this.displayObjectList = {};
	}
	updateName(name) {
		this.name = name;
		this.nameLabel.text = name;
		this.markAsModified();
	}
	deleteRange(profileName, id) {
		let displayObject = this.displayObjectList[id];
		if (!displayObject) {
			$.Warning(`Deleting non-existant range ${id} from profile ${profileName}!`);
			return;
		}
		displayObject.destroy();
		delete this.displayObjectList[id];
		this.markAsModified();
	}
	// places display panel based its relative min value so higher ranges are higher up in the children list
	reorderDisplayPanels(displayObject, rangeObject) {
		let found = false;
		Object.keys(this.displayObjectList).every((id) => {
			let dispObj = this.displayObjectList[id];
			if (dispObj.isEqualTo(displayObject))
				return true;

			const otherMin = dispObj.getMin();
			if (rangeObject.min === otherMin) {
				if (displayObject.getMax() < dispObj.getMax())
					this.displaysPanel.MoveChildBefore(displayObject.containingPanel, dispObj.containingPanel);
				else
					this.displaysPanel.MoveChildAfter(displayObject.containingPanel, dispObj.containingPanel);

				found = true;
				return false;
			}
			else if (rangeObject.min < otherMin) {
				this.displaysPanel.MoveChildBefore(displayObject.containingPanel, dispObj.containingPanel);
				found = true;
				return false;
			}
			return true;
		});
		if (found) return;

		const lastChildPanel = this.displaysPanel.GetLastChild();
		if (displayObject.containingPanel === lastChildPanel) return;
		this.displaysPanel.MoveChildAfter(displayObject.containingPanel, lastChildPanel);
	}
	updateRange(profileName, id, rangeObject) {
		let displayObject = this.displayObjectList[id];
		if (!displayObject) {
			$.Warning(`Updating nonexistent range ${id} in profile ${profileName}!`)
			return;
		}
		// it would be nice to enforce no gaps in bounds, but it is painful to even think about the functionality of that UI/UX wise
		this.reorderDisplayPanels(displayObject, rangeObject);
		this.markAsModified();
	}
	addRange(profileName, id, rangeObject) {
		if (this.displayObjectList[id]) {
			$.Warning(`Adding range ${id} which already exists in profile ${profileName}`);
			return;
		}
		let displayObject = new RangeColorRangeDisplayObject(id, rangeObject, this);
		this.displayObjectList[id] = displayObject;
		this.reorderDisplayPanels(displayObject, rangeObject);
		this.markAsModified();
	}
	discardChanges(profileKV) {
		this.createDisplayPanels(profileKV);
		this.markAsUnmodified();
	}

	createDisplayPanels(profileKV) {
		Object.keys(this.displayObjectList)?.forEach((id) => this.displayObjectList[id]?.destroy());
		this.displayObjectList = {};
		Object.keys(profileKV).forEach((id) => {
			let rangeKV = profileKV[id];
			let kvcolor = rangeKV['color'];
			let rangeObject = new RangeColorObject(rangeKV['min'], rangeKV['max'], kvcolor, RangeColorObject.convertKVToCSS(kvcolor));
			this.displayObjectList[id] = new RangeColorRangeDisplayObject(id, rangeObject, this);
			this.reorderDisplayPanels(this.displayObjectList[id], rangeObject); // TODO: this is expensive!!!
		});
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
		this.applyButton = this.profilePanel.FindChildInLayoutFile('RangeColorApplyBtn');
		this.deleteButton = this.profilePanel.FindChildInLayoutFile('RangeColorDeleteBtn');
		this.editButton = this.profilePanel.FindChildInLayoutFile('RangeColorEditNameBtn');
		this.toggleButton = this.profilePanel.FindChildInLayoutFile('RangeColorToggleBtn');

		this.nameLabel = this.toggleButton.FindChildInLayoutFile('RangeColorName');
		this.nameLabel.text = this.name;
		
		this.markAsUnmodified();
		
		this.addButton.SetPanelEvent('onactivate', () => RangeColorProfiles.addRangeDisplayToProfile(this.name, new RangeColorObject(0, 1, '255 255 255 255', 'rgba(255,255,255,1)')));
		this.discardButton.SetPanelEvent('onactivate', () => RangeColorProfiles.discardChangesForProfile(this.ogName, this.name, profileKV));
		this.applyButton.SetPanelEvent('onactivate', () => RangeColorProfiles.saveProfile(this.ogName, this.name));
		this.toggleButton.SetPanelEvent('onactivate', () => this.displaysContainer.SetHasClass('rangecolor__displayscont--hidden', !this.toggleButton.IsSelected()));
		this.deleteButton.SetPanelEvent('onactivate', () => RangeColorProfiles.deleteProfile(this.name));
		this.editButton.SetPanelEvent('onactivate', () => RangeColorProfiles.makeColorProfileNamePopup(this.name, 'Edit', (profileName) => RangeColorProfiles.updateProfileName(this.name, profileName)));

		this.createDisplayPanels(profileKV);
	}
	markAsModified() {
		this.discardButton.enabled = true;
		this.applyButton.enabled = true;
	}
	markAsUnmodified() {
		this.ogName = this.name;
		this.discardButton.enabled = false;
		this.applyButton.enabled = false;
	}
	saveToKV(profileKV) {
		Object.keys(this.displayObjectList).forEach((id) => {
			profileKV[id] = {};
			this.displayObjectList[id].saveToKV(profileKV[id]);
		});
	}
}
class RangeColorProfiles {
	static mainPanel = $('#SpeedometerColorProfiles');
	static keyvalues = null;
	static objectList = {};
	
	static addButton = $('#AddColorProfileBtn');
	static resetButton = $('#ResetColorProfilesBtn');
	static discardButton = $('#DiscardColorProfilesBtn');
	static saveButton = $('#SaveColorProfilesBtn');

	static {
		$.RegisterForUnhandledEvent('OnRangeColorProfilesLoaded', RangeColorProfiles.profilesLoaded);
	}
	static profilesLoaded(success) {
		if (!success) {
			$.Warning('Failed to load range color profiles from settings!');
			return;
		}
		RangeColorProfiles.recreate();
	}

	static clearProfiles() {
		RangeColorProfiles.mainPanel.RemoveAndDeleteChildren();
		RangeColorProfiles.objectList = {};
	};
	static addProfile() {
		RangeColorProfiles.makeColorProfileNamePopup('', 'Create', (profileName) => RangeColorProfiles.addEmptyProfile(profileName));
	}
	static addEmptyProfile(profileName) {
		if (RangeColorProfiles.objectList[profileName]) {
			$.Warning(`Adding profile ${profileName} that already exists!`);
			return;
		}
		let profileObject = new RangeColorProfileObject(profileName, {});
		profileObject.applyButton.enabled = true; // kind of a hack, but only want apply button to be enabled in this case
		RangeColorProfiles.objectList[profileName] = profileObject;
		RangeColorProfiles.markAsModified();
	}
	static deleteProfile(profileName) {
		RangeColorProfiles.objectList[profileName]?.destroy();
		delete RangeColorProfiles.objectList[profileName];
		RangeColorProfiles.markAsModified();
	}
	static updateProfileName(oldProfileName, profileName) {
		let profileObject = RangeColorProfiles.objectList[oldProfileName];
		if (!profileObject) {
			$.Warning(`Updating old profile name ${oldProfileName} which doesnt exist!`);
			return;
		}
		if (profileObject.name === profileName) return;
		profileObject.updateName(profileName);
		Object.defineProperty(RangeColorProfiles.objectList, profileName, Object.getOwnPropertyDescriptor(RangeColorProfiles.objectList, oldProfileName)); // rename key
		delete RangeColorProfiles.objectList[oldProfileName];
		RangeColorProfiles.markAsModified();
	}
	static addRangeDisplayToProfile(profileName, rangeObject) {
		let profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileObject) {
			$.Warning(`Adding range to profile ${profileName} which doesnt exist!`);
			return;
		}
		// avoid id clashing by using one above the highest ID
		let id = Object.keys(profileObject.displayObjectList).length === 0 ? 0 : Math.max.apply(null, Object.keys(profileObject.displayObjectList)) + 1;
		profileObject.addRange(profileName, id, rangeObject);
		RangeColorProfiles.markAsModified();
	}
	static deleteRangeFromProfile(profileName, id) {
		let profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileObject) {
			$.Warning(`Deleting range from profile ${profileName} which doesnt exist!`);
			return;
		}
		profileObject.deleteRange(profileName, id);
		RangeColorProfiles.markAsModified();
	}
	static updateRangeInProfile(profileName, id, rangeObject) {
		let profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileObject) {
			$.Warning(`Changing range in profile ${profileName} which doesnt exist!`);
			return;
		}
		profileObject.updateRange(profileName, id, rangeObject);
		RangeColorProfiles.markAsModified();
	}
	static discardChangesForProfile(originalName, profileName, profileKV) {
		let profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileKV || !profileObject) {
			$.Warning(`Discarding profile ${profileName} which doesnt exist!`);
			return;
		}
		RangeColorProfiles.updateProfileName(profileName, originalName);
		profileObject.discardChanges(profileKV);
		RangeColorProfiles.markAsUnmodified();
	}
	static saveProfile(originalName, profileName) {
		let profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileObject) {
			$.Warning(`Saving profile ${profileName} which doesnt exist!`);
		}
		delete RangeColorProfiles.keyvalues[originalName];
		RangeColorProfiles.keyvalues[profileName] = {};
		profileObject.saveToKV(RangeColorProfiles.keyvalues[profileName]);
		// TODO: check if every object is unmodified?
		if (SpeedometerSettingsAPI.SaveColorProfilesFromJS(RangeColorProfiles.keyvalues)) {
			profileObject.markAsUnmodified();
			Speedometers.updateProfileDropdowns();
		}
		else
			$.Warning('Failed to write color profiles to disk');
		
	}

	static recreate() {
		RangeColorProfiles.create();
		Speedometers.updateProfileDropdowns();
	}
	static create() {
		RangeColorProfiles.clearProfiles();
		RangeColorProfiles.markAsUnmodified();
		RangeColorProfiles.keyvalues = SpeedometerSettingsAPI.GetColorProfiles();
		Object.keys(RangeColorProfiles.keyvalues).forEach((profileName) => {
			RangeColorProfiles.objectList[profileName] = new RangeColorProfileObject(profileName, RangeColorProfiles.keyvalues[profileName]);
		});
	}
	static saveAllProfiles() {
		let keyvalues = {};
		Object.keys(RangeColorProfiles.objectList).forEach((profileName) => {
			keyvalues[profileName] = {};
			let profileObject = RangeColorProfiles.objectList[profileName];
			profileObject.saveToKV(keyvalues[profileName]);
			profileObject.markAsUnmodified();
		});
		if (SpeedometerSettingsAPI.SaveColorProfilesFromJS(keyvalues)) {
			RangeColorProfiles.markAsUnmodified();
			Speedometers.updateProfileDropdowns();
		}
		else
			$.Warning('Failed to write color profiles to disk');
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
		RangeColorProfiles.discardButton.enabled = true;
		RangeColorProfiles.saveButton.enabled = true;
	}
	static markAsUnmodified() {
		RangeColorProfiles.discardButton.enabled = false;
		RangeColorProfiles.saveButton.enabled = false;
	}

	static makeColorProfileNamePopup(prefilledText, OKBtnText, callback) {
		let profileNames = [];
		Object.keys(RangeColorProfiles.objectList).forEach(profileName => profileNames.push(profileName));
		UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/popups/popup_rangecolorprofilename.xml', `profileNames=${profileNames}&prefilledText=${prefilledText}&OKBtnText=${OKBtnText}&callback=${UiToolkitAPI.RegisterJSCallback(callback)}`);
	}
}


class SpeedometerSettings {
	static gamemodeDropDown = $('#GamemodeDropDown');

	static loadSettings() {
		// order matches events fired from C++ when speedometer settings are loaded
		// will not initialize correctly if color profiles are loaded after speedometers
		RangeColorProfiles.create();
		Speedometers.create();
	}

	static updateGamemode() {
		const gamemodePanel = SpeedometerSettings.gamemodeDropDown.GetSelected();
		const gamemode = gamemodePanel ? gamemodePanel.GetAttributeInt('value', 0) : 0;
		Speedometers.updateGamemode(gamemode);
	}
}
