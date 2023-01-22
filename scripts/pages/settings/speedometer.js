'use strict';

const DEFAULT_GAMEMODE = 1; // Surf

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
		this.discardButton = null;
		this.deleteButton = null;
		this.moveupButton = null;
		this.movedownButton = null;
		this.nameLabel = null;
		this.create(id, speedometerKV, orderIndex);
	}
	destroy() {
		this.containingPanel.DeleteAsync(0);
	}
	discardChanges(speedometerKV) {
		if (this.id !== SpeedometerIDs.EnergySpeedometer) this.unitsDropdown.SetSelectedIndex(speedometerKV['units']);
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
	create(id, speedometerKV, orderIndex) {
		this.id = id;

		this.containingPanel = $.CreatePanel('Panel', Speedometers.mainPanel, '');
		this.containingPanel.SetAttributeInt('order_index', orderIndex);
		this.containingPanel.LoadLayoutSnippet('speedometer');

		this.detailPanel = this.containingPanel.FindChildInLayoutFile('SpeedometerDetailContainer');
		this.unitsSettingContainer = this.detailPanel.FindChildInLayoutFile('SpeedometerUnitsContainer');
		this.profileSettingContainer = this.detailPanel.FindChildInLayoutFile('SpeedometerColorProfileContainer');
		this.toggleButton = this.containingPanel.FindChildInLayoutFile('SpeedometerToggleBtn');
		this.discardButton = this.containingPanel.FindChildInLayoutFile('SpeedometerDiscardBtn');
		this.deleteButton = this.containingPanel.FindChildInLayoutFile('SpeedometerDeleteBtn');
		this.unitsDropdown = this.detailPanel.FindChildInLayoutFile('SpeedometerUnits');
		this.colorModeDropdown = this.detailPanel.FindChildInLayoutFile('SpeedometerColorMode');
		this.colorProfileDropdown = this.detailPanel.FindChildInLayoutFile('SpeedometerColorProfile');
		this.moveupButton = this.containingPanel.FindChildInLayoutFile('SpeedometerMoveUpBtn');
		this.movedownButton = this.containingPanel.FindChildInLayoutFile('SpeedometerMoveDownBtn');
		this.nameLabel = this.toggleButton.FindChildInLayoutFile('SpeedometerName');
		this.nameLabel.text = $.Localize(SpeedometerDispNames[id]);

		this.colorModeDropdown.SetSelectedIndex(speedometerKV['colorize']);

		if (id === SpeedometerIDs.EnergySpeedometer) {
			this.unitsSettingContainer.visible = false;
		} else {
			this.unitsDropdown.SetSelectedIndex(speedometerKV['units']);
			this.unitsDropdown.SetPanelEvent('oninputsubmit', () => Speedometers.markSpeedometerAsModified(this.id));
		}
		this.profileSettingContainer.SetHasClass(
			'settings-speedometer__settingcontainer--hidden',
			this.colorModeDropdown.GetSelected().id !== 'colormode1'
		);

		this.toggleButton.SetPanelEvent('onactivate', () => {
			this.detailPanel.SetHasClass('settings-speedometer__detail--hidden', !this.toggleButton.IsSelected());
		});
		this.discardButton.SetPanelEvent('onactivate', () =>
			Speedometers.discardChangesForSpeedometer(this.id, speedometerKV)
		);
		this.deleteButton.SetPanelEvent('onactivate', () => Speedometers.deleteSpeedometer(this.id));
		this.moveupButton.SetPanelEvent('onactivate', () => Speedometers.reorderSpeedometer(this.id, true));
		this.movedownButton.SetPanelEvent('onactivate', () => Speedometers.reorderSpeedometer(this.id, false));

		this.updateProfileDropdown();
		const colProfileName = speedometerKV['color_profile'];
		if (colProfileName) this.colorProfileDropdown.SetSelected(colProfileName);

		this.colorModeDropdown.SetPanelEvent('oninputsubmit', () => {
			Speedometers.markSpeedometerAsModified(this.id);
			this.profileSettingContainer.SetHasClass(
				'settings-speedometer__settingcontainer--hidden',
				this.colorModeDropdown.GetSelected().id !== 'colormode1'
			);
		});
		this.colorProfileDropdown.SetPanelEvent('oninputsubmit', () => Speedometers.markSpeedometerAsModified(this.id));

		this.markAsUnmodified();
	}
	updateProfileDropdown() {
		const selColorProfile = this.colorProfileDropdown.GetSelected()?.text;
		this.colorProfileDropdown.SetSelectedIndex(0);

		const profilesKV = SpeedometerSettingsAPI.GetColorProfiles();
		for (let i = 1; i < this.colorProfileDropdown.AccessDropDownMenu().GetChildCount(); i++)
			this.colorProfileDropdown.RemoveOptionIndex(i);
		for (const profileName of Object.keys(profilesKV)) {
			const optionPanel = $.CreatePanel('Label', this.colorProfileDropdown.AccessDropDownMenu(), profileName);
			optionPanel.text = profileName;
			this.colorProfileDropdown.AddOption(optionPanel);
		}

		// attempt to restore the old selection
		if (selColorProfile && this.colorProfileDropdown.HasOption(selColorProfile))
			this.colorProfileDropdown.SetSelected(selColorProfile);
	}
	saveToKV(speedometerKV) {
		if (this.id !== SpeedometerIDs.EnergySpeedometer) {
			const selUnitsPanel = this.unitsDropdown.GetSelected();
			const selUnits = selUnitsPanel
				? selUnitsPanel.GetAttributeInt('value', SpeedometerUnitsType.UPS)
				: SpeedometerUnitsType.UPS;
			speedometerKV['units'] = selUnits;
		}
		const selColorModePanel = this.colorModeDropdown.GetSelected();
		const selColorMode = selColorModePanel
			? selColorModePanel.GetAttributeInt('value', SpeedometerColorMode.NONE)
			: SpeedometerColorMode.NONE;
		const selColorProfilePanel = this.colorProfileDropdown.GetSelected();

		speedometerKV['visible'] = this.containingPanel.visible;
		speedometerKV['colorize'] = selColorMode;
		if (selColorMode === SpeedometerColorMode.RANGE) speedometerKV['color_profile'] = selColorProfilePanel?.text;
		else delete speedometerKV['color_profile'];
	}
}
class Speedometers {
	/** @type {Panel} @static */
	static mainPanel = $('#Speedometers');
	static gamemode = DEFAULT_GAMEMODE;
	static keyvalues = null;
	static objectList = {};

	/** @type {Button} @static */
	static addButton = $('#AddSpeedometerBtn');
	/** @type {Button} @static */
	static resetButton = $('#ResetSpeedometersBtn');
	/** @type {Button} @static */
	static discardButton = $('#DiscardSpeedometersBtn');

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
		const disabledIDs = [];
		for (const speedoName of Object.keys(SpeedometerIDs).filter(
			(speedoName) => Speedometers.objectList[SpeedometerIDs[speedoName]] === undefined
		))
			disabledIDs.push(SpeedometerIDs[speedoName]);
		if (disabledIDs.length === 0) return; // nothing is disabled, don't bother showing popup
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/speedometer-select.xml',
			`disabledIDs=${disabledIDs}&callback=${UiToolkitAPI.RegisterJSCallback((id) =>
				Speedometers.addSpeedometerByID(id)
			)}`
		);
	}
	static addSpeedometerByID(id) {
		const speedoName = Object.keys(SpeedometerIDs)[id];
		const speedoKV = Speedometers.keyvalues[speedoName];
		speedoKV['visible'] = true;

		Speedometers.objectList[id] = new SpeedometerDetailObject(id, speedoKV, Object.keys(SpeedometerIDs).length - 1);
		Speedometers.markAsModified();
	}
	static discardChangesForSpeedometer(id, speedometerKV) {
		const speedometerObject = Speedometers.objectList[id];
		if (!speedometerKV || !speedometerObject) {
			$.Warning(`Discarding changes for speedometer ${id} which doesnt exist!`);
			return;
		}
		speedometerObject.discardChanges(speedometerKV);
	}
	static markSpeedometerAsModified(id) {
		const speedometerObject = Speedometers.objectList[id];
		if (!speedometerObject) {
			$.Warning(`Changing speedometer ${id} which doesnt exist!`);
			return;
		}
		speedometerObject.markAsModified();
		Speedometers.markAsModified();
	}
	static reorderSpeedometer(id, moveup) {
		const speedometerObject = Speedometers.objectList[id];
		if (!speedometerObject) {
			$.Warning(`Reordering speedometer ${id} which doesnt exist!`);
			return;
		}
		let childIndex = Speedometers.mainPanel.GetChildIndex(speedometerObject.containingPanel);
		if (moveup) {
			childIndex--;
			if (childIndex < 0)
				Speedometers.mainPanel.MoveChildAfter(
					speedometerObject.containingPanel,
					Speedometers.mainPanel.GetLastChild()
				);
			else
				Speedometers.mainPanel.MoveChildBefore(
					speedometerObject.containingPanel,
					Speedometers.mainPanel.GetChild(childIndex)
				);
		} else {
			childIndex++;
			if (childIndex < Speedometers.mainPanel.GetChildCount())
				Speedometers.mainPanel.MoveChildAfter(
					speedometerObject.containingPanel,
					Speedometers.mainPanel.GetChild(childIndex)
				);
			else
				Speedometers.mainPanel.MoveChildBefore(
					speedometerObject.containingPanel,
					Speedometers.mainPanel.GetFirstChild()
				);
		}
		Speedometers.markAsModified();
	}

	static create() {
		Speedometers.clearSpeedometers();
		Speedometers.keyvalues = SpeedometerSettingsAPI.GetSettings(Speedometers.gamemode);
		for (const speedoName of Object.keys(Speedometers.keyvalues).filter((speedoName) => speedoName !== 'order')) {
			const speedoKV = Speedometers.keyvalues[speedoName];
			if (speedoKV['visible'] === 0) continue;

			const id = SpeedometerIDs[speedoName];
			Speedometers.objectList[id] = new SpeedometerDetailObject(
				id,
				speedoKV,
				Speedometers.keyvalues['order'][speedoName]
			);
		}

		Speedometers.mainPanel.SortChildrenOnAttribute('order_index', true);
		Speedometers.markAsUnmodified();
	}
	static saveAllSpeedometers() {
		for (const id of Object.keys(Speedometers.objectList)) {
			const speedoName = Object.keys(SpeedometerIDs)[id];
			Speedometers.keyvalues[speedoName] = {};
			const speedoObject = Speedometers.objectList[id];
			Speedometers.keyvalues['order'][speedoName] = Speedometers.mainPanel.GetChildIndex(
				speedoObject.containingPanel
			);
			speedoObject.saveToKV(Speedometers.keyvalues[speedoName]);
			speedoObject.markAsUnmodified();
		}

		let orderCtr = Speedometers.mainPanel.GetChildCount();
		for (const speedoName of Object.keys(SpeedometerIDs).filter(
			(speedoName) => Speedometers.objectList[SpeedometerIDs[speedoName]] === undefined
		)) {
			// make sure speedometers that aren't visible (their panels are deleted) have an ordering that's above
			// the speedometers that are actually visible
			if (Speedometers.keyvalues?.['order']?.[speedoName])
				Speedometers.keyvalues['order'][speedoName] = orderCtr++;
			Speedometers.keyvalues[speedoName]['visible'] = false;
		}
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
	}
	static markAsUnmodified() {
		Speedometers.discardButton.enabled = false;
	}
	static updateProfileDropdowns() {
		for (const id of Object.keys(Speedometers.objectList)) Speedometers.objectList[id]?.updateProfileDropdown();
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
		const splitColor = color.replace(/[^\d,|]/g, '').split(',');
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
		this.containingPanel.DeleteAsync(0);
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
			const colorRangeObject = new RangeColorObject(
				this.displayPanel.min,
				this.displayPanel.max,
				RangeColorObject.convertCSSToKV(color),
				color
			);
			RangeColorProfiles.updateRangeInProfile(profileObject.name, this.id, colorRangeObject);
		});
		this.deleteButton.SetPanelEvent('onactivate', () =>
			RangeColorProfiles.deleteRangeFromProfile(profileObject.name, this.id)
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
	}
}
class RangeColorProfileObject {
	constructor(name, profileKV) {
		this.profilePanel = null;
		this.displaysContainer = null;
		this.displaysPanel = null;
		this.discardButton = null;
		this.addButton = null;
		this.deleteButton = null;
		this.editButton = null;
		this.toggleButton = null;
		this.nameLabel = null;
		this.displayObjectList = null;
		this.create(name, profileKV);
	}
	destroy() {
		this.profilePanel.DeleteAsync(0);
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
		const displayObject = this.displayObjectList[id];
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
			const dispObj = this.displayObjectList[id];
			if (dispObj.isEqualTo(displayObject)) return true;

			const otherMin = dispObj.getMin();
			if (rangeObject.min === otherMin) {
				if (displayObject.getMax() < dispObj.getMax())
					this.displaysPanel.MoveChildBefore(displayObject.containingPanel, dispObj.containingPanel);
				else this.displaysPanel.MoveChildAfter(displayObject.containingPanel, dispObj.containingPanel);

				found = true;
				return false;
			} else if (rangeObject.min < otherMin) {
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
		const displayObject = this.displayObjectList[id];
		if (!displayObject) {
			$.Warning(`Updating nonexistent range ${id} in profile ${profileName}!`);
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
		const displayObject = new RangeColorRangeDisplayObject(id, rangeObject, this);
		this.displayObjectList[id] = displayObject;
		this.reorderDisplayPanels(displayObject, rangeObject);
		this.markAsModified();
	}
	discardChanges(profileKV) {
		this.createDisplayPanels(profileKV);
		this.markAsUnmodified();
	}

	createDisplayPanels(profileKV) {
		for (const id of Object.keys(this.displayObjectList) || []) this.displayObjectList[id]?.destroy();

		this.displayObjectList = {};

		for (const id of Object.keys(profileKV)) {
			const rangeKV = profileKV[id];
			const kvcolor = rangeKV['color'];
			const rangeObject = new RangeColorObject(
				rangeKV['min'],
				rangeKV['max'],
				kvcolor,
				RangeColorObject.convertKVToCSS(kvcolor)
			);
			this.displayObjectList[id] = new RangeColorRangeDisplayObject(id, rangeObject, this);
			this.reorderDisplayPanels(this.displayObjectList[id], rangeObject); // TODO: this is expensive!!!
		}
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
		this.nameLabel.text = this.name;

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
		for (const id of Object.keys(this.displayObjectList)) {
			profileKV[id] = {};
			this.displayObjectList[id].saveToKV(profileKV[id]);
		}
	}
}
class RangeColorProfiles {
	/** @type {Panel} @static */
	static mainPanel = $('#SpeedometerColorProfiles');
	static keyvalues = null;
	static objectList = {};

	/** @type {Button} @static */
	static addButton = $('#AddColorProfileBtn');
	/** @type {Button} @static */
	static resetButton = $('#ResetColorProfilesBtn');
	/** @type {Button} @static */
	static discardButton = $('#DiscardColorProfilesBtn');

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
	}
	static addProfile() {
		RangeColorProfiles.makeColorProfileNamePopup('', $.Localize('#Common_Create'), (profileName) =>
			RangeColorProfiles.addEmptyProfile(profileName)
		);
	}
	static addEmptyProfile(profileName) {
		if (RangeColorProfiles.objectList[profileName]) {
			$.Warning(`Adding profile ${profileName} that already exists!`);
			return;
		}
		const profileObject = new RangeColorProfileObject(profileName, {});
		RangeColorProfiles.objectList[profileName] = profileObject;
		RangeColorProfiles.markAsModified();
	}
	static deleteProfile(profileName) {
		RangeColorProfiles.objectList[profileName]?.destroy();
		delete RangeColorProfiles.objectList[profileName];
		RangeColorProfiles.markAsModified();
	}
	static updateProfileName(oldProfileName, profileName) {
		const profileObject = RangeColorProfiles.objectList[oldProfileName];
		if (!profileObject) {
			$.Warning(`Updating old profile name ${oldProfileName} which doesnt exist!`);
			return;
		}
		if (profileObject.name === profileName) return;
		profileObject.updateName(profileName);
		Object.defineProperty(
			RangeColorProfiles.objectList,
			profileName,
			Object.getOwnPropertyDescriptor(RangeColorProfiles.objectList, oldProfileName)
		); // rename key
		delete RangeColorProfiles.objectList[oldProfileName];
		RangeColorProfiles.markAsModified();
	}
	static addRangeDisplayToProfile(profileName, rangeObject) {
		const profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileObject) {
			$.Warning(`Adding range to profile ${profileName} which doesnt exist!`);
			return;
		}
		// avoid id clashing by using one above the highest ID
		const id =
			Object.keys(profileObject.displayObjectList).length === 0
				? 0
				: Math.max.apply(null, Object.keys(profileObject.displayObjectList)) + 1;
		profileObject.addRange(profileName, id, rangeObject);
		RangeColorProfiles.markAsModified();
	}
	static deleteRangeFromProfile(profileName, id) {
		const profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileObject) {
			$.Warning(`Deleting range from profile ${profileName} which doesnt exist!`);
			return;
		}
		profileObject.deleteRange(profileName, id);
		RangeColorProfiles.markAsModified();
	}
	static updateRangeInProfile(profileName, id, rangeObject) {
		const profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileObject) {
			$.Warning(`Changing range in profile ${profileName} which doesnt exist!`);
			return;
		}
		profileObject.updateRange(profileName, id, rangeObject);
		RangeColorProfiles.markAsModified();
	}
	static discardChangesForProfile(originalName, profileName, profileKV) {
		const profileObject = RangeColorProfiles.objectList[profileName];
		if (!profileKV || !profileObject) {
			$.Warning(`Discarding profile ${profileName} which doesnt exist!`);
			return;
		}
		RangeColorProfiles.updateProfileName(profileName, originalName);
		profileObject.discardChanges(profileKV);
		RangeColorProfiles.markAsUnmodified();
	}

	static recreate() {
		RangeColorProfiles.create();
		Speedometers.updateProfileDropdowns();
	}
	static create() {
		RangeColorProfiles.clearProfiles();
		RangeColorProfiles.markAsUnmodified();
		RangeColorProfiles.keyvalues = SpeedometerSettingsAPI.GetColorProfiles();
		for (const profileName of Object.keys(RangeColorProfiles.keyvalues)) {
			RangeColorProfiles.objectList[profileName] = new RangeColorProfileObject(
				profileName,
				RangeColorProfiles.keyvalues[profileName]
			);
		}
	}
	static saveAllProfiles() {
		const keyvalues = {};
		for (const profileName of Object.keys(RangeColorProfiles.objectList)) {
			keyvalues[profileName] = {};
			const profileObject = RangeColorProfiles.objectList[profileName];
			profileObject.saveToKV(keyvalues[profileName]);
			profileObject.markAsUnmodified();
		}
		if (SpeedometerSettingsAPI.SaveColorProfilesFromJS(keyvalues)) {
			RangeColorProfiles.markAsUnmodified();
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
		RangeColorProfiles.discardButton.enabled = true;
	}
	static markAsUnmodified() {
		RangeColorProfiles.discardButton.enabled = false;
	}

	static makeColorProfileNamePopup(prefilledText, OKBtnText, callback) {
		const profileNames = [];
		for (const profileName of Object.keys(RangeColorProfiles.objectList)) profileNames.push(profileName);
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/range-color-profile-name.xml',
			`profileNames=${profileNames}&prefilledText=${prefilledText}&OKBtnText=${OKBtnText}&callback=${UiToolkitAPI.RegisterJSCallback(
				callback
			)}`
		);
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
		const gamemode = gamemodePanel ? gamemodePanel.GetAttributeInt('value', DEFAULT_GAMEMODE) : DEFAULT_GAMEMODE;
		Speedometers.updateGamemode(gamemode);
	}

	static saveSettings() {
		RangeColorProfiles.saveAllProfiles();
		Speedometers.saveAllSpeedometers();
	}

	static {
		$.RegisterForUnhandledEvent('SettingsSave', this.saveSettings);

		// Save to file whenever the settings page gets closed as well
		$.RegisterForUnhandledEvent('MainMenuTabHidden', (tab) => tab === 'Settings' && this.saveSettings());
	}
}
