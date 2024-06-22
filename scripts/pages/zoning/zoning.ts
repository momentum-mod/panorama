/**
 * Zoning UI logic
 */

const TracklistSnippet = {
	TRACK: 'tracklist-track',
	SEGMENT: 'tracklist-segment',
	CHECKPOINT: 'tracklist-checkpoint'
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
				bonuses: [] as BonusTrack[]
			} as MapTracks;

			this.mapZoneData = {} as ZoneDef;
			this.mapZoneData.tracks = tracks;
		}
	}

	static initMenu() {
		/*@ts-expect-error API name not recognized
		//this.mapZoneData = MomentumTimerAPI.GetActiveZoneDefs() as ZoneDef;*/

		if (!this.mapZoneData) {
			const tracks: MapTracks = {
				main: {
					zones: {
						segments: [this.createSegment()]
					},
					stagesEndAtStageStarts: true
				},
				bonuses: [] as BonusTrack[]
			} as MapTracks;

			this.mapZoneData = {} as ZoneDef;
			this.mapZoneData.tracks = tracks;
		}

		this.updateSelection(this.mapZoneData.tracks.main, null, null);

		this.createTrackEntry(this.panels.trackList, this.mapZoneData.tracks.main, 'Main');

		for (const [i, bonus] of this.mapZoneData.tracks.bonuses.entries()) {
			this.createTrackEntry(this.panels.trackList, bonus, `Bonus ${i}`);
		}

		$.Msg(this.mapZoneData);

		const mainTrack = this.mapZoneData.tracks.main;
		$.Msg(mainTrack.zones?.segments?.length + ' segments');
		$.Msg(mainTrack.zones?.segments[0]?.checkpoints?.length + ' checkpoints');
		const region = mainTrack.zones?.segments[0]?.checkpoints[0]?.regions[0];
		$.Msg(mainTrack.zones?.segments[0]?.checkpoints[0]?.regions?.length + ' regions');

		this.panels.regionSelect.SetSelectedIndex($.persistentStorage.getItem('zoning.region') ?? 0);
		this.panels.regionSelect.SetPanelEvent('oninputsubmit', () => {
			$.persistentStorage.setItem(
				'zoning.region',
				this.panels.regionSelect.GetSelected()?.GetAttributeUInt32('value', 0) ?? 0
			);
			ZoneMenu.updatePropertyFields(this.panels.regionSelect);
		});

		// Move these to context menu
		/*for (let point = 0; point < 4; ++point) {
			for (let axis = 0; axis < 2; ++axis) {
				this.panels.regionPoints[point][axis].text = region.points[point][axis].toFixed(2);
				this.panels.regionPoints[point][axis].text = region.points[point][axis].toFixed(2);
			}
		}
		this.panels.regionBottom.text = region.bottom.toFixed(2);
		this.panels.regionTop.text = (region.bottom + region.height).toFixed(2);
		this.panels.regionSafeHeight.text = (region.safeHeight || 0).toFixed(2);*/
	}

	static showZoneMenu() {
		// show zone menu
		if (!this.mapZoneData) {
			this.initMenu();
		}
	}

	static hideZoneMenu() {
		// hide zone menu
		if (this.panels.trackList?.Children().length) {
			this.panels.trackList.RemoveAndDeleteChildren();
		}

		this.mapZoneData = null;
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
			parent.FindChildTraverse('CollapseButton')?.DeleteAsync(0);
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
				trackContainer.FindChildTraverse('CollapseButton')?.DeleteAsync(0);
				continue;
			}

			for (const [j, zone] of segment.checkpoints.entries()) {
				const minorId = `Checkpoint ${j + 1}`;
				this.addTracklistEntry(majorListContainer, minorId, TracklistSnippet.CHECKPOINT, {
					track: entry,
					segment: segment,
					zone: zone
				});
			}
			$.Msg(majorId + ' created in ' + name + 'track, ' + segment.checkpoints.length + ' checkpoints.\n');
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

	static createZone(withRegion: boolean = false) {
		return {
			regions: withRegion ? [this.createRegion()] : [] as Region[],
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
		//this.selectedZone?.RemoveClass('zoning__tracklist--active');
		//newSelectedZone.AddClass('zoning__tracklist--active');

		$.Msg(selectedTrack, selectedSegment, selectedZone);

		if (!selectedTrack) {
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'collapse';
			return;
		}
		if (selectedZone !== null) {
			$.Msg(`Zone selected. Regions: ${selectedZone.regions}, Filter: ${selectedZone.filterName}`);
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'visible';
			//update zone properties
			this.panels.regionSelect.SetSelectedIndex(0);
			this.panels.regionSafeHeight.text = (selectedZone?.regions[0]?.safeHeight ?? 0).toFixed(2) as string;
			this.populateDropdown(selectedZone.regions, this.panels.regionSelect, '', true);
		} else if (selectedSegment !== null) {
			$.Msg(
				`Segment selected. limitStartGroundSpeed: ${selectedSegment.limitStartGroundSpeed}, checkpointsRequired: ${selectedSegment.checkpointsRequired}, checkpointsOrdered: ${selectedSegment.checkpointsOrdered};`
			);
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'visible';
			this.panels.propertiesZone.style.visibility = 'collapse';
			//update segment properties
		} else if (selectedTrack !== null) {
			$.Msg(`Track selected. Name: ${'stagesEndAtStageStarts' in selectedTrack ? 'Main' : 'Bonus'}`);
			this.panels.propertiesTrack.style.visibility = 'visible';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'collapse';
			//update track properties
		}

		this.selectedZone.track = selectedTrack as MainTrack | BonusTrack;
		this.selectedZone.segment = selectedSegment as Segment;
		this.selectedZone.zone = selectedZone as Zone;
	}

	static updatePropertyFields(updatedControl: Panel) {
		// filter

		// region

		if (updatedControl === this.panels.regionSelect) {
			$.Msg(
				`Updated selected region (${
					this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1) ?? -1
				})`
			);
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
	}

	static onRegionSave() {
		$.Msg('Save region!');
	}

	static onTextSubmitted() {
		$.Msg('Updated track name!');
		//grab this.something.textentry.text
	}

	static addBonus() {
		$.Msg('Add new Bonus!');
		if (!this.mapZoneData)
			return;
		this.mapZoneData.tracks.bonuses.push(this.createBonusTrack());
	}

	static addSegment() {
		$.Msg('Add new stage!');
		if (!this.mapZoneData)
			return;
		this.mapZoneData.tracks.main.zones.segments.push(this.createSegment());
	}

	static addCheckpoint() {
		$.Msg('Add checkpoint to selected zone (' + this.selectedZone.segment + ')');
		if (!this.mapZoneData || !this.selectedZone || !this.selectedZone.segment)
			return;
		this.selectedZone.segment.checkpoints.push(this.createZone());
	}

	static addEndZone() {
		$.Msg('Add end zone to selected track (' + this.selectedZone.track + ')');
		if (!this.mapZoneData || !this.selectedZone || !this.selectedZone.track)
			return;
		this.selectedZone.track.zones.end = this.createZone();
	}

	static addCancelZone() {
		$.Msg('Add cancel zone to selected segment (' + this.selectedZone.segment + ')');
		if (!this.mapZoneData || !this.selectedZone || !this.selectedZone.segment)
			return;
		this.selectedZone.segment.cancel.push(this.createZone());
	}

	static createNewZone() {
		$.Msg('Add new zone!');

		/*// create new volume and add to MapZones opbjet
		// Note: this should use point picker (c++)
		const x1: number = Math.random(); // fix random
		const x2: number = Math.random(); // fix random
		const y1: number = Math.random(); // fix random
		const y2: number = Math.random(); // fix random
		const b = 0;
		const h = 960;
		const newRegion: Region = {
			points: [
				{ x: x1, y: y1 },
				{ x: x1, y: y2 },
				{ x: x2, y: y2 },
				{ x: x2, y: y1 }
			],
			bottom: b,
			height: h,
			teleDestPos: { x: 0.5 * (x1 + x2), y: 0.5 * (y1 + y2), z: b }, // TODO: This below are required if region is part of a volume used by stafe or major checkpoint zone
			teleDestYaw: 0, // See convo in mom red 25/09/23 02:00 GMT
			teleDestTargetName: '',
			safeHeight: 0
		};

		const lastSegmentIndex = (this.mapZoneData?.tracks.main.zones.segments.length as number) - 1;
		const lastSegment = this.mapZoneData?.tracks.main.zones.segments[lastSegmentIndex] as Segment;
		lastSegment.checkpoints.push({ regions: [newRegion] } as Zone);

		// add to tracklist tree
		const mainTrack: Panel = this.panels.trackList.Children()[0];
		const segmentList = mainTrack.FindChildTraverse('ListContainer');
		const segmentPanel: Panel = segmentList?.Children()[lastSegmentIndex] as Panel;
		const checkpointList: Panel = segmentPanel.FindChildTraverse('ListContainer') as Panel;
		const id = `Checkpoint ${lastSegment.checkpoints.length}`;
		this.addTracklistEntry(checkpointList, id, TracklistSnippet.CHECKPOINT, { regions: [newRegion] } as Zone);*/
	}

	static showNewPopup() {
		UiToolkitAPI.ShowCustomLayoutPopup('NewZonePopup', 'file://{resources}/layout/popups/zoning-new.xml');
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

	static setNewObjectType(newType: string) {
		this.newObjectType = newType;
	}

	static addObjectToMapZones() {
		if (!this.newObjectType) return;

		const parent: Panel = $.CreatePanel('Panel', $.GetContextPanel(), '');

		switch (this.newObjectType) {
			case 'Bonus': {
				this.addBonus();
				//add to tracklist tree
				break;
			}
			case 'Segment': {
				this.addSegment();
				//add to tracklist tree
				break;
			}
			case 'Checkpoint': {
				this.addCheckpoint();
				//add to tracklist tree
				break;
			}
			case 'End': {
				this.addEndZone();
				//add to tracklist tree
				break;
			}
			case 'Cancel': {
				this.addCancelZone();
				//add to tracklist tree
				break;
			}
		}

		//tech debt?
		const track = this.selectedZone.track;
		const segment = this.selectedZone.segment;
		const zone = this.selectedZone.zone;

		this.initMenu();

		this.updateSelection(track, segment, zone);
	}

	static deleteSelection() {
		// delete checkpoint from MapZones object
		const lastSegmentIndex = (this.mapZoneData?.tracks.main.zones.segments.length as number) - 1;
		const lastSegment = this.mapZoneData?.tracks.main.zones.segments[lastSegmentIndex] as Segment;
		lastSegment.checkpoints.pop();

		// delete checkpoint from tracklist tree
		const mainTrack: Panel = this.panels.trackList.Children()[0];
		const segmentList = mainTrack.FindChildTraverse('ListContainer');
		const segmentPanel: Panel = segmentList?.Children()[lastSegmentIndex] as Panel;
		const checkpointList: Panel = segmentPanel.FindChildTraverse('ListContainer') as Panel;
		checkpointList.Children()[lastSegment.checkpoints.length]?.DeleteAsync(0);

		if (!this.selectedZone || !this.mapZoneData) return;

		if (this.selectedZone.zone) {
			$.Msg(
				`Zone deleted. Regions: ${this.selectedZone.zone.regions as Region[]}, Filter: ${
					this.selectedZone.zone.filterName
				}`
			);
			const index = this.mapZoneData.tracks.main.zones.segments[0].checkpoints.indexOf(this.selectedZone.zone);
			this.mapZoneData.tracks.bonuses.splice(index as number, 1);
		} else if (this.selectedZone.segment) {
			$.Msg(
				`Segment deleted. limitStartGroundSpeed: ${this.selectedZone.segment.limitStartGroundSpeed}, checkpointsRequired: ${this.selectedZone.segment.checkpointsRequired}, checkpointsOrdered: ${this.selectedZone.segment.checkpointsOrdered};`
			);
			const index = this.mapZoneData.tracks.main.zones.segments.indexOf(this.selectedZone.segment);
			this.mapZoneData.tracks.main.zones.segments.splice(index as number, 1);
		} else if (this.selectedZone.track) {
			$.Msg(`Track deleted. Movement params: ${this.selectedZone.track.movementParams}`);
			if ('stagesEndAtStageStarts' in this.selectedZone.track) {
				$.Msg("Can't delete Main track!!!");
			} else {
				const index = this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track);
				this.mapZoneData.tracks.bonuses.splice(index as number, 1);
			}
		}
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
