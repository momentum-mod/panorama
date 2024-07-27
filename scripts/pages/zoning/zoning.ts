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
		zoningMenu: $.GetContextPanel() as Panel,
		trackList: $<Panel>('#TrackList') as Panel,
		propertiesTrack: $<Panel>('#TrackProperties') as Panel,
		maxVelocity: $<TextEntry>('#MaxVelocity') as TextEntry,
		defragFlags: $<Panel>('#DefragFlags') as Panel,
		segmentsEndAtStageStarts: $<ToggleButton>('#SegmentsEndAtStageStarts')?.FindChild('CheckBox') as ToggleButton,
		propertiesSegment: $<Panel>('#SegmentProperties') as Panel,
		limitGroundSpeed: $('#LimitGroundSpeed')?.FindChild('CheckBox') as ToggleButton,
		checkpointsRequired: $('#CheckpointsRequired')?.FindChild('CheckBox') as ToggleButton,
		checkpointsOrdered: $('#CheckpointsOrdered')?.FindChild('CheckBox') as ToggleButton,
		segmentName: $<TextEntry>('#SegmentName') as TextEntry,
		propertiesZone: $<Panel>('#ZoneProperties') as Panel
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
						segments: [this.createSegment()]
					},
					stagesEndAtStageStarts: true
				},
				bonuses: [] as BonusTrack[]
			} as MapTracks;

			this.mapZoneData = {} as ZoneDef;
			this.mapZoneData.formatVersion = FORMAT_VERSION;
			this.mapZoneData.tracks = tracks;
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
		for (const [i, bonus] of this.mapZoneData.tracks.bonuses.entries()) {
			this.createTrackEntry(this.panels.trackList, bonus, `Bonus ${i + 1}`);
		}
	}

	static showZoneMenu() {
		if (!this.mapZoneData || this.panels.trackList.Children().length === 0) {
			this.initMenu();
		}
	}

	static hideZoneMenu() {
		if (this.panels.trackList?.Children().length) {
			this.panels.trackList.RemoveAndDeleteChildren();
		}
	}

	static toggleCollapse(container: Panel, expandIcon: Panel, collapseIcon: Panel) {
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
			(parent.FindChildTraverse('CollapseButton') as Panel).style.visibility = 'collapse';
			return;
		}

		const trackSegmentContainer = trackChildContainer.FindChildTraverse('SegmentContainer') as Panel;
		for (const [i, segment] of entry.zones.segments.entries()) {
			const majorId = segment.name || `Segment ${i + 1}`;
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
			if (segment.checkpoints.length === 0) {
				(trackChildContainer.FindChildTraverse('CollapseButton') as Panel).style.visibility = 'collapse';
				continue;
			}

			const segmentCheckpointContainer = segmentChildContainer.FindChildTraverse('CheckpointContainer') as Panel;
			for (const [j, zone] of segment.checkpoints.entries()) {
				const minorId = j ? `Checkpoint ${j}` : i ? 'Stage Start' : 'Start Zone';
				this.addTracklistEntry(segmentCheckpointContainer, minorId, TracklistSnippet.CHECKPOINT, {
					track: entry,
					segment: segment,
					zone: zone
				});
			}
			if (!segment.cancel || segment.cancel.length === 0) continue;
			for (const [j, zone] of segment.cancel.entries()) {
				const cancelId = `Cancel ${j + 1}`;
				this.addTracklistEntry(segmentCheckpointContainer, cancelId, TracklistSnippet.CHECKPOINT, {
					track: entry,
					segment: segment,
					zone: zone
				});
			}
		}

		if (entry.zones.end) {
			const trackEndZoneContainer = trackChildContainer.FindChildTraverse('EndZoneContainer') as Panel;
			this.addTracklistEntry(trackEndZoneContainer, 'End Zone', TracklistSnippet.CHECKPOINT, {
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
		object,
		setActive: boolean = false
	): Panel | null {
		const newTracklistPanel = $.CreatePanel('Panel', parent, name);
		newTracklistPanel.LoadLayoutSnippet(snippet);

		const label = newTracklistPanel.FindChildTraverse('Name') as Label;
		label.text = name;

		const collapseButton = newTracklistPanel.FindChildTraverse('CollapseButton');
		const childContainer = newTracklistPanel.FindChildTraverse('ChildContainer');
		if (collapseButton && childContainer) {
			const expandIcon = newTracklistPanel.FindChildTraverse('TracklistExpandIcon') as Panel;
			const collapseIcon = newTracklistPanel.FindChildTraverse('TracklistCollapseIcon') as Panel;
			collapseButton.SetPanelEvent('onactivate', () =>
				ZoneMenu.toggleCollapse(childContainer as Panel, expandIcon, collapseIcon)
			);

			this.toggleCollapse(childContainer, expandIcon, collapseIcon);
		}

		const selectButton = newTracklistPanel.FindChildTraverse('SelectButton') as Panel;
		if (selectButton && object) {
			selectButton.SetPanelEvent('onactivate', () =>
				ZoneMenu.updateSelection(object.track, object.segment, object.zone)
			);
		}

		if (setActive) {
			(selectButton as RadioButton).SetSelected(true);
		}

		return childContainer;
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
			teleDestTargetname: ''
		} as Region;
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

		this.selectedZone.track = selectedTrack as MainTrack | BonusTrack;
		this.selectedZone.segment = selectedSegment as Segment;
		this.selectedZone.zone = selectedZone as Zone;

		if (selectedZone !== null) {
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'visible';
		} else if (selectedSegment !== null) {
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'visible';
			this.panels.propertiesZone.style.visibility = 'collapse';
			this.populateSegmentProperties();
		} else if (selectedTrack !== null) {
			this.panels.propertiesTrack.style.visibility = 'visible';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'collapse';
			this.populateTrackProperties();
		}
	}

	static populateSegmentProperties() {
		if (!this.mapZoneData || !this.selectedZone || !this.selectedZone.segment) return;
		const segment = this.selectedZone.segment as Segment;
		this.panels.limitGroundSpeed.SetSelected(segment.limitStartGroundSpeed);
		this.panels.checkpointsRequired.SetSelected(segment.checkpointsRequired);
		this.panels.checkpointsOrdered.SetSelected(segment.checkpointsOrdered);
		this.panels.segmentName.text = segment.name === undefined ? '' : segment.name;
	}
	static populateTrackProperties() {
		if (!this.mapZoneData || !this.selectedZone || !this.selectedZone.track) return;
		const track = this.selectedZone.track as MainTrack | BonusTrack;
		const parentPanel = this.panels.segmentsEndAtStageStarts.GetParent() as Panel;
		if ('stagesEndAtStageStarts' in track) {
			parentPanel.style.visibility = 'visible';
			this.panels.segmentsEndAtStageStarts.SetSelected(track.stagesEndAtStageStarts as boolean);
		} else {
			parentPanel.style.visibility = 'collapse';
		}
		this.panels.defragFlags.style.visibility = 'defragFlags' in track ? 'visible' : 'collapse';
		this.panels.maxVelocity.text =
			this.mapZoneData.maxVelocity === undefined ? '' : (this.mapZoneData.maxVelocity.toFixed(0) as string);
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
		$.Msg('Setting');
		if (!this.selectedZone || !this.selectedZone.track || !('stagesEndAtStageStarts' in this.selectedZone.track))
			return;
		this.selectedZone.track.stagesEndAtStageStarts = this.panels.segmentsEndAtStageStarts.checked;
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
		hasteFlag.SetPanelEvent('onactivate', () => ZoneMenu.setDefragFlags('HASTE'));

		const slickFlag = flagEditMenu.FindChildTraverse('FlagSlick') as Panel;
		slickFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['SLICK']) > 0;
		slickFlag.SetPanelEvent('onactivate', () => ZoneMenu.setDefragFlags('SLICK'));

		const damageBoostFlag = flagEditMenu.FindChildTraverse('FlagDamageBoost') as Panel;
		damageBoostFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['DAMAGEBOOST']) > 0;
		damageBoostFlag.SetPanelEvent('onactivate', () => ZoneMenu.setDefragFlags('DAMAGEBOOST'));

		const rocketsFlag = flagEditMenu.FindChildTraverse('FlagRockets') as Panel;
		rocketsFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['ROCKETS']) > 0;
		rocketsFlag.SetPanelEvent('onactivate', () => ZoneMenu.setDefragFlags('ROCKETS'));

		const plasmaFlag = flagEditMenu.FindChildTraverse('FlagPlasma') as Panel;
		plasmaFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['PLASMA']) > 0;
		plasmaFlag.SetPanelEvent('onactivate', () => ZoneMenu.setDefragFlags('PLASMA'));

		const bfgFlag = flagEditMenu.FindChildTraverse('FlagBFG') as Panel;
		bfgFlag.checked = ((this.selectedZone.track.defragFlags as number) & DefragFlags['BFG']) > 0;
		bfgFlag.SetPanelEvent('onactivate', () => ZoneMenu.setDefragFlags('BFG'));
	}

	static setDefragFlags(flag: string) {
		if (this.selectedZone.track === null || !('defragFlags' in this.selectedZone.track)) return;
		(this.selectedZone.track.defragFlags as number) ^= DefragFlags[flag];
	}

	static setLimitGroundSpeed() {
		if (!this.selectedZone || !this.selectedZone.track || !this.selectedZone.segment) return;
		this.selectedZone.segment.limitStartGroundSpeed = this.panels.limitGroundSpeed.checked;
	}

	static setCheckpointsOrdered() {
		if (!this.selectedZone || !this.selectedZone.track || !this.selectedZone.segment) return;
		this.selectedZone.segment.checkpointsOrdered = this.panels.checkpointsOrdered.checked;
	}

	static setCheckpointsRequired() {
		if (!this.selectedZone || !this.selectedZone.track || !this.selectedZone.segment) return;
		this.selectedZone.segment.checkpointsRequired = this.panels.checkpointsRequired.checked;
	}

	static setSegmentName() {
		if (!this.selectedZone || !this.selectedZone.track || !this.selectedZone.segment) return;
		this.selectedZone.segment.name = this.panels.segmentName.text;
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
		return {
			track: !!this.selectedZone && !!this.selectedZone.track,
			segment: !!this.selectedZone && !!this.selectedZone.track && !!this.selectedZone.segment,
			zone:
				!!this.selectedZone &&
				!!this.selectedZone.track &&
				!!this.selectedZone.segment &&
				!!this.selectedZone.zone
		};
	}
}
