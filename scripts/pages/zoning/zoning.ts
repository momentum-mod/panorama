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

export enum ItemType {
	TRACK = 0,
	SEGMENT = 1,
	ZONE = 2,

	GLOBAL_REGION_TYPE = 3, // the ItemType is itself a type (of global region)
	GLOBAL_REGION = 4
}

export enum GlobalRegionType {
	TYPES_LIST = 0,
	ALLOW_BHOP = 1,
	CANCEL_TIMER = 2
}

interface GlobalRegionSelection {
	type?: GlobalRegionType;
	regions?: Region[];
	index?: number;
}

interface ZoneSelection {
	track?: MainTrack | BonusTrack | null;
	segment?: Segment | null;
	zone?: Zone | null;
	globalRegion?: GlobalRegionSelection | null;
}

function countTrackRegions(track: MainTrack | BonusTrack) {
	let regionCount = 0;

	for (const segment of track.zones?.segments ?? []) {
		for (const zone of segment.checkpoints ?? []) {
			regionCount += zone.regions?.length ?? 0;
		}
		for (const zone of segment.cancel ?? []) {
			regionCount += zone.regions?.length ?? 0;
		}
	}

	if (track.zones?.end.regions) {
		regionCount += track.zones.end.regions.length;
	}

	return regionCount;
}

@PanelHandler()
class ZoneMenuHandler {
	readonly panels = {
		zoningMenu: $.GetContextPanel<ZoneMenu>()!,

		leftList: $<Panel>('#LeftList')!,
		centerList: $<Panel>('#CenterList')!,
		rightList: $<Panel>('#RightList')!,

		createMainButton: $<Button>('#CreateMainButton')!,
		addBonusButton: $<Button>('#AddBonusButton')!,
		addDefragBonusButton: $<Button>('#AddDefragBonusButton')!,
		addSegmentButton: $<Button>('#AddSegmentButton')!,
		addEndZoneButton: $<Button>('#AddEndZoneButton')!,
		addCheckpointButton: $<Button>('#AddCheckpointButton')!,
		addCheckpointButtonLabel: $<Label>('#AddCheckpointButtonLabel')!,
		addCancelZoneButton: $<Button>('#AddCancelZoneButton')!,
		addGlobalRegionButton: $<Button>('#AddGlobalRegionButton')!,

		propertiesPanel: $<Panel>('#PropertiesContainer')!,
		propertiesTrack: $<Panel>('#TrackProperties')!,
		maxVelocity: $<TextEntry>('#MaxVelocity')!,
		defragModifiers: $<Panel>('#DefragFlags')!,
		stagesEndAtStageStarts: $('#StagesEndAtStageStarts')!.FindChild<ToggleButton>('CheckBox')!,
		bhopEnabled: $('#BhopEnabled')!.FindChild<ToggleButton>('CheckBox')!,
		propertiesSegment: $<Panel>('#SegmentProperties')!,
		limitGroundSpeed: $('#LimitGroundSpeed')!.FindChild<ToggleButton>('CheckBox')!,
		checkpointsRequired: $('#CheckpointsRequired')!.FindChild<ToggleButton>('CheckBox')!,
		checkpointsOrdered: $('#CheckpointsOrdered')!.FindChild<ToggleButton>('CheckBox')!,
		segmentName: $<TextEntry>('#SegmentName')!,
		propertiesZone: $<Panel>('#ZoneProperties')!,
		infoPanel: $<Panel>('#InfoPanel')!,
		selectionMode: $<Label>('#SelectionMode')!,
		filterSelect: $<DropDown>('#FilterSelect')!,
		volumeSelect: $<DropDown>('#VolumeSelect')!,
		regionSelect: $<DropDown>('#RegionSelect')!,
		regionBottom: $<TextEntry>('#RegionBottom')!,
		regionHeight: $<TextEntry>('#RegionHeight')!,
		regionSafeHeight: $<TextEntry>('#RegionSafeHeight')!,
		regionTPDest: $<DropDown>('#RegionTPDest')!,
		regionTPPos: {
			x: $<TextEntry>('#TeleX')!,
			y: $<TextEntry>('#TeleY')!,
			z: $<TextEntry>('#TeleZ')!
		},
		regionTPPosButton: $<Button>('#SetTeleDestPosButton')!,
		regionTPYaw: $<TextEntry>('#TeleYaw')!,
		regionTPYawButton: $<Button>('#SetTeleDestYawButton')!
	};

	zoningLimits: ZoneEditorLimits | null = null;
	selectedZone: ZoneSelection = {
		track: null as MainTrack | BonusTrack | null,
		segment: null as Segment | null,
		zone: null as Zone | null,
		globalRegion: null
	};
	selectedRegion: Region | null = null;
	mapZoneData: MapZones | null = null;
	filternameList: string[] | null = null;
	teleDestList: string[] | null = null;
	editorDefragModifiers = 0;

	didInit = false;

	constructor() {
		$.RegisterForUnhandledEvent('ZoneMenu_Show', () => this.showZoneMenu());
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', () => this.hideZoneMenu());
		$.RegisterForUnhandledEvent('OnRegionEditCompleted', (region) => this.onRegionEditCompleted(region));
		$.RegisterForUnhandledEvent('OnRegionEditCanceled', () => this.onRegionEditCanceled());
		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => this.onLevelInit());
	}

	initialize() {
		const entList: EntityList = this.panels.zoningMenu.getEntityList();
		this.filternameList = entList.filter ?? [];
		this.filternameList.unshift($.Localize('#Zoning_Filter_None'));
		this.populateDropdown(this.filternameList, this.panels.filterSelect, '', true);

		this.teleDestList = entList.teleport ?? [];
		this.teleDestList.unshift($.Localize('#Zoning_TPDest_UserDefined'));
		this.teleDestList.unshift($.Localize('#Zoning_TPDest_None'));
		this.populateDropdown(this.teleDestList, this.panels.regionTPDest, '', true);

		this.zoningLimits = this.panels.zoningMenu.getZoningLimits();

		this.didInit = true;
	}

	onLevelInit() {
		this.initialize();
	}

	getZoneData() {
		this.mapZoneData = MomentumTimerAPI.GetActiveZoneDefs() ?? {
			tracks: {},
			formatVersion: FORMAT_VERSION,
			dataTimestamp: -1 // Filled out before zone is saved
		};
	}

	safeToDeleteItemListSelection(type: ItemType) {
		// This determines whether the user is allowed to delete an item in the top lists directly.
		// If not, that probably means that doing so would require deleting the parent object to keep
		// a valid state, but there is some sibling data considered important which would also get destroyed.
		// If they really want that, they have to initiate the deletion of the parent object explicitly.
		switch (type) {
			case ItemType.ZONE:
				return this.safeToDeleteSelectedZone();
			case ItemType.SEGMENT:
				return this.safeToDeleteSelectedSegment();
			case ItemType.TRACK:
				return true;
			case ItemType.GLOBAL_REGION:
				return true;
			default:
				throw new Error('Unknown selection type');
		}
	}

	addItemListItem(
		parent: Panel,
		label: string,
		zonesObject: MainTrack | BonusTrack | Segment | Zone | GlobalRegionType | Region,
		itemType: ItemType,
		selectionWhenActivated: ZoneSelection
	) {
		const item = $.CreatePanel('Panel', parent, label);
		item.LoadLayoutSnippet('itemlist-item');

		item.FindChildTraverse<Label>('Name')!.text = label;

		const selectButton = item.FindChildTraverse<ToggleButton>('SelectButton');

		selectButton.SetPanelEvent('onactivate', () => {
			this.updateSelection(selectionWhenActivated);
		});

		selectButton.SetPanelEvent('ondblclick', () => {
			let region: Region = null;
			if (selectionWhenActivated.zone) {
				region = selectionWhenActivated.zone.regions[0];
			} else if (selectionWhenActivated.segment) {
				region = selectionWhenActivated.segment.checkpoints[0].regions[0];
			} else if (selectionWhenActivated.track) {
				region = selectionWhenActivated.track.zones.segments[0].checkpoints[0].regions[0];
			} else if (selectionWhenActivated.globalRegion?.index >= 0) {
				region = this.selectedZone.globalRegion.regions[this.selectedZone.globalRegion.index];
			}
			if (region) {
				this.panels.zoningMenu.moveToRegion(region);
			}
		});

		let isInActiveHierarchy = false;
		switch (itemType) {
			case ItemType.TRACK:
				isInActiveHierarchy = this.selectedZone.track === zonesObject;
				break;
			case ItemType.SEGMENT:
				isInActiveHierarchy = this.selectedZone.segment === zonesObject;
				break;
			case ItemType.ZONE:
				isInActiveHierarchy = this.selectedZone.zone === zonesObject;
				break;
			case ItemType.GLOBAL_REGION_TYPE:
				if (zonesObject === GlobalRegionType.TYPES_LIST) {
					isInActiveHierarchy = this.selectedZone.globalRegion != null;
				} else {
					isInActiveHierarchy = this.selectedZone.globalRegion?.type === zonesObject;
				}
				break;
			case ItemType.GLOBAL_REGION:
				isInActiveHierarchy =
					this.selectedZone.globalRegion.regions[this.selectedZone.globalRegion.index] === zonesObject;
				break;
		}

		if (isInActiveHierarchy) {
			selectButton.AddClass('in-active-hierarchy');

			if (zonesObject === this.getActiveSelection()) {
				selectButton.AddClass('selected');

				if (itemType !== ItemType.GLOBAL_REGION_TYPE && this.safeToDeleteItemListSelection(itemType)) {
					const deleteButton = item.FindChildTraverse<Button>('DeleteButton');
					if (deleteButton) {
						deleteButton.RemoveClass('hide');
						deleteButton.SetPanelEvent('onactivate', () => {
							this.showDeletePopup();
						});
					}
				}
			}
		}

		return item;
	}

	getActiveSelection() {
		// The thing that is actually focused right now and not a parent object
		return (
			this.selectedZone.zone ||
			this.selectedZone.segment ||
			this.selectedZone.track ||
			(this.selectedZone.globalRegion?.index != null &&
				this.selectedZone.globalRegion.regions[this.selectedZone.globalRegion.index]) ||
			null
		);
	}

	rebuildLists() {
		if (!this.mapZoneData) {
			this.getZoneData();
		}

		if (!this.mapZoneData) return;

		this.panels.leftList.RemoveAndDeleteChildren();
		this.panels.centerList.RemoveAndDeleteChildren();
		this.panels.rightList.RemoveAndDeleteChildren();

		if (this.mapZoneData.tracks.main) {
			this.addItemListItem(
				this.panels.leftList,
				$.Localize('#Zoning_Main'),
				this.mapZoneData.tracks.main,
				ItemType.TRACK,
				{ track: this.mapZoneData.tracks.main }
			);
		}

		const bonusTag = $.Localize('#Zoning_Bonus');
		for (const [i, bonus] of this.mapZoneData.tracks.bonuses?.entries() ?? []) {
			const selectionObj: ZoneSelection = { track: bonus };
			const item = this.addItemListItem(
				this.panels.leftList,
				`${bonusTag} ${i + 1}`,
				bonus,
				ItemType.TRACK,
				selectionObj
			);

			item.SetPanelEvent('oncontextmenu', () => {
				const insertBonus = (before) => {
					// Select this one first for the context of where to add the new one
					this.updateSelection(selectionObj);
					this.addBonus(false, before ? i : i + 1);
				};

				const contextItems = [
					{
						label: '#Zoning_InsertBonusBefore',
						jsCallback: () => insertBonus(true)
					},
					{
						label: '#Zoning_InsertBonusAfter',
						jsCallback: () => insertBonus(false)
					}
				];

				UiToolkitAPI.ShowSimpleContextMenu('', '', contextItems);
			});
		}

		this.addItemListItem(
			this.panels.leftList,
			$.Localize('#Zoning_GlobalRegions'),
			GlobalRegionType.TYPES_LIST,
			ItemType.GLOBAL_REGION_TYPE,
			{ globalRegion: { type: GlobalRegionType.TYPES_LIST } }
		);

		this.rebuildCenterList();
		this.rebuildRightList();

		let regionCount = 0;
		if (this.mapZoneData.tracks.main) {
			regionCount += countTrackRegions(this.mapZoneData.tracks.main);
		}
		for (const bonus of this.mapZoneData.tracks.bonuses ?? []) {
			regionCount += countTrackRegions(bonus);
		}

		this.panels.createMainButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS || Boolean(this.mapZoneData.tracks.main)
		);

		this.panels.addBonusButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS ||
				this.mapZoneData.tracks.bonuses?.length >= this.zoningLimits.MAX_BONUS_TRACKS
		);

		this.panels.addDefragBonusButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS ||
				this.mapZoneData.tracks.bonuses?.length >= this.zoningLimits.MAX_BONUS_TRACKS ||
				!this.mapZoneData.tracks.main ||
				this.mapZoneData.tracks.main.zones.segments.length !== 1
		);

		this.panels.addSegmentButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS ||
				!this.selectedZone.track ||
				!this.isMainTrack(this.selectedZone.track) ||
				this.selectedZone.track.zones.segments.length >= this.zoningLimits.MAX_TRACK_SEGMENTS ||
				this.mapZoneData.tracks.bonuses?.some((bonus) => this.isDefragBonus(bonus)) ||
				false
		);

		this.panels.addEndZoneButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS ||
				!this.selectedZone.track ||
				(this.selectedZone.track.zones?.segments ?? []).length === 0 ||
				(this.selectedZone.track.zones.segments[0].checkpoints ?? []).length === 0 || // require making a start zone first
				Boolean(this.selectedZone.track?.zones?.end.regions?.length > 0)
		);

		this.panels.addCheckpointButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS ||
				!this.selectedZone.segment ||
				this.selectedZone.segment.checkpoints?.length >= this.zoningLimits.MAX_SEGMENT_CHECKPOINTS
		);

		this.panels.addCancelZoneButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS || !this.selectedZone.segment
		);

		this.panels.addGlobalRegionButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS ||
				this.selectedZone.globalRegion?.type == null ||
				this.selectedZone.globalRegion.type === GlobalRegionType.TYPES_LIST
		);
	}

	rebuildCenterList() {
		this.panels.centerList.RemoveAndDeleteChildren();

		if (this.selectedZone.globalRegion != null) {
			const types = [
				['#Zoning_AllowBhopZone', GlobalRegionType.ALLOW_BHOP, 'allowBhop'] as const,
				['#Zoning_CancelZone', GlobalRegionType.CANCEL_TIMER, 'cancel'] as const
			];

			this.mapZoneData.globalRegions = this.mapZoneData.globalRegions || {};

			for (const [text, type, regionsKey] of types) {
				this.mapZoneData.globalRegions[regionsKey] = this.mapZoneData.globalRegions[regionsKey] || [];
				this.addItemListItem(this.panels.centerList, $.Localize(text), type, ItemType.GLOBAL_REGION_TYPE, {
					globalRegion: { type: type, regions: this.mapZoneData.globalRegions[regionsKey] }
				});
			}

			return;
		}

		if (!this.selectedZone.track) return;

		const segmentTag = $.Localize('#Zoning_Segment');

		for (const [i, segment] of this.selectedZone.track.zones?.segments?.entries() ?? []) {
			const majorId = segment.name || `${segmentTag} ${i + 1}`;

			this.addItemListItem(this.panels.centerList, majorId, segment, ItemType.SEGMENT, {
				track: this.selectedZone.track,
				segment: segment
			});
		}

		if (this.selectedZone.track.zones?.end.regions?.length > 0) {
			this.addItemListItem(
				this.panels.centerList,
				$.Localize('#Zoning_EndZone'),
				this.selectedZone.track.zones.end,
				ItemType.ZONE,
				{ track: this.selectedZone.track, zone: this.selectedZone.track.zones.end }
			);
		}
	}

	rebuildRightList() {
		this.panels.rightList.RemoveAndDeleteChildren();

		if (
			this.selectedZone.globalRegion?.type != null &&
			this.selectedZone.globalRegion.type !== GlobalRegionType.TYPES_LIST
		) {
			for (const [i, region] of this.selectedZone.globalRegion.regions.entries()) {
				this.addItemListItem(
					this.panels.rightList,
					`${$.Localize('#Zoning_Region')} ${i + 1}`,
					region,
					ItemType.GLOBAL_REGION,
					{ globalRegion: { ...this.selectedZone.globalRegion, index: i } }
				);
			}

			return;
		}

		if (!this.selectedZone.track) return;
		if (!this.selectedZone.segment) return;

		const isFirst = this.selectedZone.segment === this.selectedZone.track.zones.segments[0];

		const checkpointTag = $.Localize('#Zoning_Checkpoint');

		for (const [i, zone] of this.selectedZone.segment.checkpoints?.entries() ?? []) {
			let minorId = '';
			if (i === 0) {
				minorId = $.Localize(isFirst ? '#Zoning_Start_Track' : '#Zoning_Start_Stage');
			} else {
				minorId = `${checkpointTag} ${i}`;
			}

			const selectionObj = { track: this.selectedZone.track, segment: this.selectedZone.segment, zone: zone };

			const item = this.addItemListItem(this.panels.rightList, minorId, zone, ItemType.ZONE, selectionObj);

			item.SetPanelEvent('oncontextmenu', () => {
				const insertCheckpoint = (before) => {
					// Select this one first for the context of which segment to add the new one to
					this.updateSelection(selectionObj);
					this.addCheckpoint(before ? i : i + 1);
				};

				const contextItems = [
					{
						label: '#Zoning_InsertBefore',
						jsCallback: () => insertCheckpoint(true)
					},
					{
						label: '#Zoning_InsertAfter',
						jsCallback: () => insertCheckpoint(false)
					}
				];

				UiToolkitAPI.ShowSimpleContextMenu('', '', contextItems);
			});
		}

		for (const [i, zone] of this.selectedZone.segment.cancel?.entries() ?? []) {
			const cancelTag = $.Localize('#Zoning_CancelZone');

			this.addItemListItem(this.panels.rightList, `${cancelTag} ${i + 1}`, zone, ItemType.ZONE, {
				track: this.selectedZone.track,
				segment: this.selectedZone.segment,
				zone: zone
			});
		}

		this.panels.addCheckpointButtonLabel.text = $.Localize(
			isFirst && (this.selectedZone.segment.checkpoints?.length ?? 0) === 0
				? '#Zoning_CreateStart'
				: '#Zoning_NewCheckpoint'
		);
	}

	showZoneMenu() {
		this.updateSelection({});
	}

	hideZoneMenu() {
		if (this.mapZoneData) {
			// TODO: is this just hiding the menu or always exiting edit mode? should rename function and events accordingly
			//   (we should only actually be saving the zone data when exiting edit mode)
			// TODO: set as local
			MomentumTimerAPI.SetActiveZoneDefs(this.mapZoneData);
		}
	}

	createBonusTrack(): BonusTrack {
		return {
			zones: {
				segments: [this.createSegment()],
				end: {}
			},
			defragModifiers: 0
		};
	}

	createSegment(withStartZone: boolean = true): Segment {
		return {
			limitStartGroundSpeed: false,
			checkpointsRequired: true,
			checkpointsOrdered: true,
			checkpoints: withStartZone ? [this.createZone()] : undefined,
			cancel: undefined,
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

	updateSelection(newSelection: ZoneSelection) {
		if (!this.didInit) {
			// Initialize now if this handler was reloaded while on a map
			this.initialize();
		}

		this.selectedZone = newSelection;
		this.selectedRegion = null; // this is set in populateRegionProperties()

		if (newSelection?.track) {
			const validTrack = this.hasSelectedTrack();
			const validSegment = this.hasSelectedSegment();
			const validZone = this.hasSelectedZone();
			this.panels.propertiesTrack.visible = !validZone && !validSegment && validTrack;
			this.panels.propertiesSegment.visible = !validZone && validSegment;
			this.panels.propertiesZone.visible = validZone;

			this.panels.regionSelect.SetSelectedIndex(0);

			this.populateZoneProperties();
			this.populateSegmentProperties();
			this.populateTrackProperties();
		} else {
			this.panels.propertiesTrack.visible = false;
			this.panels.propertiesSegment.visible = false;
			this.panels.propertiesZone.visible = false;
		}

		this.rebuildLists();

		this.drawZones();
	}

	populateZoneProperties() {
		if (!this.mapZoneData || !this.hasSelectedZone()) return;
		const zone = this.selectedZone.zone;
		const filterIndex = zone.filtername ? (this.filternameList?.indexOf(zone.filtername) ?? 0) : 0;
		this.panels.filterSelect.SetSelectedIndex(filterIndex);
		this.populateDropdown(zone.regions, this.panels.regionSelect, 'Region', true);
		this.panels.regionSelect.SetSelectedIndex(0);
		this.populateRegionProperties();
	}

	populateSegmentProperties() {
		if (!this.mapZoneData || !this.hasSelectedSegment()) return;
		const segment = this.selectedZone.segment;
		this.panels.limitGroundSpeed.SetSelected(segment.limitStartGroundSpeed);
		this.panels.checkpointsRequired.SetSelected(segment.checkpointsRequired);
		this.panels.checkpointsOrdered.SetSelected(segment.checkpointsOrdered);
		this.panels.segmentName.text = segment.name === undefined ? '' : segment.name;
	}

	populateTrackProperties() {
		if (!this.mapZoneData || !this.hasSelectedTrack()) return;
		const track = this.selectedZone.track;
		const parentPanel = this.panels.stagesEndAtStageStarts.GetParent()!;
		parentPanel.visible = this.hasSelectedMainTrack();
		this.panels.stagesEndAtStageStarts.SetSelected(Boolean((track as MainTrack).stagesEndAtStageStarts ?? false));
		this.panels.defragModifiers.visible = this.hasSelectedDefragBonus();
		this.panels.maxVelocity.text =
			this.mapZoneData.maxVelocity === undefined ? '' : this.mapZoneData.maxVelocity.toFixed(0);
	}

	updateZoneFilter() {
		if (!this.selectedZone || !this.selectedZone.zone || !this.filternameList) return;

		const filterIndex = this.panels.filterSelect.GetSelected()?.GetAttributeInt('value', 0);
		this.selectedZone.zone.filtername = filterIndex ? this.filternameList[filterIndex] : '';
	}

	populateRegionProperties() {
		if (!this.selectedZone || !this.selectedZone.zone || !this.teleDestList) return;

		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
		if (index === -1) return;
		const region = this.selectedZone.zone.regions[index];
		this.selectedRegion = region;
		this.panels.zoningMenu.updateSelectedRegion(this.selectedRegion);

		this.panels.regionBottom.text = region?.bottom?.toFixed(2) ?? '';
		this.panels.regionHeight.text = region?.height?.toFixed(2) ?? '';
		this.panels.regionSafeHeight.text = region?.safeHeight?.toFixed(2) ?? '';

		const tpIndex = !region?.teleDestTargetname
			? region?.teleDestPos !== undefined && region?.teleDestYaw !== undefined
				? 1
				: 0
			: (this.teleDestList?.indexOf(region?.teleDestTargetname) ?? 0);
		this.panels.regionTPDest.SetSelectedIndex(tpIndex);
		this.onTPDestSelectionChanged();
	}

	addRegion() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		this.selectedZone.zone.regions.push(this.createRegion());
		this.panels.zoningMenu.createRegion(this.isStartZone(this.selectedZone.zone));
		this.setInfoPanelShown(true);
		this.populateDropdown(this.selectedZone.zone.regions, this.panels.regionSelect, 'Region', true);
		this.panels.regionSelect.SetSelectedIndex(this.selectedZone.zone.regions.length - 1);
	}

	deletingSelectedRegionCascadesToZone() {
		// If we delete the region, are we required to also delete the zone to maintain a valid state?
		// (even if doing so would delete other things in the zone data)
		return this.selectedZone.zone && this.selectedZone.zone.regions?.length === 1;
	}

	safeToDeleteSelectedRegion() {
		// It's always safe to delete something that doesn't have to cascade to other things
		if (!this.deletingSelectedRegionCascadesToZone()) {
			return true;
		}

		return this.safeToDeleteSelectedZone();
	}

	deletingSelectedZoneCascadesToSegment() {
		// If we delete the zone, are we required to also delete the segment to maintain a valid state?
		// (even if doing so would delete other things in the segment data)
		return (
			this.selectedZone.segment &&
			this.selectedZone.segment.checkpoints.length === 1 &&
			this.selectedZone.segment.checkpoints[0] === this.selectedZone.zone
		);
	}

	safeToDeleteSelectedZone() {
		// It's always safe to delete something that doesn't have to cascade to other things
		if (!this.deletingSelectedZoneCascadesToSegment()) {
			return true;
		}

		if (this.selectedZone.segment.cancel?.length > 0) {
			// There is other stuff in this segment, so we can't delete
			return false;
		}

		return this.safeToDeleteSelectedSegment();
	}

	deletingSelectedSegmentCascadesToTrack() {
		// If we delete the segment, are we required to also delete the track to maintain a valid state?
		// (even if doing so would delete other things in the track data)
		return (
			this.selectedZone.track &&
			this.selectedZone.track.zones.segments.length === 1 &&
			this.selectedZone.track.zones.segments[0] === this.selectedZone.segment
		);
	}

	safeToDeleteSelectedSegment() {
		// It's always safe to delete something that doesn't have to cascade to other things
		if (!this.deletingSelectedSegmentCascadesToTrack()) {
			return true;
		}

		if (this.selectedZone.track.zones.end.regions?.length > 0) {
			// There is other stuff in this track, so we can't delete
			return false;
		}

		// Deleting a track is always safe (there is no parent object that could get deleted in the process).
		return true;
	}

	deleteRegion() {
		if (!this.mapZoneData || !this.selectedRegion) return;

		if (this.deletingSelectedRegionCascadesToZone()) {
			if (this.safeToDeleteSelectedZone()) {
				// Go ahead and cascade the delete to the zone
				this.deleteSelection();
			} else {
				// Zone is not safe to cascade-delete, can only recreate the region or cancel.
				// If the user is really ok with potentially destroying other stuff, they can explicitly delete the zone.
				UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
					$.Localize('#Zoning_Delete'),
					$.Localize('#Zoning_LastCheckpointRegion_Message'),
					'warning-popup',
					$.Localize('#Zoning_Recreate'),
					() => {
						if (!this.selectedZone || !this.selectedZone.zone) throw new Error('Missing selected zone!');
						// Start creating a new region to replace the existing one.
						// We don't delete the existing one first so if they back out
						// of creating the new one, it just keeps the old one.
						// If they finish the new region, it will replace the old one.
						this.panels.zoningMenu.createRegion(this.isStartZone(this.selectedZone.zone));
						this.setInfoPanelShown(true);
					},
					$.Localize('#Zoning_Cancel'),
					() => {},
					'none'
				);
			}
		} else {
			// It is safe to delete just this region
			const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
			this.selectedZone.zone?.regions.splice(index, 1);
			this.panels.regionSelect.SetSelectedIndex(0);
			this.populateRegionProperties();

			this.drawZones();
		}
	}

	teleportToRegion() {
		if (!this.selectedZone || !this.selectedRegion) return;

		this.panels.zoningMenu.moveToRegion(this.selectedRegion);
	}

	pickCorners() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.CORNER);
		this.setInfoPanelShown(true);
	}

	pickBottom() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.BOTTOM);
		this.setInfoPanelShown(true);
	}

	setRegionBottom() {
		if (!this.selectedZone || !this.selectedRegion) return;

		const bottom = Number.parseFloat(this.panels.regionBottom.text);
		this.selectedRegion.bottom = Number.isNaN(bottom) ? 0 : bottom;

		this.drawZones();
	}

	pickHeight() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.HEIGHT);
		this.setInfoPanelShown(true);
	}

	setRegionHeight() {
		if (!this.selectedZone || !this.selectedRegion) return;

		const height = Number.parseFloat(this.panels.regionHeight.text);
		this.selectedRegion.height = Number.isNaN(height) ? 0 : height;

		this.drawZones();
	}

	pickSafeHeight() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.SAFE_HEIGHT);
		this.setInfoPanelShown(true);
	}

	setRegionSafeHeight() {
		if (!this.selectedZone || !this.selectedRegion) return;

		const height = Number.parseFloat(this.panels.regionSafeHeight.text);
		this.selectedRegion.safeHeight = Number.isNaN(height) ? 0 : height;

		this.drawZones();
	}

	pickTeleDestPos() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.TELE_DEST_POS);
		this.setInfoPanelShown(true);
	}

	pickTeleDestYaw() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.TELE_DEST_YAW);
		this.setInfoPanelShown(true);
	}

	onTPDestSelectionChanged() {
		if (!this.selectedZone || !this.selectedRegion || !this.teleDestList) return;

		const teleDestIndex = this.panels.regionTPDest.GetSelected()?.GetAttributeInt('value', 0);
		if (teleDestIndex === 0) {
			// user is requesting no teleport destination for this region
			this.selectedRegion.teleDestTargetname = '';
			delete this.selectedRegion.teleDestPos;
			delete this.selectedRegion.teleDestYaw;

			this.setRegionTPDestTextEntriesActive(false);
		} else if (teleDestIndex === 1 && this.selectedRegion.points?.length > 0) {
			// user is requesting to place a TP destination at some location (not entity)
			if (this.selectedRegion.teleDestPos === undefined || this.selectedRegion.teleDestYaw === undefined) {
				this.selectedRegion.teleDestTargetname = '';
				const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
				if (index !== -1)
					this.selectedZone.zone.regions[index] = this.panels.zoningMenu.createDefaultTeleDest(
						this.selectedRegion
					);

				this.selectedRegion = this.selectedZone.zone.regions[index];
				this.pickTeleDestPos();
			}

			this.panels.regionTPPos.x.text = this.selectedRegion.teleDestPos?.at(0)?.toFixed(2) ?? '';
			this.panels.regionTPPos.y.text = this.selectedRegion.teleDestPos?.at(1)?.toFixed(2) ?? '';
			this.panels.regionTPPos.z.text = this.selectedRegion.teleDestPos?.at(2)?.toFixed(2) ?? '';
			this.panels.regionTPYaw.text = this.selectedRegion.teleDestYaw?.toFixed(2) ?? '';

			this.setRegionTPDestTextEntriesActive(true);
		} else {
			// user is requesting to use an entity as the TP destination
			this.selectedRegion.teleDestTargetname = this.teleDestList[teleDestIndex];
			delete this.selectedRegion.teleDestPos;
			delete this.selectedRegion.teleDestYaw;

			this.setRegionTPDestTextEntriesActive(false);
		}

		this.drawZones();
	}

	setRegionTeleDestOrientation() {
		if (!this.selectedZone || !this.selectedRegion) return;

		const x = Number.parseFloat(this.panels.regionTPPos.x.text);
		const y = Number.parseFloat(this.panels.regionTPPos.y.text);
		const z = Number.parseFloat(this.panels.regionTPPos.z.text);
		const yaw = Number.parseFloat(this.panels.regionTPYaw.text);

		this.selectedRegion.teleDestPos = [
			Number.isNaN(x) ? undefined : x,
			Number.isNaN(y) ? undefined : y,
			Number.isNaN(z) ? undefined : z
		];
		this.selectedRegion.teleDestYaw = Number.isNaN(yaw) ? undefined : yaw;

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
		if (this.selectedZone.globalRegion?.index != null) {
			this.selectedZone.globalRegion.regions[this.selectedZone.globalRegion.index] = newRegion;
		} else if (this.selectedZone.zone) {
			const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
			if (index !== -1) this.selectedZone.zone.regions[index] = newRegion;
		} else {
			return;
		}

		this.setInfoPanelShown(false);
		this.drawZones();
	}

	onRegionEditCanceled() {
		this.setInfoPanelShown(false);

		if (this.selectedZone.globalRegion?.index != null) {
			this.deleteSelection();
		} else if (this.selectedRegion?.points.length === 0) {
			this.deleteRegion();
		}

		this.drawZones();
	}

	setInfoPanelShown(show: boolean) {
		this.panels.propertiesPanel.SetHasClass('hide', show);
		this.panels.infoPanel.SetHasClass('hide', !show);

		if (!show) {
			this.populateRegionProperties();
		}
	}

	createMain() {
		if (!this.mapZoneData || Boolean(this.mapZoneData.tracks.main)) return;

		this.mapZoneData.tracks.main = {
			zones: {
				segments: [this.createSegment()],
				end: {}
			},
			stagesEndAtStageStarts: true
		};

		this.updateSelection({
			track: this.mapZoneData.tracks.main,
			segment: this.mapZoneData.tracks.main.zones.segments[0],
			zone: this.mapZoneData.tracks.main.zones.segments[0].checkpoints[0]
		});

		this.panels.zoningMenu.createRegion(true);
		this.setInfoPanelShown(true);
	}

	addBonus(defragBonus = false, index = null) {
		if (!this.mapZoneData) return;

		const bonus = defragBonus ? { defragModifiers: 1 } : this.createBonusTrack();

		if (!this.mapZoneData.tracks.bonuses) {
			this.mapZoneData.tracks.bonuses = [];
		}

		if (index != null && index < this.mapZoneData.tracks.bonuses.length) {
			this.mapZoneData.tracks.bonuses.splice(Math.max(index, 0), 0, bonus);
		} else {
			this.mapZoneData.tracks.bonuses.push(bonus);
		}

		if (defragBonus) {
			this.updateSelection({ track: bonus });
			this.showDefragFlagMenu();
		} else {
			this.updateSelection({
				track: bonus,
				segment: bonus.zones.segments[0],
				zone: bonus.zones.segments[0].checkpoints[0]
			});

			this.panels.zoningMenu.createRegion(true);
			this.setInfoPanelShown(true);
		}
	}

	addSegment() {
		if (!this.mapZoneData) return;
		if (!this.selectedZone.track || !this.isMainTrack(this.selectedZone.track)) return;

		const newSegment = this.createSegment();

		if (!this.selectedZone.track.zones.segments) {
			this.selectedZone.track.zones.segments = [newSegment];
		} else {
			this.selectedZone.track.zones.segments.push(newSegment);
		}

		this.updateSelection({ track: this.selectedZone.track, segment: newSegment, zone: newSegment.checkpoints[0] });

		this.panels.zoningMenu.createRegion(true);
		this.setInfoPanelShown(true);
	}

	addCheckpoint(index = null) {
		if (!this.mapZoneData) return;
		if (!this.selectedZone.track) throw new Error('Attempted to add checkpoint zone to missing track!');
		if (!this.selectedZone.segment) throw new Error('Attempted to add checkpoint zone to missing segment!');
		if (this.isDefragBonus(this.selectedZone.track))
			throw new Error('Defrag Bonus must share zones with Main track!');

		const newZone = this.createZone();

		if (!this.selectedZone.segment.checkpoints) {
			this.selectedZone.segment.checkpoints = [];
		}

		if (index != null && index < this.selectedZone.segment.checkpoints.length) {
			this.selectedZone.segment.checkpoints.splice(Math.max(index, 0), 0, newZone);
		} else {
			this.selectedZone.segment.checkpoints.push(newZone);
		}

		this.updateSelection({ track: this.selectedZone.track, segment: this.selectedZone.segment, zone: newZone });

		this.panels.zoningMenu.createRegion(this.isStartZone(newZone));
		this.setInfoPanelShown(true);
	}

	addEndZone() {
		if (!this.mapZoneData || !this.hasSelectedTrack()) return;
		if (this.isDefragBonus(this.selectedZone.track)) {
			throw new Error('Defrag Bonus must share zones with Main track!');
		}

		const endZone = this.createZone();
		this.selectedZone.track.zones!.end = endZone;

		this.updateSelection({ track: this.selectedZone.track, zone: endZone });

		this.panels.zoningMenu.createRegion(false);
		this.setInfoPanelShown(true);
	}

	addCancelZone() {
		if (!this.mapZoneData) return;
		if (!this.selectedZone.track) throw new Error('Attempted to add checkpoint zone to missing track!');
		if (!this.selectedZone.segment) throw new Error('Attempted to add checkpoint zone to missing segment!');
		if (this.isDefragBonus(this.selectedZone.track))
			throw new Error('Defrag Bonus must share zones with Main track!');

		const newZone = this.createZone();

		if (!this.selectedZone.segment.cancel) {
			this.selectedZone.segment.cancel = [];
		}

		this.selectedZone.segment.cancel.push(newZone);

		this.updateSelection({ track: this.selectedZone.track, segment: this.selectedZone.segment, zone: newZone });

		this.panels.zoningMenu.createRegion(false);
		this.setInfoPanelShown(true);
	}

	addGlobalRegion() {
		if (!this.mapZoneData) return;
		if (!this.selectedZone.globalRegion?.regions) return;

		this.selectedZone.globalRegion.regions.push(this.createRegion());

		this.updateSelection({
			globalRegion: {
				...this.selectedZone.globalRegion,
				index: this.selectedZone.globalRegion.regions.length - 1
			}
		});

		this.panels.zoningMenu.createRegion(false);
		this.setInfoPanelShown(true);
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

		let cascadeDelete = false;

		if (this.selectedZone.track && this.selectedZone.segment && this.selectedZone.zone) {
			// Delete zone within segment
			cascadeDelete = this.deletingSelectedZoneCascadesToSegment();

			const checkpointIndex = this.selectedZone.segment.checkpoints.indexOf(this.selectedZone.zone);
			if (checkpointIndex === -1) {
				const cancelIndex = this.selectedZone.segment.cancel?.indexOf(this.selectedZone.zone);
				if (cancelIndex !== undefined && cancelIndex !== -1) {
					// Zone is a cancel zone
					this.selectedZone.segment.cancel!.splice(cancelIndex, 1);
					this.updateSelection({
						track: this.selectedZone.track,
						segment: this.selectedZone.segment
					});
				}
			} else {
				// Zone is a checkpoint
				this.selectedZone.segment.checkpoints.splice(checkpointIndex, 1);
				this.updateSelection({
					track: this.selectedZone.track,
					segment: this.selectedZone.segment
				});
			}
		} else if (this.selectedZone.track && this.selectedZone.segment) {
			// Delete segment
			cascadeDelete = this.deletingSelectedSegmentCascadesToTrack();

			const index = this.selectedZone.track.zones.segments.indexOf(this.selectedZone.segment);
			this.selectedZone.track.zones.segments.splice(index, 1);
			this.updateSelection({ track: this.selectedZone.track });
		} else if (this.selectedZone.track && this.selectedZone.zone) {
			// Delete zone within a track but not a segment (only applies to end zone)
			cascadeDelete = this.deletingSelectedZoneCascadesToSegment();

			if (this.selectedZone.zone === this.selectedZone.track.zones.end) {
				this.selectedZone.track.zones.end = {};
				this.updateSelection({ track: this.selectedZone.track });
			}
		} else if (this.selectedZone.track) {
			if (this.hasSelectedMainTrack()) {
				delete this.mapZoneData.tracks.main;
				this.updateSelection({});
			} else if (this.hasSelectedBonusTrack()) {
				const trackIndex = this.mapZoneData.tracks.bonuses!.indexOf(this.selectedZone.track);
				if (trackIndex !== undefined && trackIndex !== -1) {
					this.mapZoneData.tracks.bonuses!.splice(trackIndex, 1);
					this.updateSelection({});
				}
			}
		} else if (this.selectedZone.globalRegion?.index != null) {
			this.selectedZone.globalRegion.regions.splice(this.selectedZone.globalRegion.index, 1);
			const newSelection = { globalRegion: { ...this.selectedZone.globalRegion } };
			delete newSelection.globalRegion.index;
			this.updateSelection(newSelection);
		}

		if (cascadeDelete) {
			this.deleteSelection();
		}
	}

	setMaxVelocity() {
		if (!this.mapZoneData) return;
		const velocity = Number.parseFloat(this.panels.maxVelocity.text);
		this.mapZoneData.maxVelocity = !Number.isNaN(velocity) && velocity > 0 ? velocity : 0;
	}

	setStageEndAtStageStarts() {
		if (!this.hasSelectedMainTrack()) return;
		this.selectedZone.track.stagesEndAtStageStarts = this.panels.stagesEndAtStageStarts.checked;
	}

	showDefragFlagMenu() {
		if (!this.hasSelectedDefragBonus()) return;

		this.editorDefragModifiers = this.selectedZone.track.defragModifiers;

		const flagEditMenu = UiToolkitAPI.ShowCustomLayoutContextMenuParametersDismissEvent<Panel>(
			this.panels.defragModifiers.id,
			'',
			'file://{resources}/layout/modals/context-menus/zoning-df-flags.xml',
			'',
			() => {
				if (this.editorDefragModifiers === 0) {
					UiToolkitAPI.ShowGenericPopupOk(
						$.Localize('#Zoning_Error'),
						$.Localize('#Zoning_DefragBonusMustHaveModifiers'),
						'generic-popup',
						() => {
							this.showDefragFlagMenu();
						}
					);
				} else {
					this.selectedZone.track.defragModifiers = this.editorDefragModifiers;
				}
			}
		);

		const flags = {
			FlagHaste: DefragFlags.HASTE,
			FlagSlick: DefragFlags.SLICK,
			FlagDamageBoost: DefragFlags.DAMAGEBOOST,
			FlagRockets: DefragFlags.ROCKETS,
			FlagPlasma: DefragFlags.PLASMA,
			FlagBFG: DefragFlags.BFG
		};

		for (const [panelId, flag] of Object.entries(flags)) {
			const flagPanel = flagEditMenu.FindChildTraverse<Panel>(panelId)!;
			flagPanel.checked = (this.selectedZone.track.defragModifiers! & flag) !== 0;
			flagPanel.SetPanelEvent('onactivate', () => {
				if (flagPanel.checked) {
					this.editorDefragModifiers |= flag;
				} else {
					this.editorDefragModifiers &= ~flag;
				}
			});
		}
	}

	setBhopEnabled() {
		if (!this.hasSelectedMainTrack() || !this.hasSelectedBonusTrack()) return;
		this.selectedZone.track.bhopEnabled = this.panels.bhopEnabled.checked;
	}

	setLimitGroundSpeed() {
		if (!this.hasSelectedSegment()) return;
		this.selectedZone.segment!.limitStartGroundSpeed = this.panels.limitGroundSpeed.checked;
	}

	setCheckpointsOrdered() {
		if (!this.hasSelectedSegment()) return;
		this.selectedZone.segment!.checkpointsOrdered = this.panels.checkpointsOrdered.checked;
	}

	setCheckpointsRequired() {
		if (!this.hasSelectedSegment()) return;
		this.selectedZone.segment!.checkpointsRequired = this.panels.checkpointsRequired.checked;
	}

	setSegmentName() {
		if (!this.hasSelectedSegment()) return;
		this.selectedZone.segment!.name = this.panels.segmentName.text;
		// feat: later
		// update segment name in trasklist tree
	}

	drawZones() {
		if (!this.mapZoneData || !this.selectedZone) return;

		const renderRegions: ZoneEditorRegion[] = [];
		const track = this.hasSelectedDefragBonus() ? this.mapZoneData.tracks.main : this.selectedZone.track;
		// draw track containing selected zone (if one exists)
		for (const [segmentNumber, segment] of track?.zones?.segments?.entries() ?? []) {
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
						editing: this.hasSelectedZone() && region === this.selectedRegion
					});
				}
			}
			for (const cancel of segment?.cancel ?? []) {
				for (const region of cancel.regions) {
					renderRegions.push({
						region: region,
						renderMode: RegionRenderMode.CANCEL,
						editing: this.hasSelectedZone() && region === this.selectedRegion
					});
				}
			}
		}
		for (const region of track?.zones?.end?.regions ?? []) {
			renderRegions.push({
				region: region,
				renderMode: RegionRenderMode.END,
				editing: this.hasSelectedZone() && region === this.selectedRegion
			});
		}

		// draw global regions
		for (const region of this.mapZoneData.globalRegions?.allowBhop ?? []) {
			renderRegions.push({
				region: region,
				renderMode: RegionRenderMode.NONE,
				editing: region === this.selectedRegion
			});
		}
		for (const region of this.mapZoneData.globalRegions?.cancel ?? []) {
			renderRegions.push({
				region: region,
				renderMode: RegionRenderMode.CANCEL,
				editing: region === this.selectedRegion
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
		this.mapZoneData = null;

		MomentumTimerAPI.LoadZoneDefs(false);

		this.updateSelection({});
	}

	isStartZone(zone: Zone | null): boolean {
		if (!zone || !this.mapZoneData) return false;
		const { main, bonuses } = this.mapZoneData.tracks;

		return (
			(main?.zones.segments.some?.((segment) => segment.checkpoints?.at(0) === zone) ?? false) ||
			(bonuses?.some?.((bonus) => bonus.zones?.segments?.at(0)?.checkpoints?.at(0) === zone) ?? false)
		);
	}

	hasSelectedTrack(): this is { selectedZone: { track: MainTrack | BonusTrack } } {
		return this.selectedZone.track != null;
	}

	hasSelectedMainTrack(): this is { selectedZone: { track: MainTrack } } {
		return this.selectedZone.track && this.isMainTrack(this.selectedZone.track);
	}

	isMainTrack(track: MainTrack | BonusTrack): track is MainTrack {
		return Boolean(this.mapZoneData.tracks.main) && track === this.mapZoneData.tracks.main;
	}

	hasSelectedBonusTrack() {
		return (
			this.selectedZone.track !== null &&
			this.selectedZone.track !== this.mapZoneData?.tracks.main &&
			(this.mapZoneData?.tracks.bonuses?.includes(this.selectedZone.track) ?? false)
		);
	}

	isBonusTrack(track: MainTrack | BonusTrack) {
		return (
			track !== null &&
			track !== this.mapZoneData?.tracks.main &&
			(this.mapZoneData?.tracks.bonuses?.includes(track) ?? false)
		);
	}

	hasSelectedSegment(): this is { selectedZone: { segment: Segment }; track: MainTrack | BonusTrack } {
		return this.selectedZone.segment != null && this.selectedZone.track != null;
	}

	hasSelectedZone(): this is { selectedZone: { zone: Zone }; track: MainTrack | BonusTrack } {
		return this.selectedZone.zone != null && this.selectedZone.track != null;
	}

	hasSelectedDefragBonus(): this is { selectedZone: { track: { zones: undefined; defragModifiers: number } } } {
		return (
			this.hasSelectedBonusTrack() &&
			(this.selectedZone.track.zones == null ||
				('defragModifiers' in this.selectedZone.track && this.selectedZone.track.defragModifiers !== 0))
		);
	}

	isDefragBonus(track: MainTrack | BonusTrack): track is { zones: undefined; defragModifiers: number } {
		return (
			this.isBonusTrack(track) &&
			(track.zones == null || ('defragModifiers' in track && track.defragModifiers !== 0))
		);
	}
}
