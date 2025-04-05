import { BonusTrack, MainTrack, MapZones, Region, Segment, Zone } from 'common/web';
import { PanelHandler } from 'util/module-helpers';

// future: get this from c++
const FORMAT_VERSION = 1;
const DEFAULT_HEIGHT = 256;
const COORD_MAX = 65536;

export interface EntityList {
	filter: string[];
	teleport: string[];
}

enum TracklistSnippet {
	TRACK = 'tracklist-track',
	SEGMENT = 'tracklist-segment',
	CHECKPOINT = 'tracklist-checkpoint'
}

enum DefragFlags {
	HASTE = 1 << 0,
	SLICK = 1 << 1,
	DAMAGEBOOST = 1 << 2,
	ROCKETS = 1 << 3,
	PLASMA = 1 << 4,
	BFG = 1 << 5
}

export enum PickType {
	NONE = 0,
	CORNER = 1,
	BOTTOM = 2,
	HEIGHT = 3,
	SAFE_HEIGHT = 4,
	TELE_DEST_POS = 5,
	TELE_DEST_YAW = 6
}

export enum RegionRenderMode {
	NONE = 0,
	START = 1,
	START_WITH_SAFE_HEIGHT = 2,
	TRACK_SWITCH = 3,
	END = 4,
	MAJOR_CHECKPOINT = 5,
	MINOR_CHECKPOINT = 6,
	CANCEL = 7
}

export enum RegionPolygonProblem {
	INVALID_INPUT = -1,
	NONE = 0,
	POINTS_TOO_CLOSE = 1,
	ANGLE_TOO_SMALL = 2,
	COLINEAR_POINTS = 3,
	SELF_INTERSECTING = 4
}

@PanelHandler()
class ZoneMenuHandler {
	readonly panels = {
		zoningMenu: $.GetContextPanel<ZoneMenu>(),
		trackList: $<Panel>('#TrackList'),
		propertiesPanel: $<Panel>('#PropertiesContainer'),
		propertiesTrack: $<Panel>('#TrackProperties'),
		maxVelocity: $<TextEntry>('#MaxVelocity'),
		defragModifiers: $<Panel>('#DefragFlags'),
		stagesEndAtStageStarts: $('#StagesEndAtStageStarts').FindChild<ToggleButton>('CheckBox'),
		propertiesSegment: $<Panel>('#SegmentProperties'),
		limitGroundSpeed: $('#LimitGroundSpeed').FindChild<ToggleButton>('CheckBox'),
		checkpointsRequired: $('#CheckpointsRequired').FindChild<ToggleButton>('CheckBox'),
		checkpointsOrdered: $('#CheckpointsOrdered').FindChild<ToggleButton>('CheckBox'),
		segmentName: $<TextEntry>('#SegmentName'),
		propertiesZone: $<Panel>('#ZoneProperties'),
		infoPanel: $<Panel>('#InfoPanel'),
		selectionMode: $<Label>('#SelectionMode'),
		filterSelect: $<DropDown>('#FilterSelect'),
		volumeSelect: $<DropDown>('#VolumeSelect'),
		regionSelect: $<DropDown>('#RegionSelect'),
		regionBottom: $<TextEntry>('#RegionBottom'),
		regionHeight: $<TextEntry>('#RegionHeight'),
		regionSafeHeight: $<TextEntry>('#RegionSafeHeight'),
		regionTPDest: $<DropDown>('#RegionTPDest'),
		regionTPPos: {
			x: $<TextEntry>('#TeleX'),
			y: $<TextEntry>('#TeleY'),
			z: $<TextEntry>('#TeleZ')
		},
		regionTPPosButton: $<Button>('#SetTeleDestPosButton'),
		regionTPYaw: $<TextEntry>('#TeleYaw'),
		regionTPYawButton: $<Button>('#SetTeleDestYawButton')
	};

	zoningLimits: ZoneEditorLimits;
	selectedZone = {
		track: null as MainTrack | BonusTrack | null,
		segment: null as Segment | null,
		zone: null as Zone | null,
		region: null as Region | null
	};
	activeDeleteButton: Button | null;
	mapZoneData: MapZones | null;
	filternameList: string[] | null;
	teleDestList: string[] | null;

	constructor() {
		$.RegisterForUnhandledEvent('ZoneMenu_Show', () => this.showZoneMenu());
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', () => this.hideZoneMenu());
		$.RegisterForUnhandledEvent('OnRegionEditCompleted', (region) => this.onRegionEditCompleted(region));
		$.RegisterForUnhandledEvent('OnRegionEditCanceled', () => this.onRegionEditCanceled());

		$.RegisterForUnhandledEvent('LevelInitPostEntity', this.onLoad.bind(this));
	}

	onLoad() {
		if (this.panels.trackList?.GetChildCount()) {
			this.panels.trackList.RemoveAndDeleteChildren();
		}

		this.getZoneData();

		//prompt to copy official zones to local

		this.initMenu();
	}

	getZoneData() {
		this.mapZoneData = MomentumTimerAPI.GetActiveZoneDefs() ?? {
			tracks: {
				main: {
					zones: {
						segments: [this.createSegment(false)],
						end: null
					},
					stagesEndAtStageStarts: true
				},
				bonuses: []
			},
			formatVersion: FORMAT_VERSION,
			dataTimestamp: -1 // Filled out before zone is saved
		};
	}

	initMenu() {
		if (!this.mapZoneData) {
			this.getZoneData();
		}

		if (!this.mapZoneData) return;

		const entList: EntityList = this.panels.zoningMenu.getEntityList();
		this.filternameList = entList.filter ?? [];
		this.filternameList.unshift($.Localize('#Zoning_Filter_None'));
		this.populateDropdown(this.filternameList, this.panels.filterSelect, '', true);

		this.teleDestList = entList.teleport ?? [];
		this.teleDestList.unshift($.Localize('#Zoning_TPDest_MakeNew'));
		this.teleDestList.unshift($.Localize('#Zoning_TPDest_None'));
		this.populateDropdown(this.teleDestList, this.panels.regionTPDest, '', true);

		this.zoningLimits = this.panels.zoningMenu.getZoningLimits();

		this.createTrackEntry(this.panels.trackList, this.mapZoneData.tracks.main, $.Localize('#Zoning_Main'));

		// if the first segment has no start zone, show text to create start zone until a start zone has been made
		if (
			this.mapZoneData.tracks.main.zones?.segments?.length > 0 &&
			this.mapZoneData.tracks.main.zones.segments[0]?.checkpoints?.length === 0
		) {
			const checkpointButton = this.panels.trackList
				.GetChild(0)
				?.FindChildTraverse<Button>('AddCheckpointButton');
			const checkpointLabel = checkpointButton?.GetChild<Label>(0);
			const startLabel = $.CreatePanel('Label', checkpointButton, '', {
				class: 'zoning__tracklist-label zoning__tracklist-label--add'
			});

			checkpointLabel.SetHasClass('hide', true);
			startLabel.text = $.Localize('#Zoning_CreateStart');

			const checkpointList = this.panels.trackList.GetChild(0).FindChildTraverse<Panel>('CheckpointContainer');
			checkpointButton.SetPanelEvent('onactivate', () => {
				checkpointLabel.SetHasClass('hide', false);
				startLabel.SetHasClass('hide', true);
				this.addCheckpoint(
					this.mapZoneData.tracks.main,
					this.mapZoneData.tracks.main.zones.segments[0],
					checkpointList
				);

				checkpointList.GetChild(0).FindChildTraverse<Label>('Name').text = $.Localize('#Zoning_Start_Track');

				checkpointButton.SetPanelEvent('onactivate', () =>
					this.addCheckpoint(
						this.mapZoneData.tracks.main,
						this.mapZoneData.tracks.main.zones.segments[0],
						checkpointList
					)
				);
			});
		}

		const bonusTag = $.Localize('#Zoning_Bonus');
		for (const [i, bonus] of this.mapZoneData.tracks.bonuses?.entries() ?? []) {
			this.createTrackEntry(this.panels.trackList, bonus, `${bonusTag} ${i + 1}`);
		}

		const lastTrack = this.panels.trackList.GetChild(this.mapZoneData.tracks.bonuses?.length ?? 0);
		const addBonusButton = lastTrack.FindChildTraverse<Panel>('AddBonusButton');
		addBonusButton.SetHasClass('hide', false);

		const mainTrackButton = this.panels.trackList.GetChild(0).FindChildTraverse<ToggleButton>('SelectButton');
		mainTrackButton.SetSelected(true);

		this.updateSelection(this.mapZoneData.tracks.main, null, null, null);
	}

	showZoneMenu() {
		if (!this.mapZoneData || this.panels.trackList.GetChildCount() === 0) {
			this.initMenu();
		}

		this.drawZones();
	}

	hideZoneMenu() {
		if (this.panels.trackList?.GetChildCount()) {
			this.panels.trackList.RemoveAndDeleteChildren();
		}
		this.activeDeleteButton = null;

		MomentumTimerAPI.SetActiveZoneDefs(this.mapZoneData);
	}

	toggleCollapse(container: GenericPanel, expandIcon: Image, collapseIcon: Image) {
		const shouldExpand = container.HasClass('hide');
		container.SetHasClass('hide', !shouldExpand);
		expandIcon.SetHasClass('hide', !shouldExpand);
		collapseIcon.SetHasClass('hide', shouldExpand);
	}

	createTrackEntry(parent: GenericPanel, track: MainTrack | BonusTrack, name: string) {
		const trackChildContainer = this.addTracklistEntry(parent, name, TracklistSnippet.TRACK, {
			track: track,
			segment: null,
			zone: null
		});
		if (trackChildContainer === null) return;
		if (track.zones === undefined) {
			trackChildContainer.RemoveAndDeleteChildren();
			trackChildContainer.GetParent().FindChildTraverse('CollapseButton').visible = false;
			return;
		}

		const trackSegmentContainer = trackChildContainer.FindChildTraverse<Panel>('SegmentContainer');
		const segmentTag = $.Localize('#Zoning_Segment');
		const checkpointTag = $.Localize('#Zoning_Checkpoint');
		const cancelTag = $.Localize('#Zoning_CancelZone');
		const endTag = $.Localize('#Zoning_EndZone');
		for (const [i, segment] of track.zones.segments?.entries() ?? []) {
			const majorId = segment.name || `${segmentTag} ${i + 1}`;
			const segmentChildContainer = this.addTracklistEntry(
				trackSegmentContainer,
				majorId,
				TracklistSnippet.SEGMENT,
				{
					track: track,
					segment: segment,
					zone: null
				}
			);

			if (segmentChildContainer === null) continue;
			if (segment.checkpoints?.length === 0 && segment.cancel?.length === 0) {
				trackChildContainer.FindChildTraverse<Panel>('CollapseButton').visible = false;
				continue;
			}

			const segmentCheckpointContainer = segmentChildContainer.FindChildTraverse<Panel>('CheckpointContainer');
			for (const [j, zone] of segment.checkpoints?.entries() ?? []) {
				const minorId = j
					? `${checkpointTag} ${j}`
					: i > 0
						? $.Localize('#Zoning_Start_Stage')
						: $.Localize('#Zoning_Start_Track');
				this.addTracklistEntry(segmentCheckpointContainer, minorId, TracklistSnippet.CHECKPOINT, {
					track: track,
					segment: segment,
					zone: zone
				});
			}

			const segmentCancelContainer = segmentChildContainer.FindChildTraverse<Panel>('CancelContainer');
			for (const [j, zone] of segment.cancel?.entries() ?? []) {
				const cancelId = `${cancelTag} ${j + 1}`;
				this.addTracklistEntry(segmentCancelContainer, cancelId, TracklistSnippet.CHECKPOINT, {
					track: track,
					segment: segment,
					zone: zone
				});
			}
		}

		if (track.zones.end) {
			const trackEndZoneContainer = trackChildContainer.FindChildTraverse<Panel>('EndZoneContainer');
			this.addTracklistEntry(trackEndZoneContainer, endTag, TracklistSnippet.CHECKPOINT, {
				track: track,
				segment: null,
				zone: track.zones.end
			});
		}
	}

	addTracklistEntry(
		parent: GenericPanel,
		name: string,
		snippet: string,
		selectionObj: { track: MainTrack | BonusTrack; segment: Segment | null; zone: Zone | null },
		setActive: boolean = false
	): GenericPanel | null {
		const newTracklistPanel = $.CreatePanel('Panel', parent, name);
		newTracklistPanel.LoadLayoutSnippet(snippet);

		const label = newTracklistPanel.FindChildTraverse<Label>('Name');
		label.text = name;

		const collapseButton = newTracklistPanel.FindChildTraverse('CollapseButton');
		const childContainer = newTracklistPanel.FindChildTraverse('ChildContainer');
		const expandIcon = newTracklistPanel.FindChildTraverse<Image>('TracklistExpandIcon');
		const collapseIcon = newTracklistPanel.FindChildTraverse<Image>('TracklistCollapseIcon');
		if (collapseButton && childContainer) {
			collapseButton.SetPanelEvent('onactivate', () =>
				this.toggleCollapse(childContainer, expandIcon, collapseIcon)
			);
		}

		const selectButton = newTracklistPanel.FindChildTraverse<ToggleButton>('SelectButton');
		const deleteButton = newTracklistPanel.FindChildTraverse<Button>('DeleteButton');
		if ('stagesEndAtStageStarts' in selectionObj.track && !selectionObj.segment && !selectionObj.zone) {
			selectButton.SetPanelEvent('onactivate', () => {
				this.updateSelection(selectionObj.track, selectionObj.segment, selectionObj.zone, null);
			});
			deleteButton.DeleteAsync(0);
		} else {
			selectButton.SetPanelEvent('onactivate', () => {
				this.updateSelection(selectionObj.track, selectionObj.segment, selectionObj.zone, deleteButton);
			});
			deleteButton.SetPanelEvent('onactivate', () => this.showDeletePopup());
		}

		if (selectionObj.zone) {
			selectButton.SetPanelEvent('ondblclick', () =>
				this.panels.zoningMenu.moveToRegion(selectionObj.zone.regions[0])
			);
		} else {
			selectButton.SetPanelEvent('ondblclick', () =>
				this.toggleCollapse(childContainer, expandIcon, collapseIcon)
			);
		}

		if (snippet === TracklistSnippet.TRACK) {
			const addSegmentButton = childContainer.FindChildTraverse<Panel>('AddSegmentButton');
			const addEndZoneButton = childContainer.FindChildTraverse<Panel>('AddEndZoneButton');
			if (!('stagesEndAtStageStarts' in selectionObj.track)) {
				addSegmentButton.DeleteAsync(0);
			} else {
				addSegmentButton.SetPanelEvent('onactivate', () => this.addSegment());
			}
			addEndZoneButton.SetPanelEvent('onactivate', () => this.addEndZone(selectionObj.track));
			if (selectionObj.track.zones.end) {
				addEndZoneButton.SetHasClass('hide', true);
			}
		}

		if (snippet === TracklistSnippet.SEGMENT) {
			const addCheckpointButton = childContainer.FindChildTraverse<Panel>('AddCheckpointButton');
			const addCancelZoneButton = childContainer.FindChildTraverse<Panel>('AddCancelZoneButton');
			addCheckpointButton.SetPanelEvent('onactivate', () =>
				this.addCheckpoint(
					selectionObj.track,
					selectionObj.segment,
					childContainer.FindChildTraverse<Panel>('CheckpointContainer')
				)
			);
			addCancelZoneButton.SetPanelEvent('onactivate', () =>
				this.addCancelZone(
					selectionObj.track,
					selectionObj.segment,
					childContainer.FindChildTraverse<Panel>('CancelContainer')
				)
			);
		}

		if (setActive) {
			selectButton.SetSelected(true);
			this.updateSelection(selectionObj.track, selectionObj.segment, selectionObj.zone, deleteButton);
			if (selectionObj.zone) {
				this.panels.zoningMenu.createRegion(!selectionObj.segment.checkpoints.indexOf(selectionObj.zone));
				this.showInfoPanel(true);
			}
		}

		return childContainer;
	}

	createBonusTrack(): BonusTrack {
		return {
			zones: {
				segments: [this.createSegment(false)],
				end: null
			},
			defragModifiers: 0
		};
	}

	createSegment(withStartZone: boolean = true): Segment {
		return {
			limitStartGroundSpeed: false,
			checkpointsRequired: true,
			checkpointsOrdered: true,
			checkpoints: withStartZone ? [this.createZone()] : [],
			cancel: [],
			name: ''
		};
	}

	createZone(withRegion: boolean = true): Zone {
		return {
			regions: withRegion ? [this.createRegion()] : [],
			filtername: ''
		};
	}

	createRegion(): Region {
		return {
			points: [],
			bottom: COORD_MAX,
			height: DEFAULT_HEIGHT,
			teleDestTargetname: ''
		};
	}

	addOptionToDropdown(optionType: string, parent: DropDown, index: number, useIndex: boolean = true) {
		const labelString = optionType + (useIndex ? ` ${index}` : '');
		const optionPanel = $.CreatePanel('Label', parent.AccessDropDownMenu(), labelString);
		optionPanel.SetAttributeInt('value', index);
		optionPanel.text = labelString;
		parent.AddOption(optionPanel);
	}

	populateDropdown(array: any[], dropdown: DropDown, optionType: string, clearDropdown: boolean = false) {
		if (clearDropdown) dropdown.RemoveAllOptions();

		for (const [i, item] of array?.entries() ?? []) {
			this.addOptionToDropdown(optionType || item, dropdown, i, optionType !== '');
		}
	}

	updateSelection(
		selectedTrack: MainTrack | BonusTrack | null,
		selectedSegment: Segment | null,
		selectedZone: Zone | null,
		deleteButton: Button | null
	) {
		if (!selectedTrack) {
			this.panels.propertiesTrack.visible = false;
			this.panels.propertiesSegment.visible = false;
			this.panels.propertiesZone.visible = false;
			return;
		}

		this.selectedZone.track = selectedTrack;
		this.selectedZone.segment = selectedSegment;
		this.selectedZone.zone = selectedZone;
		this.selectedZone.region = null; // this is set in populateRegionProperties()

		const validity = this.isSelectionValid();
		this.panels.propertiesTrack.visible = !validity.zone && !validity.segment && validity.track;
		this.panels.propertiesSegment.visible = !validity.zone && validity.segment;
		this.panels.propertiesZone.visible = validity.zone;

		this.activeDeleteButton?.SetHasClass('hide', true);
		deleteButton?.SetHasClass('hide', false);
		this.activeDeleteButton = deleteButton;

		this.populateZoneProperties();
		this.populateSegmentProperties();
		this.populateTrackProperties();

		this.drawZones();
	}

	populateZoneProperties() {
		if (!this.mapZoneData || !this.isSelectionValid().zone) return;
		const zone = this.selectedZone.zone!;
		const filterIndex = zone.filtername ? (this.filternameList?.indexOf(zone.filtername) ?? 0) : 0;
		this.panels.filterSelect.SetSelectedIndex(filterIndex);
		this.populateDropdown(zone.regions, this.panels.regionSelect, 'Region', true);
		this.panels.regionSelect.SetSelectedIndex(0);
		this.populateRegionProperties();
	}

	populateSegmentProperties() {
		if (!this.mapZoneData || !this.isSelectionValid().segment) return;
		const segment = this.selectedZone.segment!;
		this.panels.limitGroundSpeed.SetSelected(segment.limitStartGroundSpeed);
		this.panels.checkpointsRequired.SetSelected(segment.checkpointsRequired);
		this.panels.checkpointsOrdered.SetSelected(segment.checkpointsOrdered);
		this.panels.segmentName.text = segment.name === undefined ? '' : segment.name;
	}

	populateTrackProperties() {
		if (!this.mapZoneData || !this.isSelectionValid().track) return;
		const track = this.selectedZone.track!;
		const parentPanel = this.panels.stagesEndAtStageStarts.GetParent();
		parentPanel.visible = 'stagesEndAtStageStarts' in track;
		this.panels.stagesEndAtStageStarts.SetSelected(Boolean((track as MainTrack).stagesEndAtStageStarts ?? false));
		this.panels.defragModifiers.visible = this.selectedZone.track !== this.mapZoneData.tracks.main;
		this.panels.maxVelocity.text =
			this.mapZoneData.maxVelocity === undefined ? '' : this.mapZoneData.maxVelocity.toFixed(0);
	}

	updateZoneFilter() {
		if (!this.selectedZone || !this.selectedZone.zone || !this.filternameList) return;

		const filterIndex = this.panels.filterSelect.GetSelected()?.GetAttributeInt('value', 0);
		this.selectedZone.zone.filtername = filterIndex ? this.filternameList[filterIndex] : '';
	}

	populateRegionProperties() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
		if (index === -1) return;
		const region = this.selectedZone.zone.regions[index];
		this.selectedZone.region = region;

		this.panels.regionBottom.text = region?.bottom?.toFixed(2) ?? '';
		this.panels.regionHeight.text = region?.height?.toFixed(2) ?? '';
		this.panels.regionSafeHeight.text = region?.safeHeight?.toFixed(2) ?? '';

		const tpIndex = !region.teleDestTargetname
			? region.teleDestPos !== undefined && region.teleDestYaw !== undefined
				? 1
				: 0
			: this.teleDestList?.indexOf(region?.teleDestTargetname);
		this.panels.regionTPDest.SetSelectedIndex(tpIndex);
		this.onTPDestSelectionChanged();
	}

	addRegion() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		this.selectedZone.zone.regions.push(this.createRegion());
		this.populateDropdown(this.selectedZone.zone.regions, this.panels.regionSelect, 'Region', true);
		this.panels.regionSelect.SetSelectedIndex(this.selectedZone.zone.regions.length - 1);
		this.populateRegionProperties();
	}

	deleteRegion() {
		if (this.selectedZone.zone?.regions?.length === 1) {
			$.Warning("Deleted the last Region in this zone!!!");
			const trackIndex =
				this.selectedZone.track === this.mapZoneData.tracks.main
					? 0
					: this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track) + 1;
			const segmentIndex = this.selectedZone.track.zones.segments.indexOf(this.selectedZone.segment);

			this.deleteSelection();
			const childContainer = this.panels.trackList.GetChild(trackIndex)?.FindChildTraverse('ChildContainer');
			const segmentPanel = childContainer?.FindChildTraverse('SegmentContainer')?.GetChild(segmentIndex);
			const selectButton = segmentPanel.FindChildTraverse<ToggleButton>('SelectButton');
			const deleteButton = segmentPanel.FindChildTraverse<Button>('DeleteButton');

			selectButton?.SetSelected(true);
			this.updateSelection(this.selectedZone.track, this.selectedZone.segment, null, deleteButton);
			return;
		}
		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
		this.selectedZone.zone?.regions.splice(index, 1);
		this.panels.regionSelect.SetSelectedIndex(0);
		this.populateRegionProperties();

		this.drawZones();
	}

	teleportToRegion() {
		if (!this.selectedZone || !this.selectedZone.region) return;

		this.panels.zoningMenu.moveToRegion(this.selectedZone.region);
	}

	pickCorners() {
		if (!this.selectedZone || !this.selectedZone.region) return;
		this.panels.zoningMenu.editRegion(PickType.CORNER, this.selectedZone.region);
		this.showInfoPanel(true);
	}

	pickBottom() {
		if (!this.selectedZone || !this.selectedZone.region) return;
		this.panels.zoningMenu.editRegion(PickType.BOTTOM, this.selectedZone.region);
		this.showInfoPanel(true);
	}

	setRegionBottom() {
		if (!this.selectedZone || !this.selectedZone.region) return;

		const bottom = Number.parseFloat(this.panels.regionBottom.text);
		this.selectedZone.region.bottom = Number.isNaN(bottom) ? 0 : bottom;

		this.drawZones();
	}

	pickHeight() {
		if (!this.selectedZone || !this.selectedZone.region) return;
		this.panels.zoningMenu.editRegion(PickType.HEIGHT, this.selectedZone.region);
		this.showInfoPanel(true);
	}

	setRegionHeight() {
		if (!this.selectedZone || !this.selectedZone.region) return;

		const height = Number.parseFloat(this.panels.regionHeight.text);
		this.selectedZone.region.height = Number.isNaN(height) ? 0 : height;

		this.drawZones();
	}

	pickSafeHeight() {
		if (!this.selectedZone || !this.selectedZone.region) return;
		this.panels.zoningMenu.editRegion(PickType.SAFE_HEIGHT, this.selectedZone.region);
		this.showInfoPanel(true);
	}

	setRegionSafeHeight() {
		if (!this.selectedZone || !this.selectedZone.region) return;

		const height = Number.parseFloat(this.panels.regionSafeHeight.text);
		this.selectedZone.region.safeHeight = Number.isNaN(height) ? 0 : height;

		this.drawZones();
	}

	pickTeleDestPos() {
		if (!this.selectedZone || !this.selectedZone.region) return;
		this.panels.zoningMenu.editRegion(PickType.TELE_DEST_POS, this.selectedZone.region);
		this.showInfoPanel(true);
	}

	pickTeleDestYaw() {
		if (!this.selectedZone || !this.selectedZone.region) return;
		this.panels.zoningMenu.editRegion(PickType.TELE_DEST_YAW, this.selectedZone.region);
		this.showInfoPanel(true);
	}

	onTPDestSelectionChanged() {
		if (!this.selectedZone || !this.selectedZone.region || !this.teleDestList) return;

		const teleDestIndex = this.panels.regionTPDest.GetSelected()?.GetAttributeInt('value', 0);
		if (teleDestIndex === 0) {
			// no teleport destination for this region
			this.selectedZone.region.teleDestTargetname = '';
			delete this.selectedZone.region.teleDestPos;
			delete this.selectedZone.region.teleDestYaw;

			this.setRegionTPDestTextEntriesActive(false);
		} else if (teleDestIndex === 1 && this.selectedZone.region.points?.length > 0) {
			if (
				this.selectedZone.region.teleDestPos === undefined ||
				this.selectedZone.region.teleDestYaw === undefined
			) {
				this.selectedZone.region = this.panels.zoningMenu.createDefaultTeleDest(this.selectedZone.region);
				this.selectedZone.region.teleDestYaw = 0;
				this.selectedZone.region.teleDestTargetname = '';
			}

			this.panels.regionTPPos.x.text = this.selectedZone.region.teleDestPos[0].toFixed(2);
			this.panels.regionTPPos.y.text = this.selectedZone.region.teleDestPos[1].toFixed(2);
			this.panels.regionTPPos.z.text = this.selectedZone.region.teleDestPos[2].toFixed(2);
			this.panels.regionTPYaw.text = this.selectedZone.region.teleDestYaw.toFixed(2);

			this.setRegionTPDestTextEntriesActive(true);
		} else {
			this.selectedZone.region.teleDestTargetname = this.teleDestList[teleDestIndex];
			delete this.selectedZone.region.teleDestPos;
			delete this.selectedZone.region.teleDestYaw;

			this.setRegionTPDestTextEntriesActive(false);
		}

		this.drawZones();
	}

	setRegionTeleDestOrientation() {
		if (!this.selectedZone || !this.selectedZone.region) return;

		const x = Number.parseFloat(this.panels.regionTPPos.x.text);
		const y = Number.parseFloat(this.panels.regionTPPos.y.text);
		const z = Number.parseFloat(this.panels.regionTPPos.z.text);
		const yaw = Number.parseFloat(this.panels.regionTPYaw.text);

		this.selectedZone.region.teleDestPos = [
			Number.isNaN(x) ? 0 : x,
			Number.isNaN(y) ? 0 : y,
			Number.isNaN(z) ? 0 : z
		];
		this.selectedZone.region.teleDestYaw = Number.isNaN(yaw) ? 0 : yaw;

		this.drawZones();
	}

	setRegionTPDestTextEntriesActive(enable: boolean) {
		this.panels.regionTPPos.x.enabled = enable;
		this.panels.regionTPPos.y.enabled = enable;
		this.panels.regionTPPos.z.enabled = enable;
		this.panels.regionTPPosButton.enabled = enable;
		this.panels.regionTPYaw.enabled = enable;
		this.panels.regionTPYawButton.enabled = enable;

		if (!enable) {
			this.panels.regionTPPos.x.text = '';
			this.panels.regionTPPos.y.text = '';
			this.panels.regionTPPos.z.text = '';
			this.panels.regionTPYaw.text = '';
		}
	}

	onRegionEditCompleted(newRegion: Region) {
		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
		if (index !== -1) this.selectedZone.zone.regions[index] = newRegion;

		this.showInfoPanel(false);
		this.drawZones();
	}

	onRegionEditCanceled() {
		if (!this.selectedZone?.region?.points.length) this.deleteRegion();

		this.showInfoPanel(false);
		this.drawZones();
	}

	showInfoPanel(hideProperties: boolean) {
		this.panels.propertiesPanel.SetHasClass('hide', hideProperties);
		this.panels.infoPanel.SetHasClass('hide', !hideProperties);

		if (!hideProperties) this.populateRegionProperties();
	}

	addBonus() {
		if (!this.mapZoneData) return;

		const lastTrack = this.panels.trackList.GetChild(this.mapZoneData.tracks.bonuses?.length ?? 0);
		const addBonusButton = lastTrack.FindChildTraverse<Panel>('AddBonusButton');
		addBonusButton.SetHasClass('hide', true);

		const bonus = this.createBonusTrack();
		if (!this.mapZoneData.tracks.bonuses) {
			this.mapZoneData.tracks.bonuses = [bonus];
		} else {
			this.mapZoneData.tracks.bonuses.push(bonus);
		}

		this.createTrackEntry(
			this.panels.trackList,
			bonus,
			`${$.Localize('#Zoning_Bonus')} ${this.mapZoneData.tracks.bonuses.length}`
		);

		const newBonusPanel = this.panels.trackList.GetChild(this.mapZoneData.tracks.bonuses.length);
		const segmentContainer = newBonusPanel.FindChildTraverse('SegmentContainer');
		const checkpointContainer = segmentContainer.FindChildTraverse<Panel>('CheckpointContainer');
		this.addCheckpoint(bonus, bonus.zones.segments[0], checkpointContainer);

		const selectButton = checkpointContainer.FindChildTraverse<ToggleButton>('SelectButton');
		const deleteButton = checkpointContainer.FindChildTraverse<Button>('DeleteButton');
		const newBonusButton = newBonusPanel.FindChildTraverse<Panel>('AddBonusButton');
		newBonusButton.SetHasClass('hide', false);
		selectButton.SetSelected(true);

		this.updateSelection(bonus, bonus.zones.segments[0], bonus.zones.segments[0].checkpoints[0], deleteButton);
	}

	addSegment() {
		if (!this.mapZoneData) return;

		const mainTrack = this.mapZoneData.tracks.main;
		const newSegment = this.createSegment();

		if (!mainTrack.zones.segments) {
			mainTrack.zones.segments = [newSegment];
		} else {
			mainTrack.zones.segments.push(newSegment);
		}

		const segmentList = this.panels.trackList.GetChild(0)?.FindChildTraverse('SegmentContainer');
		const id = `${$.Localize('#Zoning_Segment')} ${mainTrack.zones.segments.length}`;
		const childContainer = this.addTracklistEntry(segmentList, id, TracklistSnippet.SEGMENT, {
			track: mainTrack,
			segment: newSegment,
			zone: null
		});
		const checkpointContainer = childContainer.FindChildTraverse<Panel>('CheckpointContainer');
		this.addTracklistEntry(
			checkpointContainer,
			mainTrack.zones.segments.length > 0 ? $.Localize('#Zoning_Start_Stage') : $.Localize('#Zoning_Start_Track'),
			TracklistSnippet.CHECKPOINT,
			{
				track: mainTrack,
				segment: newSegment,
				zone: newSegment.checkpoints[0]
			},
			true
		);
	}

	addCheckpoint(track: MainTrack | BonusTrack, segment: Segment, checkpointsList: Panel) {
		if (!this.mapZoneData || !segment || !checkpointsList) return;

		const newZone = this.createZone();
		segment.checkpoints.push(newZone);

		const id =
			segment.checkpoints.length > 1
				? `${$.Localize('#Zoning_Checkpoint')} ${segment.checkpoints.length - 1}`
				: track.zones.segments.indexOf(segment) > 0
					? $.Localize('#Zoning_Start_Stage')
					: $.Localize('#Zoning_Start_Track');
		this.addTracklistEntry(
			checkpointsList,
			id,
			TracklistSnippet.CHECKPOINT,
			{
				track: track,
				segment: segment,
				zone: newZone
			},
			true
		);
		this.panels.regionSelect.SetSelectedIndex(0);
	}

	addEndZone(track: MainTrack | BonusTrack) {
		// TODO: fix this seleciton logic
		if (!this.mapZoneData || !this.isSelectionValid().track) return;
		if (this.isSelectionValid().defragBonus) {
			$.Warning('Defrag Bonus must share zones with Main track!');
			return;
		}
		const endZone = this.createZone();
		track.zones.end = endZone;

		let trackPanel: Panel;
		if (track === this.mapZoneData.tracks.main) {
			trackPanel = this.panels.trackList.GetChild(0);
		} else {
			const bonusId = this.mapZoneData.tracks.bonuses.indexOf(track);
			trackPanel = this.panels.trackList.GetChild(1 + bonusId);
		}
		const endZoneContainer = trackPanel.FindChildTraverse('EndZoneContainer');

		this.addTracklistEntry(
			endZoneContainer,
			$.Localize('#Zoning_EndZone'),
			TracklistSnippet.CHECKPOINT,
			{
				track: track,
				segment: null,
				zone: endZone
			},
			true
		);

		trackPanel.FindChildTraverse('AddEndZoneButton').SetHasClass('hide', true);
	}

	addCancelZone(track: MainTrack | BonusTrack, segment: Segment, cancelList: Panel) {
		if (!this.mapZoneData || !segment || !cancelList) return;

		const newZone = this.createZone();
		if (!segment.cancel) {
			segment.cancel = [newZone];
		} else {
			segment.cancel.push(newZone);
		}

		const id = `${$.Localize('#Zoning_CancelZone')} ${segment.cancel.length}`;
		this.addTracklistEntry(
			cancelList,
			id,
			TracklistSnippet.CHECKPOINT,
			{
				track: track,
				segment: segment,
				zone: newZone
			},
			true
		);
	}

	showDeletePopup() {
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
			$.Localize('#Zoning_Delete'),
			$.Localize('#Zoning_Delete_Message'),
			'warning-popup',
			$.Localize('#Zoning_Delete'),
			() => {
				this.deleteSelection();
			},
			$.Localize('#Zoning_Cancel'),
			() => {},
			'none'
		);
	}

	deleteSelection() {
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
			if (this.selectedZone.track.zones.segments?.length === 1) {
				$.Msg('Track must have at least one segment!');
			}
			const index = this.mapZoneData.tracks.main.zones.segments.indexOf(this.selectedZone.segment);
			this.mapZoneData.tracks.main.zones.segments.splice(index, 1);
		} else if (this.selectedZone.track && this.selectedZone.zone) {
			delete this.selectedZone.track.zones.end;
		} else if (this.selectedZone.track) {
			if ('stagesEndAtStageStarts' in this.selectedZone.track) {
				$.Msg("Can't delete Main track!!!");
				this.mapZoneData.tracks.main = {
					zones: {
						segments: [this.createSegment(false)],
						end: null
					},
					stagesEndAtStageStarts: true
				};
			} else {
				const trackIndex = this.mapZoneData.tracks.bonuses.indexOf(this.selectedZone.track);
				this.mapZoneData.tracks.bonuses.splice(trackIndex, 1);

				const lastTrack = this.panels.trackList.GetChild(this.mapZoneData.tracks.bonuses?.length ?? 0);
				const addBonusButton = lastTrack.FindChildTraverse<Panel>('AddBonusButton');
				addBonusButton.SetHasClass('hide', true);
			}
		}

		this.activeDeleteButton = null;
		//hack: this can be a little more surgical
		this.panels.trackList.RemoveAndDeleteChildren();
		this.initMenu();

		this.drawZones();
	}

	setMaxVelocity() {
		if (!this.mapZoneData) return;
		const velocity = Number.parseFloat(this.panels.maxVelocity.text);
		this.mapZoneData.maxVelocity = !Number.isNaN(velocity) && velocity > 0 ? velocity : 0;
	}

	setStageEndAtStageStarts() {
		if (!this.isSelectionValid().track || !('stagesEndAtStageStarts' in this.selectedZone.track)) return;
		this.selectedZone.track.stagesEndAtStageStarts = this.panels.stagesEndAtStageStarts.checked;
	}

	showDefragFlagMenu() {
		if (!this.isSelectionValid().track || !('defragModifiers' in this.selectedZone.track)) return;

		const flagEditMenu = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent<Panel>(
			this.panels.defragModifiers.id,
			'',
			'file://{resources}/layout/modals/context-menus/zoning-df-flags.xml',
			'',
			() => {
				this.onDefragFlagMenuClosed();
			}
		);

		const hasteFlag = flagEditMenu.FindChildTraverse<Panel>('FlagHaste');
		hasteFlag.checked = (this.selectedZone.track.defragModifiers & DefragFlags.HASTE) > 0;
		hasteFlag.SetPanelEvent('onactivate', () => this.setDefragFlags(DefragFlags.HASTE));

		const slickFlag = flagEditMenu.FindChildTraverse<Panel>('FlagSlick');
		slickFlag.checked = (this.selectedZone.track.defragModifiers & DefragFlags.SLICK) > 0;
		slickFlag.SetPanelEvent('onactivate', () => this.setDefragFlags(DefragFlags.SLICK));

		const damageBoostFlag = flagEditMenu.FindChildTraverse<Panel>('FlagDamageBoost');
		damageBoostFlag.checked = (this.selectedZone.track.defragModifiers & DefragFlags.DAMAGEBOOST) > 0;
		damageBoostFlag.SetPanelEvent('onactivate', () => this.setDefragFlags(DefragFlags.DAMAGEBOOST));

		const rocketsFlag = flagEditMenu.FindChildTraverse<Panel>('FlagRockets');
		rocketsFlag.checked = (this.selectedZone.track.defragModifiers & DefragFlags.ROCKETS) > 0;
		rocketsFlag.SetPanelEvent('onactivate', () => this.setDefragFlags(DefragFlags.ROCKETS));

		const plasmaFlag = flagEditMenu.FindChildTraverse<Panel>('FlagPlasma');
		plasmaFlag.checked = (this.selectedZone.track.defragModifiers & DefragFlags.PLASMA) > 0;
		plasmaFlag.SetPanelEvent('onactivate', () => this.setDefragFlags(DefragFlags.PLASMA));

		const bfgFlag = flagEditMenu.FindChildTraverse<Panel>('FlagBFG');
		bfgFlag.checked = (this.selectedZone.track.defragModifiers & DefragFlags.BFG) > 0;
		bfgFlag.SetPanelEvent('onactivate', () => this.setDefragFlags(DefragFlags.BFG));
	}

	setDefragFlags(flag: DefragFlags) {
		// don't use defragBonus validity check because we could be setting the flags for the first time
		if (!this.isSelectionValid().track || !('defragModifiers' in this.selectedZone.track!)) return;
		this.selectedZone.track.defragModifiers ^= flag;
	}

	onDefragFlagMenuClosed() {
		if (!this.isSelectionValid().defragBonus) return;
		delete this.selectedZone.track.zones;
		const bonusIndex = this.mapZoneData!.tracks.bonuses.indexOf(this.selectedZone.track);
		const trackPanel = this.panels.trackList.GetChild(1 + bonusIndex);
		trackPanel.FindChildTraverse('CollapseButton').visible = false;
		trackPanel.FindChildTraverse('ChildContainer').RemoveAndDeleteChildren();
		// keep select button aligned with other tracks
		trackPanel.FindChildTraverse('Entry').SetHasClass('zoning__tracklist-checkpoint', true);
	}

	setLimitGroundSpeed() {
		if (!this.isSelectionValid().segment) return;
		this.selectedZone.segment!.limitStartGroundSpeed = this.panels.limitGroundSpeed.checked;
	}

	setCheckpointsOrdered() {
		if (!this.isSelectionValid().segment) return;
		this.selectedZone.segment!.checkpointsOrdered = this.panels.checkpointsOrdered.checked;
	}

	setCheckpointsRequired() {
		if (!this.isSelectionValid().segment) return;
		this.selectedZone.segment!.checkpointsRequired = this.panels.checkpointsRequired.checked;
	}

	setSegmentName() {
		if (!this.isSelectionValid().segment) return;
		this.selectedZone.segment!.name = this.panels.segmentName.text;
		// feat: later
		// update segment name in trasklist tree
	}

	drawZones() {
		if (!this.mapZoneData) return;
		if (!this.selectedZone) return;

		const renderRegions: ZoneEditorRegion[] = [];

		const validity = this.isSelectionValid();

		for (const [segmentNumber, segment] of this.selectedZone.track.zones.segments?.entries() ?? []) {
			for (const [checkpointNumber, checkpoint] of segment.checkpoints?.entries() ?? []) {
				for (const region of checkpoint.regions) {
					renderRegions.push({
						region: region,
						renderMode:
							checkpointNumber === 0
								? segmentNumber === 0
									? RegionRenderMode.START
									: RegionRenderMode.MAJOR_CHECKPOINT
								: RegionRenderMode.MINOR_CHECKPOINT,
						editing: validity.zone && region === this.selectedZone.region
					});
				}
			}
			for (const cancel of segment?.cancel ?? []) {
				for (const region of cancel.regions) {
					renderRegions.push({
						region: region,
						renderMode: RegionRenderMode.CANCEL,
						editing: validity.zone && region === this.selectedZone.region
					});
				}
			}
		}
		for (const region of this.selectedZone.track.zones.end?.regions ?? []) {
			renderRegions.push({
				region: region,
				renderMode: RegionRenderMode.END,
				editing: validity.zone && region === this.selectedZone.region
			});
		}

		this.panels.zoningMenu.drawRegions(renderRegions);
	}

	saveZones() {
		if (!this.mapZoneData) return;
		this.mapZoneData.dataTimestamp = Date.now();
		MomentumTimerAPI.SaveZoneDefs(this.mapZoneData);
	}

	cancelEdit() {
		this.activeDeleteButton = null;
		this.panels.trackList.RemoveAndDeleteChildren();
		this.mapZoneData = null;

		MomentumTimerAPI.LoadZoneDefs(false);
		this.initMenu();
		this.drawZones();
	}

	isSelectionValid() {
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
