/**
 * Zoning UI logic
 */

const TracklistSnippet = {
	TRACK: 'tracklist-track',
	SEGMENT: 'tracklist-segment',
	CHECKPOINT: 'tracklist-checkpoint'
};

const DefragFlags = {
	HASTE: 1 << 0,
	SLICK: 1 << 1,
	DAMAGEBOOST: 1 << 2,
	ROCKETS: 1 << 3,
	PLASMA: 1 << 4,
	BFG: 1 << 5
};

class ZoneMenu {
	static panels = {
		/** @type {Panel} @static */
		zoningMenu: $.GetContextPanel(),
		/** @type {Panel} @static */
		trackList: $('#TrackList') as Panel,
		/** @type {Panel} @static */
		propertiesTrack: $('#TrackProperties') as Panel,
		/** @type {Panel} @static */
		defragFlags: $('#DefragFlags') as Panel,
		/** @type {Panel} @static */
		propertiesSegment: $('#SegmentProperties') as Panel,
		/** @type {Panel} @static */
		propertiesZone: $('#ZoneProperties') as Panel,
		/** @type {DropDown} @static */
		filterSelect: $('#FilterSelect'),
		/** @type {DropDown} @static */
		volumeSelect: $('#VolumeSelect') as DropDown,
		/** @type {DropDown} @static */
		regionSelect: $('#RegionSelect') as DropDown,
		/** @type {TextEntry[][]} @static */
		regionPoints: [
			[$('#Point0X') as TextEntry, $('#Point0Y') as TextEntry],
			[$('#Point1X') as TextEntry, $('#Point1Y') as TextEntry],
			[$('#Point2X') as TextEntry, $('#Point2Y') as TextEntry],
			[$('#Point3X') as TextEntry, $('#Point3Y') as TextEntry]
		],
		/** @type {TextEntry} @static */
		regionBottom: $('#RegionBottom') as TextEntry,
		/** @type {TextEntry} @static */
		regionTop: $('#RegionTop') as TextEntry,
		/** @type {TextEntry} @static */
		regionSafeHeight: $('#RegionSafeHeight') as TextEntry,
		/** @type {DropDown} @static */
		regionTPDest: $('#RegionTPDest')
	};

	static selectedZone = {
		track: null as MainTrack | BonusTrack | null,
		segment: null as Segment | null,
		zone: null as Zone | null
	};
	static mapZoneData: ZoneDef | null;
	static backupZoneData: ZoneDef | null;
	static teleDestList: string[] | null;
	static newObjectType: string | null;

	static {
		$.RegisterForUnhandledEvent('ZoneMenu_Show', this.showZoneMenu.bind(this));
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', this.hideZoneMenu.bind(this));
		$.RegisterForUnhandledEvent('OnRegionPointAdded', this.addRegionPoint.bind(this));
		$.RegisterForUnhandledEvent('OnRegionSave', this.onRegionSave.bind(this));

		$.RegisterForUnhandledEvent('LevelInitPostEntity', this.initMenu.bind(this));
	}

	static onLoad() {
		//@ts-expect-error API name not recognized
		this.mapZoneData = MomentumTimerAPI.GetActiveZoneDefs() as ZoneDef;

		if (!this.mapZoneData) {
			const tracks: MapTracks = {
				main: {
					zones: {
						segments: [this.createSegment()]
					},
					stagesEndAtStageStarts: true
				},
				bonuses: [this.createBonusTrack(), this.createBonusTrack(), this.createBonusTrack()] /*as BonusTrack[]*/
			} as MapTracks;

			this.mapZoneData = {} as ZoneDef;
			this.mapZoneData.tracks = tracks;
		}

		this.mapZoneData.tracks.bonuses[0].defragFlags = 31;
		this.mapZoneData.tracks.bonuses[1].defragFlags = 6;
		this.mapZoneData.tracks.bonuses[2].defragFlags = 11;
	}

	static initMenu() {
		if (!this.mapZoneData) {
			this.onLoad();
		}

		if (!this.mapZoneData) return;

		this.updateSelection(this.mapZoneData.tracks.main, null, null);

		this.createTrackEntry(this.panels.trackList, this.mapZoneData.tracks.main, 'Main');

		for (const [i, bonus] of this.mapZoneData.tracks.bonuses.entries()) {
			this.createTrackEntry(this.panels.trackList, bonus, `Bonus ${i + 1}`);
		}

		this.panels.regionSelect.SetPanelEvent('oninputsubmit', () => {
			ZoneMenu.updatePropertyFields(this.panels.regionSelect);
		});
	}

	static showZoneMenu() {
		// show zone menu
		if (!this.mapZoneData || this.panels.trackList.Children().length === 0) {
			this.initMenu();
		}
	}

	static hideZoneMenu() {
		// hide zone menu
		if (this.panels.trackList?.Children().length) {
			this.panels.trackList.RemoveAndDeleteChildren();
		}
	}

	static toggleCollapse(container: Panel, expandIcon: Panel, collapseIcon: Panel) {
		const shouldExpand = container.HasClass('hide');
		container.SetHasClass('hide', !shouldExpand);
		// Show the corresponding button icon
		expandIcon.SetHasClass('hide', !shouldExpand);
		collapseIcon.SetHasClass('hide', shouldExpand);
		const parent = container.GetParent();
		if (parent && parent.HasClass('zoning__tracklist-segment')) {
			parent.SetHasClass('zoning__tracklist-segment--dark', shouldExpand);
		}
	}

	static createTrackEntry(parent: Panel, entry: MainTrack | BonusTrack, name: string) {
		const trackContainer = this.addTracklistEntry(parent, name, TracklistSnippet.TRACK, {
			track: entry,
			segment: null,
			zone: null
		});
		if (trackContainer === null) return;
		if (entry.zones.segments.length === 0) {
			trackContainer.RemoveAndDeleteChildren();
			(parent.FindChildTraverse('CollapseButton') as Panel).style.visibility = 'collapse';
			return;
		}

		for (const [i, segment] of entry.zones.segments.entries()) {
			const majorId = segment.name || `Segment ${i + 1}`;
			const majorListContainer = this.addTracklistEntry(trackContainer, majorId, TracklistSnippet.SEGMENT, {
				track: entry,
				segment: segment,
				zone: null
			});
			if (majorListContainer === null) continue;
			if (segment.checkpoints.length === 0) {
				majorListContainer.RemoveAndDeleteChildren();
				(trackContainer.FindChildTraverse('CollapseButton') as Panel).style.visibility = 'collapse';
				continue;
			}

			for (const [j, zone] of segment.checkpoints.entries()) {
				const minorId = j ? `Checkpoint ${j}` : i ? 'Stage Start' : 'Start Zone';
				this.addTracklistEntry(majorListContainer, minorId, TracklistSnippet.CHECKPOINT, {
					track: entry,
					segment: segment,
					zone: zone
				});
			}
		}
	}

	static addTracklistEntry(parent: Panel, name: string, snippet: string, object): Panel | null {
		$.Msg('Making ', name);

		const newTracklistPanel = $.CreatePanel('Panel', parent, name);
		newTracklistPanel.LoadLayoutSnippet(snippet);

		const label = newTracklistPanel.FindChildTraverse('Name') as Label;
		label.text = name;

		const collapseButton = newTracklistPanel.FindChildTraverse('CollapseButton');
		const listContainer = newTracklistPanel.FindChildTraverse('ListContainer');
		if (collapseButton && listContainer) {
			const expandIcon = newTracklistPanel.FindChildTraverse('TracklistExpandIcon') as Panel;
			const collapseIcon = newTracklistPanel.FindChildTraverse('TracklistCollapseIcon') as Panel;
			collapseButton.SetPanelEvent('onactivate', () =>
				ZoneMenu.toggleCollapse(listContainer, expandIcon, collapseIcon)
			);

			this.toggleCollapse(listContainer, expandIcon, collapseIcon);
		}

		const selectButton = newTracklistPanel.FindChildTraverse('SelectButton') as Panel;
		if (selectButton && object) {
			selectButton.SetPanelEvent('onactivate', () =>
				ZoneMenu.updateSelection(object.track, object.segment, object.zone)
			);
		}

		return listContainer;
	}

	static createBonusTrack() {
		return {
			zones: {
				segments: [this.createSegment()],
				end: {} as Zone
			} as TrackZones,
			defragFlags: 0
		} as BonusTrack;
	}

	static createSegment() {
		return {
			limitStartGroundSpeed: false,
			checkpointsRequired: true,
			checkpointsOrdered: true,
			checkpoints: [this.createZone()],
			cancel: [] as Zone[],
			name: ''
		} as Segment;
	}

	static createZone(withRegion: boolean = true) {
		return {
			regions: withRegion ? [this.createRegion()] : ([] as Region[]),
			filtername: ''
		} as Zone;
	}

	static createRegion() {
		return {
			points: [] as Vec2D[],
			bottom: Number.MAX_SAFE_INTEGER,
			height: 0,
			teleDestTargetName: ''
		} as Region;
	}

	static addOptionToDropdown(optionType: string, parent: DropDown, index: number, useIndex: boolean = true) {
		const labelString = optionType + (useIndex ? ` ${index}` : '');
		const optionPanel = $.CreatePanel('Label', parent.AccessDropDownMenu(), labelString);
		optionPanel.SetAttributeInt('value', index);
		optionPanel.text = labelString;
		parent.AddOption(optionPanel);
	}

	static populateDropdown(array: any[], dropdown: DropDown, optionType: string, clearDropdown: boolean = false) {
		if (clearDropdown) dropdown.RemoveAllOptions();

		for (const [i, _] of array.entries()) {
			this.addOptionToDropdown(optionType, dropdown, i);
		}
	}

	static updateSelection(
		selectedTrack: MainTrack | BonusTrack | null,
		selectedSegment: Segment | null,
		selectedZone: Zone | null
	) {
		if (!selectedTrack) {
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'collapse';
			return;
		}
		if (selectedZone !== null) {
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'visible';
			//update zone properties
			this.populateDropdown(selectedZone.regions, this.panels.regionSelect, 'Region', true);
			this.panels.regionSelect.SetSelectedIndex(0);
			this.panels.regionSafeHeight.text = (selectedZone?.regions[0]?.safeHeight ?? 0).toFixed(2) as string;
		} else if (selectedSegment !== null) {
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'visible';
			this.panels.propertiesZone.style.visibility = 'collapse';
			//update segment properties
		} else if (selectedTrack !== null) {
			this.panels.propertiesTrack.style.visibility = 'visible';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'collapse';
			//update track properties
			this.panels.defragFlags.style.visibility = 'defragFlags' in selectedTrack ? 'visible' : 'collapse';
		}

		this.selectedZone.track = selectedTrack as MainTrack | BonusTrack;
		this.selectedZone.segment = selectedSegment as Segment;
		this.selectedZone.zone = selectedZone as Zone;

		$.Msg(this.selectedZone);
	}

	static updatePropertyFields(updatedControl: Panel) {
		// filter

		// region

		if (updatedControl === this.panels.regionSelect) {
			$.Msg(`Updated selected region (${this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1)})`);
		}
		// 	points
		// 	bottom
		// 	top
		// 	safe height
		// 	tp dest
	}

	static showPointsMenu() {
		/*const pointsMenu = UiToolkitAPI.ShowCustomLayoutContextMenu(
			'RegionPoints',
			'RegionPointsMenu',
			'tracklist-region-points'
		);*/
		$.Msg('Start editing points');
		//@ts-expect-error method doesn't exist on 'Panel'
		$.GetContextPanel().regionPointsEdit();
	}

	static addRegionPoint(point) {
		$.Msg({ point });
		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
		if (index > -1) {
			this.selectedZone.zone?.regions[index].points.push(point);
			$.Msg(this.selectedZone.zone?.regions[index].points);
		}
	}

	static onRegionSave() {
		$.Msg('Save region!');
		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
		if (index > -1) {
			const corners = this.selectedZone.zone?.regions[index].points.length ?? 0;
			if (corners < 3) {
				$.Msg('Region needs more points!');
				//@ts-expect-error method doesn't exist on 'Panel'
				$.GetContextPanel().regionPointsEdit();
				// show acknowledge/place points dialog
			} else {
				$.Msg('corners at ', this.selectedZone.zone?.regions[index].points);
			}
		}
	}

	static onTextSubmitted() {
		$.Msg('Updated track name!');
		//grab this.something.textentry.text
	}

	static addBonus() {
		if (!this.mapZoneData) return;
		const bonus = this.createBonusTrack();
		this.mapZoneData.tracks.bonuses.push(bonus);

		this.createTrackEntry(this.panels.trackList, bonus, `Bonus ${this.mapZoneData.tracks.bonuses.length}`);
	}

	static addSegment() {
		if (!this.mapZoneData || !this.selectedZone.track) return;

		if ('defragFlags' in this.selectedZone.track) {
			// warn player bonus tracks can't have segments!
			$.Msg('WARNING: Bonus track selected. Bonus tracks cannot have stages!');
			return;
		}
		const newSegment = this.createSegment();
		this.mapZoneData.tracks.main.zones.segments.push(newSegment);

		const mainTrack: Panel = this.panels.trackList.Children()[0];
		const segmentList = mainTrack.FindChildTraverse('ListContainer') as Panel;
		const id = `Segment ${this.mapZoneData.tracks.main.zones.segments.length}`;
		const list = this.addTracklistEntry(segmentList, id, TracklistSnippet.SEGMENT, {
			track: this.mapZoneData.tracks.main,
			segment: newSegment,
			zone: null
		});
		// add segment start to tracklist
	}

	static addCheckpoint() {
		if (!this.mapZoneData || !this.selectedZone || !this.selectedZone.segment || !this.selectedZone.track) return;
		const newZone = this.createZone()
		this.selectedZone.segment.checkpoints.push(newZone);

		//this.addTracklistEntry()
		let trackPanel: Panel;
		if (this.selectedZone.track === this.mapZoneData.tracks.main) {
			trackPanel = this.panels.trackList.Children()[0];
		} else {
			const bonusId = this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track as BonusTrack);
			trackPanel = this.panels.trackList.Children()[1 + bonusId];
		}
		
		const segmentIndex = this.selectedZone.track.zones.segments.indexOf(this.selectedZone.segment);
		const selectedSegment = trackPanel.FindChildTraverse('ListContainer')?.Children()[segmentIndex] as Panel;
		const checkpointsList = selectedSegment.FindChildTraverse('ListContainer') as Panel;
		const id = `Checkpoint ${this.selectedZone.segment.checkpoints.length - 1}`;
		this.addTracklistEntry(checkpointsList, id, TracklistSnippet.CHECKPOINT, newZone);
	}

	static addEndZone() {
		$.Msg('Add end zone to selected track (', this.selectedZone.track, ')');
		if (!this.mapZoneData || !this.selectedZone || !this.selectedZone.track) return;
		this.selectedZone.track.zones.end = this.createZone();
	}

	static addCancelZone() {
		$.Msg('Add cancel zone to selected segment (', this.selectedZone.segment, ')');
		if (!this.mapZoneData || !this.selectedZone || !this.selectedZone.segment) return;
		this.selectedZone.segment.cancel.push(this.createZone());
	}

	static showAddMenu() {
		UiToolkitAPI.ShowSimpleContextMenu('NewZoneButton', '', [
			{
				label: $.Localize('#Zoning_AddBonus'),
				jsCallback: () => this.addBonus()
			},
			{
				label: $.Localize('#Zoning_AddSegment'),
				jsCallback: () => this.addSegment()
			},
			{
				label: $.Localize('#Zoning_AddCheckpoint'),
				jsCallback: () => this.addCheckpoint()
			},
			{
				label: $.Localize('#Zoning_AddEnd'),
				jsCallback: () => this.addEndZone()
			},
			{
				label: $.Localize('#Zoning_AddCancel'),
				jsCallback: () => this.addCancelZone()
			}
		]);
	}

	static showDeletePopup() {
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
			$.Localize('#Zoning_Delete') as string,
			$.Localize('#Zoning_Delete_Message') as string,
			'warning-popup',
			$.Localize('#Zoning_Delete') as string,
			() => {
				this.deleteSelection();
			},
			$.Localize('#Zoning_Cancel') as string,
			() => {},
			'none'
		);
	}

	static deleteSelection() {
		if (!this.selectedZone || !this.mapZoneData) return;

		if (this.selectedZone.track && this.selectedZone.segment && this.selectedZone.zone) {
			const checkpointIndex = this.selectedZone.segment.checkpoints.indexOf(this.selectedZone.zone);
			if (checkpointIndex === -1) {
				const cancelIndex = this.selectedZone.segment.cancel.indexOf(this.selectedZone.zone);
				this.selectedZone.segment.cancel.splice(cancelIndex as number, 1);
			} else {
				this.selectedZone.segment.checkpoints.splice(checkpointIndex as number, 1);
			}

			// remove deleted zone from tracklist
		} else if (this.selectedZone.segment) {
			const index = this.mapZoneData.tracks.main.zones.segments.indexOf(this.selectedZone.segment);
			this.mapZoneData.tracks.main.zones.segments.splice(index as number, 1);
		} else if (this.selectedZone.track) {
			if ('stagesEndAtStageStarts' in this.selectedZone.track) {
				$.Msg("Can't delete Main track!!!");
			} else {
				const trackIndex = this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track);
				this.mapZoneData.tracks.bonuses.splice(trackIndex as number, 1);
			}
		}
	}

	static showDefragFlagMenu() {
		if (this.selectedZone.track === null || !('defragFlags' in this.selectedZone.track)) return;

		const flagEditMenu = UiToolkitAPI.ShowCustomLayoutContextMenu(
			this.panels.defragFlags.id,
			'',
			'file://{resources}/layout/modals/context-menus/zoning-df-flags.xml'
		) as Panel;

		const hasteFlag = flagEditMenu.FindChildTraverse('FlagHaste') as Panel;
		hasteFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['HASTE']) > 0;
		hasteFlag.SetPanelEvent('onactivate', () => ZoneMenu.updateDefragFlags('HASTE'));

		const slickFlag = flagEditMenu.FindChildTraverse('FlagSlick') as Panel;
		slickFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['SLICK']) > 0;
		slickFlag.SetPanelEvent('onactivate', () => ZoneMenu.updateDefragFlags('SLICK'));

		const damageBoostFlag = flagEditMenu.FindChildTraverse('FlagDamageBoost') as Panel;
		damageBoostFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['DAMAGEBOOST']) > 0;
		damageBoostFlag.SetPanelEvent('onactivate', () => ZoneMenu.updateDefragFlags('DAMAGEBOOST'));

		const rocketsFlag = flagEditMenu.FindChildTraverse('FlagRockets') as Panel;
		rocketsFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['ROCKETS']) > 0;
		rocketsFlag.SetPanelEvent('onactivate', () => ZoneMenu.updateDefragFlags('ROCKETS'));

		const plasmaFlag = flagEditMenu.FindChildTraverse('FlagPlasma') as Panel;
		plasmaFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['PLASMA']) > 0;
		plasmaFlag.SetPanelEvent('onactivate', () => ZoneMenu.updateDefragFlags('PLASMA'));

		const bfgFlag = flagEditMenu.FindChildTraverse('FlagBFG') as Panel;
		bfgFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['BFG']) > 0;
		bfgFlag.SetPanelEvent('onactivate', () => ZoneMenu.updateDefragFlags('BFG'));
	}

	static updateDefragFlags(flag: string) {
		if (this.selectedZone.track === null || !('defragFlags' in this.selectedZone.track)) return;
		(this.selectedZone.track.defragFlags as number) ^= DefragFlags[flag];
	}

	static saveZones() {
		//@ts-expect-error API name not recognized
		MomentumTimerAPI.SetActiveZoneDefs(this.mapZoneData);
	}

	static cancelEdit() {
		/*@ts-expect-error API name not recognized
		//this.mapZoneData = MomentumTimerAPI.GetActiveZoneDefs() as Base;*/
		for (const [_, child] of this.panels.trackList.Children().entries()) {
			child.RemoveAndDeleteChildren();
			child.DeleteAsync(0);
		}
		this.initMenu();
	}
}
