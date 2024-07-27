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

// future: get this from c++
const FORMAT_VERSION = 1;

const PickType = {
	none: '""',
	corner: 'corner',
	bottom: 'bottom',
	height: 'height',
	safeHeight: 'safe height',
	teleDestPos: 'teleDestPos',
	teleDestYaw: 'teleDestYaw'
};

class ZoneMenu {
	static panels = {
		zoningMenu: $.GetContextPanel(),
		trackList: $<Panel>('#TrackList')!,
		propertiesTrack: $<Panel>('#TrackProperties')!,
		maxVelocity: $<TextEntry>('#MaxVelocity')!,
		defragFlags: $<Panel>('#DefragFlags')!,
		stagesEndAtStageStarts: $('#StagesEndAtStageStarts')!.FindChild('CheckBox') as ToggleButton,
		propertiesSegment: $<Panel>('#SegmentProperties')!,
		limitGroundSpeed: $('#LimitGroundSpeed')!.FindChild('CheckBox') as ToggleButton,
		checkpointsRequired: $('#CheckpointsRequired')!.FindChild('CheckBox') as ToggleButton,
		checkpointsOrdered: $('#CheckpointsOrdered')!.FindChild('CheckBox') as ToggleButton,
		segmentName: $<TextEntry>('#SegmentName')!,
		propertiesZone: $<Panel>('#ZoneProperties')!,
		filterSelect: $<DropDown>('#FilterSelect')!,
		volumeSelect: $<DropDown>('#VolumeSelect')!,
		regionSelect: $<DropDown>('#RegionSelect')!,
		pointsSection: $<Panel>('#PointsSection')!,
		pointsList: $<Panel>('#PointsList')!,
		propertiesSection: $<Panel>('#PropertiesSection')!,
		teleportSection: $<Panel>('#TeleportSection')!,
		regionBottom: $<TextEntry>('#RegionBottom')!,
		regionHeight: $<TextEntry>('#RegionHeight')!,
		regionSafeHeight: $<TextEntry>('#RegionSafeHeight')!,
		regionTPDest: $<DropDown>('#RegionTPDest')!,
		regionTPPos: {
			x: $<TextEntry>('#TeleX')!,
			y: $<TextEntry>('#TeleY')!,
			z: $<TextEntry>('#TeleZ')!
		},
		regionTPPosPick: $<Button>('#TelePosPick')!,
		regionTPYaw: $<TextEntry>('#TeleYaw')!,
		regionTPYawPick: $<Button>('#TeleYawPick')!
	};

	static selectedZone = {
		track: null as MainTrack | BonusTrack | null,
		segment: null as Segment | null,
		zone: null as Zone | null
	};
	static mapZoneData: ZoneDef | null;
	static backupZoneData: ZoneDef | null;
	static filternameList: string[] | null;
	static teleDestList: string[] | null;
	static pointPick: string;

	static {
		$.RegisterForUnhandledEvent('ZoneMenu_Show', this.showZoneMenu.bind(this));
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', this.hideZoneMenu.bind(this));
		$.RegisterForUnhandledEvent('OnPointPicked', this.onPointPicked.bind(this));
		$.RegisterForUnhandledEvent('OnPickCanceled', this.onPickCanceled.bind(this));

		$.RegisterForUnhandledEvent('LevelInitPostEntity', this.initMenu.bind(this));
	}

	static onLoad() {
		//@ts-expect-error API name not recognized
		this.mapZoneData = MomentumTimerAPI.GetActiveZoneDefs() as ZoneDef;

		if (!this.mapZoneData) {
			const tracks: MapTracks = {
				main: {
					zones: {
						segments: [this.createSegment()],
						end: this.createZone()
					},
					stagesEndAtStageStarts: true
				},
				bonuses: [] as BonusTrack[]
			};

			this.mapZoneData = { formatVersion: FORMAT_VERSION, tracks: tracks } as ZoneDef;
		}
	}

	static initMenu() {
		if (!this.mapZoneData) {
			this.onLoad();
		}

		if (!this.mapZoneData) return;

		this.updateSelection(this.mapZoneData.tracks.main, null, null);

		//@ts-expect-error function name not recognized
		const entList: EntityList = this.panels.zoningMenu.getEntityList();
		this.filternameList = entList.filter ?? [];
		this.filternameList.unshift($.Localize('#Zoning_Filter_None')!);
		this.populateDropdown(this.filternameList, this.panels.filterSelect, '', true);

		this.teleDestList = entList.teleport ?? [];
		this.teleDestList.unshift($.Localize('#Zoning_TPDest_MakeNew')!);
		this.teleDestList.unshift($.Localize('#Zoning_TPDest_None')!);
		this.populateDropdown(this.teleDestList, this.panels.regionTPDest, '', true);

		this.showRegionMenu('Points');

		this.createTrackEntry(this.panels.trackList, this.mapZoneData.tracks.main, 'Main');

		if (!this.mapZoneData.tracks.bonuses || this.mapZoneData.tracks.bonuses.length === 0) return;
		const tag = $.Localize('#Zoning_Bonus')!;
		for (const [i, bonus] of this.mapZoneData.tracks.bonuses.entries()) {
			this.createTrackEntry(this.panels.trackList, bonus, `${tag} ${i + 1}`);
		}
	}

	static showZoneMenu() {
		if (!this.mapZoneData || this.panels.trackList.GetChildCount() === 0) {
			this.initMenu();
		}
	}

	static hideZoneMenu() {
		if (this.panels.trackList?.GetChildCount()) {
			this.panels.trackList.RemoveAndDeleteChildren();
		}
	}

	static toggleCollapse(container: Panel, expandIcon: Image, collapseIcon: Image) {
		const shouldExpand = container.HasClass('hide');
		container.SetHasClass('hide', !shouldExpand);
		expandIcon.SetHasClass('hide', !shouldExpand);
		collapseIcon.SetHasClass('hide', shouldExpand);
		const parent = container.GetParent();
		if (parent && parent.HasClass('zoning__tracklist-segment')) {
			parent.SetHasClass('zoning__tracklist-segment--dark', shouldExpand);
		}
	}

	static createTrackEntry(parent: Panel, entry: MainTrack | BonusTrack, name: string) {
		const trackChildContainer = this.addTracklistEntry(parent, name, TracklistSnippet.TRACK, {
			track: entry,
			segment: null,
			zone: null
		});
		if (trackChildContainer === null) return;
		if (entry.zones.segments.length === 0) {
			trackChildContainer.RemoveAndDeleteChildren();
			(parent.FindChildTraverse('CollapseButton') as Panel).visible = false;
			return;
		}

		const trackSegmentContainer = trackChildContainer.FindChildTraverse('SegmentContainer') as Panel;
		const segmentTag = $.Localize('#Zoning_Segment')!;
		const checkpointTag = $.Localize('#Zoning_Checkpoint')!;
		const cancelTag = $.Localize('#Zoning_CancelZone')!;
		const endTag = $.Localize('#Zoning_EndZone')!;
		for (const [i, segment] of entry.zones.segments.entries()) {
			const majorId = segment.name || `${segmentTag} ${i + 1}`;
			const segmentChildContainer = this.addTracklistEntry(
				trackSegmentContainer,
				majorId,
				TracklistSnippet.SEGMENT,
				{
					track: entry,
					segment: segment,
					zone: null
				}
			);
			if (segmentChildContainer === null) continue;
			if (segment.checkpoints.length === 0 && segment.cancel.length === 0) {
				(trackChildContainer.FindChildTraverse('CollapseButton') as Panel).visible = false;
				continue;
			}

			const segmentCheckpointContainer = segmentChildContainer.FindChildTraverse('CheckpointContainer') as Panel;
			for (const [j, zone] of segment.checkpoints.entries()) {
				const minorId = j
					? `${checkpointTag} ${j}`
					: i
					? $.Localize('#Zoning_Start_Stage')!
					: $.Localize('#Zoning_Start_Track')!;
				this.addTracklistEntry(segmentCheckpointContainer, minorId, TracklistSnippet.CHECKPOINT, {
					track: entry,
					segment: segment,
					zone: zone
				});
			}
			if (!segment.cancel || segment.cancel.length === 0) continue;
			for (const [j, zone] of segment.cancel.entries()) {
				const cancelId = `${cancelTag} ${j + 1}`;
				this.addTracklistEntry(segmentCheckpointContainer, cancelId, TracklistSnippet.CHECKPOINT, {
					track: entry,
					segment: segment,
					zone: zone
				});
			}
		}

		if (entry.zones.end) {
			const trackEndZoneContainer = trackChildContainer.FindChildTraverse('EndZoneContainer') as Panel;
			this.addTracklistEntry(trackEndZoneContainer, endTag, TracklistSnippet.CHECKPOINT, {
				track: entry,
				segment: null,
				zone: entry.zones.end
			});
		}
	}

	static addTracklistEntry(
		parent: Panel,
		name: string,
		snippet: string,
		selectionObj: { track: MainTrack | BonusTrack; segment: Segment | null; zone: Zone | null },
		setActive: boolean = false
	): Panel | null {
		const newTracklistPanel = $.CreatePanel('Panel', parent, name);
		newTracklistPanel.LoadLayoutSnippet(snippet);

		const label = newTracklistPanel.FindChildTraverse('Name') as Label;
		label.text = name;

		const collapseButton = newTracklistPanel.FindChildTraverse('CollapseButton');
		const childContainer = newTracklistPanel.FindChildTraverse('ChildContainer');
		if (collapseButton && childContainer) {
			const expandIcon = newTracklistPanel.FindChildTraverse('TracklistExpandIcon') as Image;
			const collapseIcon = newTracklistPanel.FindChildTraverse('TracklistCollapseIcon') as Image;
			collapseButton.SetPanelEvent('onactivate', () =>
				this.toggleCollapse(childContainer as Panel, expandIcon, collapseIcon)
			);

			this.toggleCollapse(childContainer, expandIcon, collapseIcon);
		}

		const selectButton = newTracklistPanel.FindChildTraverse('SelectButton') as RadioButton;
		selectButton.SetPanelEvent('onactivate', () =>
			this.updateSelection(selectionObj.track, selectionObj.segment, selectionObj.zone)
		);

		if (setActive) {
			selectButton.SetSelected(true);
		}

		return childContainer;
	}

	static createBonusTrack() {
		return {
			zones: {
				segments: [this.createSegment()],
				end: this.createZone()
			},
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
			bottom: 0,
			height: 0,
			teleDestTargetname: ''
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

		for (const [i, item] of array.entries()) {
			this.addOptionToDropdown(optionType || item, dropdown, i, optionType !== '');
		}
	}

	static updateSelection(
		selectedTrack: MainTrack | BonusTrack | null,
		selectedSegment: Segment | null,
		selectedZone: Zone | null
	) {
		if (!selectedTrack) {
			this.panels.propertiesTrack.visible = false;
			this.panels.propertiesSegment.visible = false;
			this.panels.propertiesZone.visible = false;
			return;
		}

		this.selectedZone.track = selectedTrack as MainTrack | BonusTrack;
		this.selectedZone.segment = selectedSegment as Segment;
		this.selectedZone.zone = selectedZone as Zone;

		const validity = this.isSelectionValid();
		this.panels.propertiesTrack.visible = !validity.zone && !validity.segment && validity.track;
		this.panels.propertiesSegment.visible = !validity.zone && validity.segment;
		this.panels.propertiesZone.visible = validity.zone;

		this.populateZoneProperties();
		this.populateSegmentProperties();
		this.populateTrackProperties();
	}

	static populateZoneProperties() {
		if (!this.mapZoneData || !this.isSelectionValid().zone) return;
		const zone = this.selectedZone.zone!;
		const filterIndex = zone.filtername ? this.filternameList?.indexOf(zone.filtername) ?? 0 : 0;
		this.panels.filterSelect.SetSelectedIndex(filterIndex);
		this.populateDropdown(zone.regions, this.panels.regionSelect, 'Region', true);
		this.panels.regionSelect.SetSelectedIndex(0);
		this.populateRegionProperties();
	}

	static populateSegmentProperties() {
		if (!this.mapZoneData || !this.isSelectionValid().segment) return;
		const segment = this.selectedZone.segment!;
		this.panels.limitGroundSpeed.SetSelected(segment.limitStartGroundSpeed);
		this.panels.checkpointsRequired.SetSelected(segment.checkpointsRequired);
		this.panels.checkpointsOrdered.SetSelected(segment.checkpointsOrdered);
		this.panels.segmentName.text = segment.name === undefined ? '' : segment.name;
	}

	static populateTrackProperties() {
		if (!this.mapZoneData || !this.isSelectionValid().track) return;
		const track = this.selectedZone.track!;
		const parentPanel = this.panels.stagesEndAtStageStarts.GetParent() as Panel;
		parentPanel.visible = 'stagesEndAtStageStarts' in track;
		this.panels.stagesEndAtStageStarts.SetSelected(Boolean(track.stagesEndAtStageStarts ?? false));
		this.panels.defragFlags.visible = 'defragFlags' in track;
		this.panels.maxVelocity.text =
			this.mapZoneData.maxVelocity === undefined ? '' : this.mapZoneData.maxVelocity.toFixed(0)!;
	}

	static updateZoneFilter() {
		if (!this.selectedZone || !this.selectedZone.zone || !this.filternameList) return;

		const filterIndex = this.panels.filterSelect.GetSelected()?.GetAttributeInt('value', 0);
		this.selectedZone.zone.filtername = filterIndex ? this.filternameList[filterIndex] : '';
	}

	static populateRegionProperties() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
		const region = this.selectedZone.zone.regions[index];

		this.panels.pointsList.RemoveAndDeleteChildren();
		if (region && region.points && region.points.length > 0) {
			for (const [i, point] of region.points.entries()) {
				this.addPointToList(i, point);
			}
		}
		this.panels.regionBottom.text = (region?.bottom ?? 0).toFixed(2);
		this.panels.regionHeight.text = (region?.height ?? 0).toFixed(2);
		this.panels.regionSafeHeight.text = (region?.safeHeight ?? 0).toFixed(2);

		const tpIndex =
			region.teleDestTargetname === '' ? 0 : (this.teleDestList?.indexOf(region.teleDestTargetname) as number);
		this.panels.regionTPDest.SetSelectedIndex(tpIndex);
	}

	static addRegion() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		this.selectedZone.zone.regions.push(this.createRegion());
		this.populateDropdown(this.selectedZone.zone.regions, this.panels.regionSelect, 'Region', true);
		this.panels.regionSelect.SetSelectedIndex(this.selectedZone.zone.regions.length - 1);
		this.populateRegionProperties();
	}

	static deleteRegion() {
		if (this.panels.regionSelect.Children().length === 1) {
			$.Msg("Can't delete last Region!!!");
			return;
		}
		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
		this.selectedZone.zone?.regions.splice(index, 1);
		this.panels.regionSelect.SetSelectedIndex(0);
		this.populateRegionProperties();
	}

	static pickCorners() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		this.pointPick = PickType.corner;
		if (GameInterfaceAPI.GetSettingBool('mom_zone_two_click')) {
			const index = this.panels.regionSelect.GetSelected().GetAttributeInt('value', -1);
			this.selectedZone.zone.regions[index].points.length = 0;
			this.panels.pointsList.RemoveAndDeleteChildren();
		}
		//@ts-expect-error function name
		this.panels.zoningMenu.startPointPick(true);
	}

	static addPointToList(i: number, point: number[]) {
		const newRegionPoint = $.CreatePanel('Panel', this.panels.pointsList, `Point ${i}`);
		newRegionPoint.LoadLayoutSnippet('region-point');
		(newRegionPoint.FindChildTraverse('PointX') as TextEntry).text = point[0].toFixed(2);
		(newRegionPoint.FindChildTraverse('PointY') as TextEntry).text = point[1].toFixed(2);
		const deleteButton = newRegionPoint.FindChildTraverse('DeleteButton') as Panel;
		deleteButton.SetPanelEvent('onactivate', () => {
			this.deleteRegionPoint(newRegionPoint);
		});
	}

	static deleteRegionPoint(point: Panel) {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const n = this.panels.pointsList.Children().indexOf(point);
		const index = this.panels.regionSelect.GetSelected().GetAttributeInt('value', -1);
		this.selectedZone.zone?.regions[index].points.splice(n, 1);
		point.DeleteAsync(0);
	}

	static pickBottom() {
		this.pointPick = PickType.bottom;
		//@ts-expect-error function name
		this.panels.zoningMenu.startPointPick(false);
	}

	static setRegionBottom() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const regionIndex = this.panels.regionSelect.GetSelected().GetAttributeInt('value', -1);
		const region = this.selectedZone.zone.regions[regionIndex];
		const bottom = Number.parseFloat(this.panels.regionBottom.text);
		region.bottom = Number.isNaN(bottom) ? 0 : bottom;
	}

	static pickHeight() {
		this.pointPick = PickType.height;
		//@ts-expect-error function name
		this.panels.zoningMenu.startPointPick(false);
	}

	static setRegionHeight() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const regionIndex = this.panels.regionSelect.GetSelected().GetAttributeInt('value', -1);
		const region = this.selectedZone.zone.regions[regionIndex];
		const height = Number.parseFloat(this.panels.regionHeight.text);
		region.height = Number.isNaN(height) ? 0 : height;
	}

	static pickSafeHeight() {
		this.pointPick = PickType.safeHeight;
		//@ts-expect-error function name
		this.panels.zoningMenu.startPointPick(false);
	}

	static setRegionSafeHeight() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const regionIndex = this.panels.regionSelect.GetSelected().GetAttributeInt('value', -1);
		const region = this.selectedZone.zone.regions[regionIndex];
		const height = Number.parseFloat(this.panels.regionSafeHeight.text);
		region.safeHeight = Number.isNaN(height) ? 0 : height;
	}

	static pickTeleDestPos() {
		this.pointPick = PickType.teleDestPos;
		//@ts-expect-error function name
		this.panels.zoningMenu.startPointPick(false);
	}

	static pickTeleDestYaw() {
		this.pointPick = PickType.teleDestYaw;
		//@ts-expect-error function name
		this.panels.zoningMenu.startPointPick(false);
	}

	static updateRegionTPDest() {
		if (!this.selectedZone || !this.selectedZone.zone || !this.teleDestList) return;

		const regionIndex = this.panels.regionSelect.GetSelected().GetAttributeInt('value', -1);
		const teleDestIndex = this.panels.regionTPDest.GetSelected()?.GetAttributeInt('value', 0);
		const region = this.selectedZone.zone.regions[regionIndex];
		if (teleDestIndex === 0) {
			// no teleport destination for this region
			region.teleDestTargetname = '';
			//@ts-expect-error property must be optional
			delete region.teleDestPos;
			//@ts-expect-error property must be optional
			delete region.teleDestYaw;

			this.panels.regionTPPos.x.text = '';
			this.panels.regionTPPos.y.text = '';
			this.panels.regionTPPos.z.text = '';
			this.panels.regionTPYaw.text = '';
			this.setRegionTPDestTextEntriesActive(false);
		} else if (teleDestIndex === 1 && region.points.length > 0) {
			if (!region.teleDestPos || !region.teleDestYaw) {
				region.teleDestPos = [] as number[];
				region.teleDestPos = [0, 0, region.bottom];
				const den = 1 / region.points.length;
				region.points.forEach(
					(val) => ((region.teleDestPos[0] += val[0] * den), (region.teleDestPos[1] += val[1] * den))
				);
				region.teleDestYaw = 0;
			}

			this.panels.regionTPPos.x.text = region.teleDestPos[0].toFixed(2);
			this.panels.regionTPPos.y.text = region.teleDestPos[1].toFixed(2);
			this.panels.regionTPPos.z.text = region.teleDestPos[2].toFixed(2);
			this.panels.regionTPYaw.text = region.teleDestYaw.toFixed(2);
			this.setRegionTPDestTextEntriesActive(true);
		} else {
			region.teleDestTargetname = this.teleDestList[teleDestIndex];

			//@ts-expect-error property must be optional
			delete region.teleDestPos;
			//@ts-expect-error property must be optional
			delete region.teleDestYaw;

			this.panels.regionTPPos.x.text = '';
			this.panels.regionTPPos.y.text = '';
			this.panels.regionTPPos.z.text = '';
			this.panels.regionTPYaw.text = '';
			this.setRegionTPDestTextEntriesActive(false);
		}
	}

	static setRegionTeleDestOrientation() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const regionIndex = this.panels.regionSelect.GetSelected().GetAttributeInt('value', -1);
		const region = this.selectedZone.zone.regions[regionIndex];
		const x = Number.parseFloat(this.panels.regionTPPos.x.text);
		const y = Number.parseFloat(this.panels.regionTPPos.y.text);
		const z = Number.parseFloat(this.panels.regionTPPos.z.text);
		const yaw = Number.parseFloat(this.panels.regionTPYaw.text);

		region.teleDestPos = [Number.isNaN(x) ? 0 : x, Number.isNaN(y) ? 0 : y, Number.isNaN(z) ? 0 : z];
		region.teleDestYaw = Number.isNaN(yaw) ? 0 : yaw;
	}

	static setRegionTPDestTextEntriesActive(enable: boolean) {
		this.panels.regionTPPos.x.enabled = enable;
		this.panels.regionTPPos.y.enabled = enable;
		this.panels.regionTPPos.z.enabled = enable;
		this.panels.regionTPPosPick.enabled = enable;
		this.panels.regionTPYaw.enabled = enable;
		this.panels.regionTPYawPick.enabled = enable;
	}

	static onPointPicked(point: { x: number; y: number; z: number }) {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const regionIndex = this.panels.regionSelect.GetSelected().GetAttributeInt('value', -1);
		const region = this.selectedZone.zone.regions[regionIndex];

		switch (this.pointPick) {
			case PickType.none:
				return;

			case PickType.corner:
				if (GameInterfaceAPI.GetSettingBool('mom_zone_two_click') && region.points.length === 1) {
					region.points.push([region.points[0][0], point.y]);
					this.addPointToList(region.points.length - 1, [region.points[0][0], point.y]);
					this.onPointPicked(point);
					this.onPointPicked({ x: point.x, y: region.points[0][1], z: point.z });
				} else {
					region.points.push([point.x, point.y]);
					this.addPointToList(region.points.length - 1, [point.x, point.y]);
				}
				break;

			case PickType.bottom:
				region.bottom = point.z;
				this.panels.regionBottom.text = point.z.toFixed(2);
				break;

			case PickType.height:
				region.height = point.z - region.bottom;
				this.panels.regionHeight.text = region.height.toFixed(2);
				break;

			case PickType.safeHeight:
				region.safeHeight = point.z - region.bottom;
				this.panels.regionSafeHeight.text = region.safeHeight.toFixed(2);
				break;

			case PickType.teleDestPos:
				region.teleDestPos = [point.x, point.y, point.z];
				this.panels.regionTPPos.x.text = point.x.toFixed(2);
				this.panels.regionTPPos.y.text = point.y.toFixed(2);
				this.panels.regionTPPos.z.text = point.z.toFixed(2);
				break;

			case PickType.teleDestYaw:
				//@ts-expect-error API name not recognized
				region.teleDestYaw = MomentumPlayerAPI.GetAngles().y;
				this.panels.regionTPYaw.text = region.teleDestYaw.toFixed(2);
				break;
		}
	}

	static onPickCanceled() {
		this.pointPick = PickType.none;
	}

	static addBonus() {
		if (!this.mapZoneData) return;
		const bonus = this.createBonusTrack();
		this.mapZoneData.tracks.bonuses.push(bonus);

		this.createTrackEntry(
			this.panels.trackList,
			bonus,
			`${$.Localize('#Zoning_Bonus')!} ${this.mapZoneData.tracks.bonuses.length}`
		);
	}

	static showAddMenu() {
		//show context menu
	}

	static showDeletePopup() {
		//show context menu
	}

	static setMaxVelocity() {
		if (!this.mapZoneData) return;
		const velocity = Number.parseFloat(this.panels.maxVelocity.text);
		this.mapZoneData.maxVelocity = !Number.isNaN(velocity) && velocity > 0 ? velocity : 0;
	}

	static setStageEndAtStageStarts() {
		if (!this.isSelectionValid().track || !('stagesEndAtStageStarts' in this.selectedZone.track!)) return;
		this.selectedZone.track.stagesEndAtStageStarts = this.panels.stagesEndAtStageStarts.checked;
	}

	static showDefragFlagMenu() {
		if (!this.isSelectionValid().track || !('defragFlags' in this.selectedZone.track!)) return;

		const flagEditMenu = UiToolkitAPI.ShowCustomLayoutContextMenu(
			this.panels.defragFlags.id,
			'',
			'file://{resources}/layout/modals/context-menus/zoning-df-flags.xml'
		) as Panel;

		const hasteFlag = flagEditMenu.FindChildTraverse('FlagHaste') as Panel;
		hasteFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['HASTE']) > 0;
		hasteFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('HASTE'));

		const slickFlag = flagEditMenu.FindChildTraverse('FlagSlick') as Panel;
		slickFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['SLICK']) > 0;
		slickFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('SLICK'));

		const damageBoostFlag = flagEditMenu.FindChildTraverse('FlagDamageBoost') as Panel;
		damageBoostFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['DAMAGEBOOST']) > 0;
		damageBoostFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('DAMAGEBOOST'));

		const rocketsFlag = flagEditMenu.FindChildTraverse('FlagRockets') as Panel;
		rocketsFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['ROCKETS']) > 0;
		rocketsFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('ROCKETS'));

		const plasmaFlag = flagEditMenu.FindChildTraverse('FlagPlasma') as Panel;
		plasmaFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['PLASMA']) > 0;
		plasmaFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('PLASMA'));

		const bfgFlag = flagEditMenu.FindChildTraverse('FlagBFG') as Panel;
		bfgFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['BFG']) > 0;
		bfgFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('BFG'));
	}

	static setDefragFlags(flag: string) {
		if (this.selectedZone.track === null || !('defragFlags' in this.selectedZone.track)) return;
		(this.selectedZone.track.defragFlags as number) ^= DefragFlags[flag];
	}

	static setLimitGroundSpeed() {
		if (!this.isSelectionValid().segment) return;
		this.selectedZone.segment!.limitStartGroundSpeed = this.panels.limitGroundSpeed.checked;
	}

	static setCheckpointsOrdered() {
		if (!this.isSelectionValid().segment) return;
		this.selectedZone.segment!.checkpointsOrdered = this.panels.checkpointsOrdered.checked;
	}

	static setCheckpointsRequired() {
		if (!this.isSelectionValid().segment) return;
		this.selectedZone.segment!.checkpointsRequired = this.panels.checkpointsRequired.checked;
	}

	static setSegmentName() {
		if (!this.isSelectionValid().segment) return;
		this.selectedZone.segment!.name = this.panels.segmentName.text;
		// feat: later
		// update segment name in trasklist tree
	}

	static showRegionMenu(menu: string) {
		this.panels.pointsSection.visible = menu === 'Points';
		this.panels.propertiesSection.visible = menu === 'Properties';
		this.panels.teleportSection.visible = menu === 'Teleport';
	}

	static saveZones() {
		if (!this.mapZoneData) return;
		this.mapZoneData.dataTimestamp = Date.now();
		//@ts-expect-error API name not recognized
		MomentumTimerAPI.SaveZoneDefs(this.mapZoneData);
		// reload zones
	}

	static cancelEdit() {
		this.panels.trackList.RemoveAndDeleteChildren();
		this.mapZoneData = null;
		this.initMenu();
	}

	static isSelectionValid() {
		const trackValidity = Boolean(this.selectedZone) && Boolean(this.selectedZone.track);
		return {
			track: trackValidity,
			segment: trackValidity && Boolean(this.selectedZone.segment),
			zone: trackValidity && Boolean(this.selectedZone.zone)
		};
	}
}
