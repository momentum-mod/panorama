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
		propertiesZone: $<Panel>('#ZoneProperties')!
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
	static newObjectType: string | null;

	static {
		$.RegisterForUnhandledEvent('ZoneMenu_Show', this.showZoneMenu.bind(this));
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', this.hideZoneMenu.bind(this));

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
		const entList = $.GetContextPanel().getEntityList();
		this.filternameList = entList.filter ?? [];
		this.teleDestList = entList.teleport ?? [];

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
			bottom: Number.MAX_SAFE_INTEGER,
			height: 0,
			teleDestTargetname: ''
		} as Region;
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

		this.populateSegmentProperties();
		this.populateTrackProperties();
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
