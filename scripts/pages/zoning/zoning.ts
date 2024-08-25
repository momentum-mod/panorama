/***************************************************************************************** */

interface Region extends JsonObject {
	points: number[][];
	bottom: number;
	height: number;
	teleDestTargetname: string; // mutually exclusive to other two teleport fields
	teleDestPos: number[]; // TODO: This below are required if region is part of a volume used by stafe or major checkpoint zone
	teleDestYaw: number; // See convo in mom red 25/09/23 02:00 GMT
	safeHeight: number;
}

interface Zone extends JsonObject {
	regions: Region[];
	filtername: string;
}

interface Segment extends JsonObject {
	limitStartGroundSpeed: boolean;
	checkpointsRequired: boolean;
	checkpointsOrdered: boolean;
	checkpoints: Zone[];
	cancel: Zone[];
	name: string;
}

interface TrackZones extends JsonObject {
	segments: Segment[];
	end: Zone;
}

interface MainTrack extends JsonObject {
	zones: TrackZones;
	stagesEndAtStageStarts: boolean;
}

interface BonusTrack extends JsonObject {
	zones: TrackZones;
	defragModifiers: number;
}

interface MapTracks extends JsonObject {
	main: MainTrack;
	bonuses: BonusTrack[];
}

interface ZoneDef extends JsonObject {
	formatVersion: number;
	dataTimestamp: number;
	maxVelocity: number;
	tracks: MapTracks;
}

interface EntityList {
	filter: string[];
	teleport: string[];
}
/**************************************************************************************************************/

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
		defragModifiers: $<Panel>('#DefragFlags')!,
		stagesEndAtStageStarts: $('#StagesEndAtStageStarts')!.FindChild('CheckBox') as ToggleButton,
		propertiesSegment: $<Panel>('#SegmentProperties')!,
		limitGroundSpeed: $('#LimitGroundSpeed')!.FindChild('CheckBox') as ToggleButton,
		checkpointsRequired: $('#CheckpointsRequired')!.FindChild('CheckBox') as ToggleButton,
		checkpointsOrdered: $('#CheckpointsOrdered')!.FindChild('CheckBox') as ToggleButton,
		segmentName: $<TextEntry>('#SegmentName')!,
		propertiesZone: $<Panel>('#ZoneProperties')!,
		propertyTabs: $<Panel>('#PropertyTabs')!,
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

		this.showRegionMenu('reset');

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
		if (entry.zones === undefined) {
			trackChildContainer.RemoveAndDeleteChildren();
			trackChildContainer.GetParent()!.FindChildTraverse('CollapseButton')!.visible = false;
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
			defragModifiers: 0
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
			points: [] as number[][],
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
		this.showRegionMenu('');
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
		this.panels.defragModifiers.visible = this.selectedZone.track !== this.mapZoneData.tracks.main;
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
		if (this.panels.regionSelect.GetChildCount() === 1) {
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
		if (!this.mapZoneData.tracks.bonuses) {
			this.mapZoneData.tracks.bonuses = [bonus];
		} else {
			this.mapZoneData.tracks.bonuses.push(bonus);
		}

		this.createTrackEntry(
			this.panels.trackList,
			bonus,
			`${$.Localize('#Zoning_Bonus')!} ${this.mapZoneData.tracks.bonuses.length}`
		);
	}

	static addSegment() {
		if (!this.mapZoneData || !this.isSelectionValid().track) return;
		if (this.isSelectionValid().defragBonus) {
			$.Msg('Defrag Bonus must share zones with Main track!');
			return;
		}
		if (this.selectedZone.track !== this.mapZoneData.tracks.main) {
			// warn player bonus tracks can't have segments!
			$.Msg('WARNING: Bonus track selected. Bonus tracks cannot have stages!');
			return;
		}
		const newSegment = this.createSegment();
		this.mapZoneData.tracks.main.zones.segments.push(newSegment);

		const mainTrack: Panel = this.panels.trackList.GetChild(0)!;
		const segmentList: Panel = mainTrack.FindChildTraverse('SegmentContainer')!;
		const id = `${$.Localize('#Zoning_Segment')!} ${this.mapZoneData.tracks.main.zones.segments.length}`;
		const list = this.addTracklistEntry(segmentList, id, TracklistSnippet.SEGMENT, {
			track: this.mapZoneData.tracks.main,
			segment: newSegment,
			zone: null
		});
		this.addTracklistEntry(list as Panel, $.Localize('#Zoning_Start_Stage')!, TracklistSnippet.CHECKPOINT, {
			track: this.selectedZone.track!,
			segment: newSegment,
			zone: newSegment.checkpoints[0]
		});
	}

	static addCheckpoint() {
		if (!this.mapZoneData || !this.isSelectionValid().segment) return;
		if (this.isSelectionValid().defragBonus) {
			$.Msg('Defrag Bonus must share zones with Main track!');
			return;
		}
		const newZone = this.createZone();
		this.selectedZone.segment!.checkpoints.push(newZone);

		let trackPanel: Panel;
		if (this.selectedZone.track === this.mapZoneData.tracks.main) {
			trackPanel = this.panels.trackList.GetChild(0)!;
		} else {
			const bonusId = this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track as BonusTrack);
			trackPanel = this.panels.trackList.GetChild(1 + bonusId)!;
		}

		const segmentIndex = this.selectedZone.track!.zones.segments.indexOf(this.selectedZone.segment!);
		const selectedSegment: Panel = trackPanel.FindChildTraverse('SegmentContainer')!.GetChild(segmentIndex)!;
		const checkpointsList: Panel = selectedSegment.FindChildTraverse('CheckpointContainer')!;
		const id = `${$.Localize('#Zoning_Checkpoint')!} ${this.selectedZone.segment!.checkpoints.length - 1}`;
		this.addTracklistEntry(checkpointsList, id, TracklistSnippet.CHECKPOINT, {
			track: this.selectedZone.track!,
			segment: this.selectedZone.segment,
			zone: newZone
		});
	}

	static addEndZone() {
		if (!this.mapZoneData || !this.isSelectionValid().track) return;
		if (this.isSelectionValid().defragBonus) {
			$.Msg('Defrag Bonus must share zones with Main track!');
			return;
		}
		const endZone = this.createZone();
		this.selectedZone.track!.zones.end = endZone;

		let trackPanel: Panel;
		if (this.selectedZone.track === this.mapZoneData.tracks.main) {
			trackPanel = this.panels.trackList.GetChild(0)!;
		} else {
			const bonusId = this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track as BonusTrack);
			trackPanel = this.panels.trackList.GetChild(1 + bonusId)!;
		}
		const endZoneContainer: Panel = trackPanel.FindChildTraverse('EndZoneContainer')!;
		const oldEnd: Panel | null = endZoneContainer.GetChild(0);
		if (oldEnd) {
			const selectButton = oldEnd.FindChildTraverse('SelectButton')!;
			selectButton.SetPanelEvent('onactivate', () =>
				this.updateSelection(this.selectedZone.track, null, endZone)
			);
		} else {
			this.addTracklistEntry(endZoneContainer, $.Localize('#Zoning_EndZone')!, TracklistSnippet.CHECKPOINT, {
				track: this.selectedZone.track!,
				segment: null,
				zone: endZone
			});
		}
	}

	static addCancelZone() {
		if (!this.mapZoneData || !this.isSelectionValid().segment) return;
		if (this.isSelectionValid().defragBonus) {
			$.Msg('Defrag Bonus must share zones with Main track!');
			return;
		}
		const newZone = this.createZone();
		if (!this.selectedZone.segment!.cancel) {
			this.selectedZone.segment!.cancel = [newZone];
		} else {
			this.selectedZone.segment!.cancel.push(newZone);
		}

		let trackPanel: Panel;
		if (this.selectedZone.track === this.mapZoneData.tracks.main) {
			trackPanel = this.panels.trackList.GetChild(0)!;
		} else {
			const bonusId = this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track as BonusTrack);
			trackPanel = this.panels.trackList.GetChild(1 + bonusId)!;
		}

		const segmentIndex = this.selectedZone.track!.zones.segments.indexOf(this.selectedZone.segment!);
		const selectedSegment: Panel = trackPanel.FindChildTraverse('SegmentContainer')!.GetChild(segmentIndex)!;
		const cancelList: Panel = selectedSegment.FindChildTraverse('CancelContainer')!;
		const id = `${$.Localize('#Zoning_CancelZone')!} ${this.selectedZone.segment!.cancel.length}`;
		this.addTracklistEntry(cancelList, id, TracklistSnippet.CHECKPOINT, {
			track: this.selectedZone.track!,
			segment: this.selectedZone.segment,
			zone: newZone
		});
	}

	static showAddMenu() {
		UiToolkitAPI.ShowSimpleContextMenu('NewZoneButton', '', [
			{
				label: $.Localize('#Zoning_Bonus')!,
				jsCallback: () => this.addBonus()
			},
			{
				label: $.Localize('#Zoning_Segment')!,
				jsCallback: () => this.addSegment()
			},
			{
				label: $.Localize('#Zoning_Checkpoint')!,
				jsCallback: () => this.addCheckpoint()
			},
			{
				label: $.Localize('#Zoning_EndZone')!,
				jsCallback: () => this.addEndZone()
			},
			{
				label: $.Localize('#Zoning_CancelZone')!,
				jsCallback: () => this.addCancelZone()
			}
		]);
	}

	static showDeletePopup() {
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
			$.Localize('#Zoning_Delete')!,
			$.Localize('#Zoning_Delete_Message')!,
			'warning-popup',
			$.Localize('#Zoning_Delete')!,
			() => {
				this.deleteSelection();
			},
			$.Localize('#Zoning_Cancel')!,
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
				this.selectedZone.segment.cancel.splice(cancelIndex, 1);
			} else {
				this.selectedZone.segment.checkpoints.splice(checkpointIndex, 1);
			}
		} else if (this.selectedZone.track && this.selectedZone.segment) {
			if (this.selectedZone.track.zones.segments.length === 1) {
				$.Msg('Track must have at least one segment!');
			} else {
				const index = this.mapZoneData.tracks.main.zones.segments.indexOf(this.selectedZone.segment);
				this.mapZoneData.tracks.main.zones.segments.splice(index, 1);
			}
		} else if (this.selectedZone.track) {
			if ('stagesEndAtStageStarts' in this.selectedZone.track) {
				$.Msg("Can't delete Main track!!!");
			} else {
				const trackIndex = this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track);
				this.mapZoneData.tracks.bonuses.splice(trackIndex, 1);
			}
		}

		//hack: this can be a little more surgical
		this.panels.trackList.RemoveAndDeleteChildren();
		this.initMenu();
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
		if (!this.isSelectionValid().track || !('defragModifiers' in this.selectedZone.track!)) return;

		const flagEditMenu = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent(
			this.panels.defragModifiers.id,
			'',
			'file://{resources}/layout/modals/context-menus/zoning-df-flags.xml',
			'',
			() => {
				this.onDefragFlagMenuClosed();
			}
		) as Panel;

		const hasteFlag = flagEditMenu.FindChildTraverse('FlagHaste') as Panel;
		hasteFlag.checked = ((this.selectedZone.track.defragModifiers as number) & DefragFlags['HASTE']) > 0;
		hasteFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('HASTE'));

		const slickFlag = flagEditMenu.FindChildTraverse('FlagSlick') as Panel;
		slickFlag.checked = ((this.selectedZone.track.defragModifiers as number) & DefragFlags['SLICK']) > 0;
		slickFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('SLICK'));

		const damageBoostFlag = flagEditMenu.FindChildTraverse('FlagDamageBoost') as Panel;
		damageBoostFlag.checked =
			((this.selectedZone.track.defragModifiers as number) & DefragFlags['DAMAGEBOOST']) > 0;
		damageBoostFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('DAMAGEBOOST'));

		const rocketsFlag = flagEditMenu.FindChildTraverse('FlagRockets') as Panel;
		rocketsFlag.checked = ((this.selectedZone.track.defragModifiers as number) & DefragFlags['ROCKETS']) > 0;
		rocketsFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('ROCKETS'));

		const plasmaFlag = flagEditMenu.FindChildTraverse('FlagPlasma') as Panel;
		plasmaFlag.checked = ((this.selectedZone.track.defragModifiers as number) & DefragFlags['PLASMA']) > 0;
		plasmaFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('PLASMA'));

		const bfgFlag = flagEditMenu.FindChildTraverse('FlagBFG') as Panel;
		bfgFlag.checked = ((this.selectedZone.track.defragModifiers as number) & DefragFlags['BFG']) > 0;
		bfgFlag.SetPanelEvent('onactivate', () => this.setDefragFlags('BFG'));
	}

	static setDefragFlags(flag: string) {
		// don't use defragBonus validity check because we could be setting the flags for the first time
		if (!this.isSelectionValid().track || !('defragModifiers' in this.selectedZone.track!)) return;
		(this.selectedZone.track.defragModifiers as number) ^= DefragFlags[flag];
	}

	static onDefragFlagMenuClosed() {
		if (!this.isSelectionValid().defragBonus) return;
		//@ts-expect-error property must be optional
		delete this.selectedZone.track.zones;
		const bonusIndex = this.mapZoneData!.tracks.bonuses.indexOf(this.selectedZone.track as BonusTrack);
		const trackPanel = this.panels.trackList.GetChild(1 + bonusIndex)!;
		trackPanel.FindChildTraverse('CollapseButton')!.visible = false;
		trackPanel.FindChildTraverse('ChildContainer')!.RemoveAndDeleteChildren();
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
		const pointsTab = this.panels.propertyTabs.GetChild(0) as RadioButton;
		if (menu === 'reset') {
			pointsTab.SetSelected(true);
		}
		menu = menu || pointsTab.GetSelectedButton().GetAttributeString('value', 'Points');

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
			defragBonus:
				trackValidity &&
				(this.selectedZone.track!.zones === undefined ||
					('defragModifiers' in this.selectedZone.track! &&
						Boolean(this.selectedZone.track.defragModifiers))),
			segment: trackValidity && Boolean(this.selectedZone.segment),
			zone: trackValidity && Boolean(this.selectedZone.zone)
		};
	}
}
