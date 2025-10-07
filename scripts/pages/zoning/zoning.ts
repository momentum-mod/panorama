import { BonusTrack, Gamemode, MainTrack, MapZones, Region, Segment, Zone } from 'common/web_dontmodifyme';
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
	HEIGHT = 2,
	SAFE_HEIGHT = 3,
	TELE_DEST_POS = 4,
	TELE_DEST_YAW = 5
}

export enum RegionRenderMode {
	NONE = 0,
	START = 1,
	START_WITH_SAFE_HEIGHT = 2,
	TRACK_SWITCH = 3,
	END = 4,
	MAJOR_CHECKPOINT = 5,
	MINOR_CHECKPOINT = 6,
	CANCEL = 7,
	ALLOW_BHOP = 8,
	OVERBOUNCE = 9
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
	CANCEL_TIMER = 2,
	OVERBOUNCE = 3
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

		selectionLists: {
			left: $<Panel>('#LeftList')!,
			center: $<Panel>('#CenterList')!,
			right: $<Panel>('#RightList')!
		},

		createMainButton: $<Button>('#CreateMainButton')!,
		addBonusButton: $<Button>('#AddBonusButton')!,
		addDefragBonusButton: $<Button>('#AddDefragBonusButton')!,
		addSegmentButton: $<Button>('#AddSegmentButton')!,
		addEndZoneButton: $<Button>('#AddEndZoneButton')!,
		addCheckpointButton: $<Button>('#AddCheckpointButton')!,
		addCheckpointButtonLabel: $<Label>('#AddCheckpointButtonLabel')!,
		addCancelZoneButton: $<Button>('#AddCancelZoneButton')!,
		addGlobalRegionButton: $<Button>('#AddGlobalRegionButton')!,

		propertiesLabel: $<Label>('#PropertiesLabel')!,
		propertiesPanel: $<Panel>('#PropertiesContainer')!,
		propertiesTrack: $<Panel>('#TrackProperties')!,
		maxVelocity: $<TextEntry>('#MaxVelocity')!,
		defragModifiers: $<Panel>('#DefragFlags')!,
		stagesEndAtStageStarts: $('#StagesEndAtStageStarts')!.FindChild<ToggleButton>('CheckBox')!,
		bhopEnabled: $('#BhopEnabled'),
		bhopEnabledCheckbox: $('#BhopEnabled')!.FindChild<ToggleButton>('CheckBox')!,
		propertiesSegment: $<Panel>('#SegmentProperties')!,
		limitGroundSpeed: $('#LimitGroundSpeed')!.FindChild<ToggleButton>('CheckBox')!,
		checkpointsRequired: $('#CheckpointsRequired')!.FindChild<ToggleButton>('CheckBox')!,
		checkpointsOrdered: $('#CheckpointsOrdered')!.FindChild<ToggleButton>('CheckBox')!,
		segmentName: $<TextEntry>('#SegmentName')!,
		propertiesZone: $<Panel>('#ZoneProperties')!,
		infoPanel: $<Panel>('#InfoPanel')!,
		selectionMode: $<Label>('#SelectionMode')!,
		filterSelect: $<DropDown>('#FilterSelect')!,
		regionProperties: $<Panel>('#RegionProperties')!,
		regionSelect: $<DropDown>('#RegionSelect')!,
		regionCountLabel: $<Label>('#RegionCountLabel')!,
		regionHeight: $<TextEntry>('#RegionHeight')!,

		regionSafeHeightSection: $<Panel>('#RegionSafeHeightSection')!,
		regionSafeHeightBase: $<RadioButton>('#RegionSafeHeight_Base')!,
		regionSafeHeightFullHeight: $<RadioButton>('#RegionSafeHeight_FullHeight')!,
		regionSafeHeightCustom: $<RadioButton>('#RegionSafeHeight_Custom')!,
		regionSafeHeightCustomProperties: $<TextEntry>('#RegionSafeHeight_Custom_Properties')!,
		regionSafeHeight: $<TextEntry>('#RegionSafeHeight')!,

		regionTPDestNone: $<RadioButton>('#RegionTPDest_None')!,
		regionTPDestEntity: $<RadioButton>('#RegionTPDest_Entity')!,
		regionTPDestCustom: $<RadioButton>('#RegionTPDest_Custom')!,

		regionTPDestEntityProperties: $<Panel>('#RegionTPDest_Entity_Properties')!,
		regionTPDestEntityList: $<DropDown>('#RegionTPDest_EntityList')!,

		regionTPDestCustomProperties: $<Panel>('#RegionTPDest_Custom_Properties')!,
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
	selectedHierarchyNames: string[] = [];

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
		this.populateDropdown(this.panels.filterSelect, this.filternameList);

		this.teleDestList = entList.teleport ?? [];
		this.populateDropdown(this.panels.regionTPDestEntityList, this.teleDestList);

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
				if (this.isDefragBonus(selectionWhenActivated.track)) {
					region = this.mapZoneData.tracks?.main.zones.segments[0].checkpoints[0].regions[0];
				} else {
					region = selectionWhenActivated.track.zones.segments[0].checkpoints[0].regions[0];
				}
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
			this.selectedHierarchyNames.push(label);

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

		const oldScrollOffset = {};

		// Record the current scroll position. If the panel is overflowing,
		// this will be used to match the scroll position after updating list panels
		for (const [listKey, panel] of Object.entries(this.panels.selectionLists)) {
			oldScrollOffset[listKey] = panel.GetParent()!.scrolloffset_y ?? 0;
		}

		this.panels.selectionLists.left.RemoveAndDeleteChildren();
		this.panels.selectionLists.center.RemoveAndDeleteChildren();
		this.panels.selectionLists.right.RemoveAndDeleteChildren();

		this.selectedHierarchyNames = [];

		if (this.mapZoneData.tracks.main) {
			this.addItemListItem(
				this.panels.selectionLists.left,
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
				this.panels.selectionLists.left,
				`${bonusTag} ${i + 1}`,
				bonus,
				ItemType.TRACK,
				selectionObj
			);

			item.SetPanelEvent('oncontextmenu', () => {
				if (!this.mayAddBonus()) {
					return;
				}

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
			this.panels.selectionLists.left,
			$.Localize('#Zoning_GlobalRegions'),
			GlobalRegionType.TYPES_LIST,
			ItemType.GLOBAL_REGION_TYPE,
			{ globalRegion: { type: GlobalRegionType.TYPES_LIST } }
		);

		this.rebuildCenterList();
		this.rebuildRightList();

		if (this.selectedHierarchyNames.length > 0) {
			this.panels.propertiesLabel.text = `(${this.selectedHierarchyNames.join(' > ')})`;
		} else {
			this.panels.propertiesLabel.text = '';
		}

		const regionCount = this.getTotalRegionCount();

		this.panels.createMainButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS || Boolean(this.mapZoneData.tracks.main)
		);

		this.panels.addBonusButton.SetHasClass('hide', !this.mayAddBonus(regionCount));

		this.panels.addDefragBonusButton.SetHasClass(
			'hide',
			!this.mayAddBonus(regionCount) ||
				!this.mapZoneData.tracks.main ||
				this.mapZoneData.tracks.main.zones.segments.length !== 1
		);

		this.panels.addSegmentButton.SetHasClass('hide', !this.mayAddSegment(regionCount));

		this.panels.addEndZoneButton.SetHasClass(
			'hide',
			regionCount >= this.zoningLimits.MAX_REGIONS ||
				!this.selectedZone.track ||
				(this.selectedZone.track.zones?.segments ?? []).length === 0 ||
				(this.selectedZone.track.zones.segments[0].checkpoints ?? []).length === 0 || // require making a start zone first
				Boolean(this.selectedZone.track?.zones?.end.regions?.length > 0)
		);

		this.panels.addCheckpointButton.SetHasClass('hide', !this.mayAddCheckpoint(regionCount));

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

		// Restore scroll offset recorded before lists were rebuilt
		for (const [listKey, panel] of Object.entries(this.panels.selectionLists)) {
			const scrollParent = panel.GetParent()!;
			if (oldScrollOffset[listKey] <= 0) {
				scrollParent.ScrollToFitRegion(
					0,
					0,
					-oldScrollOffset[listKey],
					scrollParent.actuallayoutheight - oldScrollOffset[listKey],
					ScrollBehavior.SCROLL_TO_TOPLEFT_EDGE,
					false,
					true
				);
			}
		}
	}

	rebuildCenterList() {
		this.panels.selectionLists.center.RemoveAndDeleteChildren();

		if (this.selectedZone.globalRegion != null) {
			const types = [
				['#Zoning_AllowBhopZone', GlobalRegionType.ALLOW_BHOP, 'allowBhop'] as const,
				['#Zoning_CancelZone', GlobalRegionType.CANCEL_TIMER, 'cancel'] as const,
				['#Zoning_OverbounceZone', GlobalRegionType.OVERBOUNCE, 'overbounce'] as const
			];

			this.mapZoneData.globalRegions = this.mapZoneData.globalRegions || {};

			for (const [text, type, regionsKey] of types) {
				this.mapZoneData.globalRegions[regionsKey] = this.mapZoneData.globalRegions[regionsKey] || [];
				this.addItemListItem(
					this.panels.selectionLists.center,
					$.Localize(text),
					type,
					ItemType.GLOBAL_REGION_TYPE,
					{
						globalRegion: { type: type, regions: this.mapZoneData.globalRegions[regionsKey] }
					}
				);
			}

			return;
		}

		if (!this.selectedZone.track) return;

		const segmentTag = $.Localize('#Zoning_Segment');

		for (const [i, segment] of this.selectedZone.track.zones?.segments?.entries() ?? []) {
			const majorId = segment.name || `${segmentTag} ${i + 1}`;

			const selectionObj = { track: this.selectedZone.track, segment: segment };

			const item = this.addItemListItem(
				this.panels.selectionLists.center,
				majorId,
				segment,
				ItemType.SEGMENT,
				selectionObj
			);

			item.SetPanelEvent('oncontextmenu', () => {
				if (!this.mayAddSegment()) {
					return;
				}

				const insertSegment = (before) => {
					// Select this one first for the context of where to add the new one
					this.updateSelection(selectionObj);
					this.addSegment(before ? i : i + 1);
				};

				const contextItems = [
					{
						label: '#Zoning_InsertSegmentBefore',
						jsCallback: () => insertSegment(true)
					},
					{
						label: '#Zoning_InsertSegmentAfter',
						jsCallback: () => insertSegment(false)
					}
				];

				UiToolkitAPI.ShowSimpleContextMenu('', '', contextItems);
			});
		}

		if (this.selectedZone.track.zones?.end.regions?.length > 0) {
			this.addItemListItem(
				this.panels.selectionLists.center,
				$.Localize('#Zoning_EndZone'),
				this.selectedZone.track.zones.end,
				ItemType.ZONE,
				{ track: this.selectedZone.track, zone: this.selectedZone.track.zones.end }
			);
		}
	}

	rebuildRightList() {
		this.panels.selectionLists.right.RemoveAndDeleteChildren();

		if (
			this.selectedZone.globalRegion?.type != null &&
			this.selectedZone.globalRegion.type !== GlobalRegionType.TYPES_LIST
		) {
			for (const [i, region] of this.selectedZone.globalRegion.regions.entries()) {
				this.addItemListItem(
					this.panels.selectionLists.right,
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

			const item = this.addItemListItem(
				this.panels.selectionLists.right,
				minorId,
				zone,
				ItemType.ZONE,
				selectionObj
			);

			item.SetPanelEvent('oncontextmenu', () => {
				if (!this.mayAddCheckpoint()) {
					return;
				}

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

			this.addItemListItem(this.panels.selectionLists.right, `${cancelTag} ${i + 1}`, zone, ItemType.ZONE, {
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
			limitStartGroundSpeed: GameModeAPI.GetCurrentGameMode() === Gamemode.SURF,
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
			height: DEFAULT_HEIGHT
		};
	}

	addOptionToDropdown(parent: DropDown, label: string, index: number) {
		const optionPanel = $.CreatePanel('Label', parent.AccessDropDownMenu(), label);
		optionPanel.SetAttributeInt('value', index);
		optionPanel.text = label;
		parent.AddOption(optionPanel);
	}

	populateDropdown(dropdown: DropDown, strings: string[]) {
		dropdown.RemoveAllOptions();

		for (const [i, item] of strings.entries()) {
			this.addOptionToDropdown(dropdown, item, i);
		}
	}

	updateSelection(newSelection: ZoneSelection) {
		if (!this.didInit) {
			// Initialize now if this handler was reloaded while on a map
			this.initialize();
		}

		this.selectedZone = newSelection;
		this.selectedRegion = null; // this is set in populateRegionProperties()

		this.panels.propertiesTrack.visible = false;
		this.panels.propertiesSegment.visible = false;
		this.panels.propertiesZone.visible = false;

		if (newSelection.globalRegion?.index >= 0) {
			this.panels.propertiesZone.visible = true;
			this.populateRegionProperties();
		} else if (this.hasSelectedZone()) {
			this.panels.propertiesZone.visible = true;
			this.panels.regionSelect.SetSelectedIndex(0);
			this.populateZoneProperties(true);
		} else if (this.hasSelectedSegment()) {
			this.panels.propertiesSegment.visible = true;
			this.populateSegmentProperties();
		} else if (this.hasSelectedTrack()) {
			this.panels.propertiesTrack.visible = true;
			this.populateTrackProperties();
		}

		this.rebuildLists();

		this.updateEditorRegions();
	}

	populateZoneProperties(newSelection) {
		if (!this.mapZoneData) return;

		if (this.hasSelectedZone()) {
			const zone = this.selectedZone.zone;
			const filterIndex = zone.filtername ? (this.filternameList?.indexOf(zone.filtername) ?? 0) : 0;
			this.panels.filterSelect.SetSelectedIndex(filterIndex);
			const regionNumbers = [];
			for (let i = 0; i < zone.regions.length; i++) {
				regionNumbers.push(`${i + 1}`);
			}

			if (newSelection) {
				this.populateDropdown(this.panels.regionSelect, regionNumbers);
				this.panels.regionSelect.SetSelectedIndex(0);
			}

			this.panels.regionCountLabel.text = `/ ${zone.regions.length}`;
		}

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
		this.panels.bhopEnabled.visible = !this.hasSelectedDefragBonus();
		this.panels.maxVelocity.text =
			this.mapZoneData.maxVelocity === undefined ? '' : this.mapZoneData.maxVelocity.toFixed(0);
		this.panels.bhopEnabledCheckbox.checked = track.bhopEnabled ?? false;
	}

	updateZoneFilter() {
		if (!this.selectedZone || !this.selectedZone.zone || !this.filternameList) return;

		const filterIndex = this.panels.filterSelect.GetSelected()?.GetAttributeInt('value', 0);
		this.selectedZone.zone.filtername = filterIndex ? this.filternameList[filterIndex] : '';
	}

	populateRegionProperties() {
		let region = null;

		// These controls should only be shown for zones, not global regions.
		// Some of these may also be selectively hidden below
		this.panels.propertiesZone.FindChildrenWithClassTraverse('not-global-region').forEach((panel) => {
			panel.visible = this.selectedZone.zone != null;
		});

		if (this.selectedZone.zone) {
			if (!this.teleDestList) return;

			const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
			if (index === -1) return;

			region = this.selectedZone.zone.regions[index];

			this.panels.regionSafeHeight.text = '';

			// Safe height currently only pertains to priming, so only show it for start zones
			this.panels.regionSafeHeightSection.visible = this.isStartZone(this.selectedZone.zone);

			this.panels.regionSafeHeightCustomProperties.visible = false;

			switch (region.safeHeight) {
				case 0:
					this.panels.regionSafeHeightBase.SetSelected(true);
					break;
				case -1:
					this.panels.regionSafeHeightFullHeight.SetSelected(true);
					break;
				default:
					this.panels.regionSafeHeightCustom.SetSelected(true);
					this.panels.regionSafeHeight.text = region.safeHeight?.toFixed(2) ?? '';
					this.panels.regionSafeHeightCustomProperties.visible = true;
					break;
			}

			this.panels.regionTPDestNone.enabled = !this.isStartZone(this.selectedZone.zone);

			this.panels.regionTPDestEntityProperties.visible = false;
			this.panels.regionTPDestCustomProperties.visible = false;

			if (region?.teleDestTargetname) {
				// entity tp dest
				this.panels.regionTPDestEntity.SetSelected(true);
				this.panels.regionTPDestEntityProperties.visible = true;
				this.panels.regionTPDestEntityList.SetSelectedIndex(
					this.teleDestList?.indexOf(region?.teleDestTargetname)
				);
			} else if (region?.teleDestPos) {
				// custom tp dest
				this.panels.regionTPDestCustom.SetSelected(true);
				this.panels.regionTPDestCustomProperties.visible = true;
				this.panels.regionTPPos.x.text = region.teleDestPos?.at(0)?.toFixed(2) ?? '';
				this.panels.regionTPPos.y.text = region.teleDestPos?.at(1)?.toFixed(2) ?? '';
				this.panels.regionTPPos.z.text = region.teleDestPos?.at(2)?.toFixed(2) ?? '';
				this.panels.regionTPYaw.text = region.teleDestYaw?.toFixed(0) ?? '';
			} else {
				// no tp dest
				this.panels.regionTPDestNone.SetSelected(true);
			}
		} else if (this.selectedZone.globalRegion?.index >= 0) {
			region = this.selectedZone.globalRegion.regions[this.selectedZone.globalRegion.index];
		}

		if (!region) return;

		// Indent region properties for zone regions so they appear as subitems of the region selection
		this.panels.regionProperties.SetHasClass('zoning__property-inset', this.selectedZone.zone != null);

		// Controls used by zone regions and global regions
		this.panels.regionHeight.text = region?.height?.toFixed(2) ?? '';

		this.selectedRegion = region;
		this.updateEditorRegions();
	}

	addRegion() {
		if (!this.selectedZone || !this.selectedZone.zone) return;

		const newRegion = this.createRegion();

		this.selectedZone.zone.regions.push(newRegion);

		const regionNumbers = [];
		for (let i = 0; i < this.selectedZone.zone.regions.length; i++) {
			regionNumbers.push(`${i + 1}`);
		}
		this.populateDropdown(this.panels.regionSelect, regionNumbers);
		this.panels.regionSelect.SetSelectedIndex(this.selectedZone.zone.regions.length - 1);

		// Be careful around this logic, this is really fiddly...
		// Here we update the value of selectedRegion and then push that
		this.populateRegionProperties();
		this.updateEditorRegions();

		if (this.selectedRegion !== newRegion) throw new Error('New region is not selected');

		this.panels.zoningMenu.createRegion(this.isStartZone(this.selectedZone.zone));

		this.setInfoPanelShown(true);
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
			this.populateZoneProperties(true);
			this.panels.regionSelect.SetSelectedIndex(Math.max(index - 1, 0));
			this.populateRegionProperties();

			this.updateEditorRegions();
		}
	}

	teleportToRegion() {
		if (!this.selectedZone || !this.selectedRegion) return;

		this.panels.zoningMenu.moveToRegion(this.selectedRegion);
	}

	previewTeleDest() {
		if (!this.selectedZone || !this.selectedRegion) return;

		this.panels.zoningMenu.previewTeleDest(this.selectedRegion);
	}

	pickCorners() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.CORNER);
		this.setInfoPanelShown(true);
	}

	pickHeight() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.HEIGHT);
		this.setInfoPanelShown(true);
	}

	setRegionHeight() {
		if (!this.selectedZone || !this.selectedRegion) return;

		const height = Number.parseFloat(this.panels.regionHeight.text);
		this.selectedRegion.height = Math.max(Number.isNaN(height) ? 0 : height, 1);

		this.updateEditorRegions();
	}

	pickSafeHeight() {
		if (!this.selectedZone || !this.selectedRegion) return;
		this.panels.zoningMenu.editRegion(PickType.SAFE_HEIGHT);
		this.setInfoPanelShown(true);
	}

	setRegionSafeHeight(value = null) {
		if (!this.selectedZone || !this.selectedRegion) return;

		const height = value ?? Number.parseFloat(this.panels.regionSafeHeight.text);
		this.selectedRegion.safeHeight = Number.isNaN(height) ? 0 : height;

		this.updateSelection(this.selectedZone);
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

	setTPDestType(type) {
		const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);

		delete this.selectedRegion.teleDestTargetname;
		delete this.selectedRegion.teleDestPos;
		delete this.selectedRegion.teleDestYaw;

		switch (type) {
			case 0:
				// none
				break;
			case 1:
				// entity
				// TODO: pick dest closest to zone center
				this.selectedRegion.teleDestTargetname = this.teleDestList[0];
				break;
			case 2:
				// custom
				this.deepCopyRegion(
					this.selectedZone.zone.regions[index],
					this.panels.zoningMenu.createDefaultTeleDest(this.selectedRegion)
				);

				// If they back out of picking the yaw interactively, I don't want to deal with the complication
				// of trying to revert the dest to whatever it was before, so just set a default here instead.
				this.selectedZone.zone.regions[index].teleDestYaw = 0;

				this.pickTeleDestYaw();
				break;
		}

		this.populateRegionProperties();
	}

	onTPDestEntitySelectionChanged() {
		const teleDestIndex = this.panels.regionTPDestEntityList.GetSelected()?.GetAttributeInt('value', -1);
		this.selectedRegion.teleDestTargetname = this.teleDestList[teleDestIndex];

		// Mostly just to push the updated region to game code for drawing the new destination
		this.populateRegionProperties();
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
		this.selectedRegion.teleDestYaw = Number.isNaN(yaw) ? undefined : Math.round(yaw);

		this.updateSelection(this.selectedZone);
	}
	onRegionEditCompleted(newRegion: Region) {
		if (this.selectedZone.globalRegion?.index != null) {
			this.deepCopyRegion(
				this.selectedZone.globalRegion.regions[this.selectedZone.globalRegion.index],
				newRegion
			);
		} else if (this.selectedZone.zone) {
			const index = this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1);
			if (index !== -1) this.deepCopyRegion(this.selectedZone.zone.regions[index], newRegion);
		} else {
			return;
		}

		this.setInfoPanelShown(false);
		this.updateEditorRegions();
	}

	deepCopyRegion(to: Region, from: Region) {
		if (!to || !from) return;
		to.points = [...from.points];
		to.bottom = from.bottom;
		to.height = from.height;
		if (from.safeHeight !== undefined) to.safeHeight = from.safeHeight;
		if (from.teleDestTargetname !== undefined) to.teleDestTargetname = from.teleDestTargetname;
		if (from.teleDestPos !== undefined) to.teleDestPos = [...from.teleDestPos];
		if (from.teleDestYaw !== undefined) to.teleDestYaw = from.teleDestYaw;
	}

	onRegionEditCanceled() {
		this.setInfoPanelShown(false);

		if (this.selectedZone.globalRegion?.index != null) {
			this.deleteSelection();
		} else if (this.selectedRegion?.points.length === 0) {
			this.deleteRegion();
		}

		this.updateEditorRegions();
	}

	setInfoPanelShown(show: boolean) {
		this.panels.propertiesPanel.SetHasClass('hide', show);
		this.panels.infoPanel.SetHasClass('hide', !show);

		if (!show) {
			this.populateZoneProperties(false);
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
		if (!this.mayAddBonus()) return;

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

	addSegment(index = null) {
		if (!this.mapZoneData) return;
		if (!this.mayAddSegment()) return;

		const newSegment = this.createSegment();

		if (!this.selectedZone.track.zones.segments) {
			this.selectedZone.track.zones.segments = [];
		}

		if (index != null && index < this.selectedZone.track.zones.segments.length) {
			this.selectedZone.track.zones.segments.splice(Math.max(index, 0), 0, newSegment);
		} else {
			this.selectedZone.track.zones.segments.push(newSegment);
		}

		this.updateSelection({ track: this.selectedZone.track, segment: newSegment, zone: newSegment.checkpoints[0] });

		this.panels.zoningMenu.createRegion(true);
		this.setInfoPanelShown(true);
	}

	addCheckpoint(index = null) {
		if (!this.mapZoneData) return;
		if (!this.mayAddCheckpoint()) return;

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
		this.mapZoneData.maxVelocity = !Number.isNaN(velocity) && velocity > 0 ? Math.round(velocity) : 0;
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
		if (!this.hasSelectedMainTrack() && !this.hasSelectedBonusTrack()) return;
		this.selectedZone.track.bhopEnabled = this.panels.bhopEnabledCheckbox.checked;
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

	updateEditorRegions() {
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
									? RegionRenderMode.START_WITH_SAFE_HEIGHT
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
				renderMode: RegionRenderMode.ALLOW_BHOP,
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
		for (const region of this.mapZoneData.globalRegions?.overbounce ?? []) {
			renderRegions.push({
				region: region,
				renderMode: RegionRenderMode.OVERBOUNCE,
				editing: region === this.selectedRegion
			});
		}

		// This initializes the regions we want to render, and also initializes
		// the Region data for the region we have selected for editing.
		this.panels.zoningMenu.updateEditorRegions(renderRegions);
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

	getTotalRegionCount() {
		let regionCount = 0;
		if (this.mapZoneData.tracks.main) {
			regionCount += countTrackRegions(this.mapZoneData.tracks.main);
		}
		for (const bonus of this.mapZoneData.tracks.bonuses ?? []) {
			regionCount += countTrackRegions(bonus);
		}
		for (const [regions] of Object.values(this.mapZoneData.globalRegions ?? {})) {
			regionCount += regions?.length ?? 0;
		}

		return regionCount;
	}

	mayAddBonus(precomputedRegionCount?) {
		return (
			(precomputedRegionCount ?? this.getTotalRegionCount()) < this.zoningLimits.MAX_REGIONS &&
			(this.mapZoneData.tracks.bonuses?.length ?? 0) < this.zoningLimits.MAX_BONUS_TRACKS
		);
	}

	mayAddSegment(precomputedRegionCount?) {
		return (
			(precomputedRegionCount ?? this.getTotalRegionCount()) < this.zoningLimits.MAX_REGIONS &&
			this.selectedZone.track &&
			this.isMainTrack(this.selectedZone.track) &&
			this.selectedZone.track.zones.segments.length < this.zoningLimits.MAX_TRACK_SEGMENTS &&
			!this.mapZoneData.tracks.bonuses?.some((bonus) => this.isDefragBonus(bonus))
		);
	}

	mayAddCheckpoint(precomputedRegionCount?) {
		return (
			(precomputedRegionCount ?? this.getTotalRegionCount()) < this.zoningLimits.MAX_REGIONS &&
			!this.isDefragBonus(this.selectedZone.track) &&
			this.selectedZone.segment &&
			(this.selectedZone.segment.checkpoints?.length ?? 0) < this.zoningLimits.MAX_SEGMENT_CHECKPOINTS
		);
	}
}
