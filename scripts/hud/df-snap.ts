import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import * as MomMath from 'util/math';
import { rgbaStringLerp } from 'util/colors';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { DFHudComponent, StyleObject, ZonePanel } from 'common/df-hud';

let COLORED_SNAP_CLASS: StyleObject;
let UNCOLORED_SNAP_CLASS: StyleObject;
let HIGHLIGHTED_SNAP_CLASS: StyleObject;
let HIGHLIGHTED_ALT_SNAP_CLASS: StyleObject;

@PanelHandler()
class DFSnapHandler extends DFHudComponent {
	snapContainer = $('#SnapContainer');
	snapZones: ZonePanel[] = [];
	snapSplitZone = this.initZonePanel($.CreatePanel('Panel', this.snapContainer, 'SnapSplitZone'));
	snapGainRange: number[] = []; // stored as [min, max]

	snapEnable: boolean;
	snapMinSpeed: float;
	snapHeight: float;
	snapOffset: float;
	snapColor: rgbaColor;
	snapAltColor: rgbaColor;
	snapFastColor: rgbaColor;
	snapSlowColor: rgbaColor;
	snapHlColor: rgbaColor;
	snapHlAltColor: rgbaColor;
	snapHlMode: int32;
	snapColorMode: int32;
	snapHeightgainEnable: boolean;

	/** Target highlighting only applies above the cgaz minimum speed */
	cgazMinSpeed: float;

	constructor() {
		super();

		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			onLoad: () => this.onLoad(),
			handledEvents: [
				{
					event: 'HudProcessInput',
					panel: $.GetContextPanel(),
					callback: () => this.onUpdate()
				}
			]
		});

		$.RegisterForUnhandledEvent('OnDefragHUDSnapChange', () => this.onSnapConfigChange());
		$.RegisterForUnhandledEvent('OnDefragHUDCgazChange', () => this.onCgazConfigChange());
	}

	onLoad() {
		this.projection = DefragAPI.GetHUDProjection();
		this.onCgazConfigChange();
		this.onSnapConfigChange();
	}

	onCgazConfigChange() {
		this.cgazMinSpeed = GameInterfaceAPI.GetSettingFloat('mom_hud_df_cgaz_min_speed');
	}

	onSnapConfigChange() {
		const snapConfig = $.GetContextPanel<MomHudDFSnap>().GetSnapCFG();
		this.snapEnable = snapConfig.enable;
		this.snapMinSpeed = snapConfig.minSpeed;
		this.snapHeight = snapConfig.height;
		this.snapOffset = snapConfig.offset;
		this.snapColor = snapConfig.color;
		this.snapAltColor = snapConfig.altColor;
		this.snapFastColor = snapConfig.fastColor;
		this.snapSlowColor = snapConfig.slowColor;
		this.snapHlColor = snapConfig.highlightColor;
		this.snapHlAltColor = snapConfig.altHighlightColor;
		this.snapHlMode = snapConfig.highlightMode;
		this.snapColorMode = snapConfig.colorMode;
		this.snapHeightgainEnable = snapConfig.enableHeightGain;

		COLORED_SNAP_CLASS = new StyleObject(this.snapHeight, this.snapOffset, this.snapColor);
		UNCOLORED_SNAP_CLASS = new StyleObject(this.snapHeight, this.snapOffset, this.snapAltColor);
		HIGHLIGHTED_SNAP_CLASS = new StyleObject(this.snapHeight, this.snapOffset, this.snapHlColor);
		HIGHLIGHTED_ALT_SNAP_CLASS = new StyleObject(this.snapHeight, this.snapOffset, this.snapHlAltColor);

		this.setupContainer(this.snapContainer, this.snapOffset);
		for (const [i, snapZone] of this.snapZones.entries()) {
			this.applyClass(snapZone, i % 2 ? UNCOLORED_SNAP_CLASS : COLORED_SNAP_CLASS);
		}
	}

	onUpdate() {
		const state = DefragAPI.GetHUDFrameState();
		if (!state.valid) return;

		// clear last frame's special zones
		this.clearZones([this.snapSplitZone]);

		this.updateView(state);
		this.updateSnapAccel(state.hasteTime);

		if (this.snapAngles.length > this.snapZones?.length) {
			const start = this.snapZones?.length;
			const end = this.snapAngles.length;
			for (let i = start; i < end; ++i) {
				this.snapZones.push(this.initZonePanel($.CreatePanel('Panel', this.snapContainer, `SnapZone${i}`)));
			}
			this.onSnapConfigChange();
		} else if (this.snapAngles.length < this.snapZones?.length) {
			const start = this.snapAngles.length;
			const end = this.snapZones?.length;
			for (let i = start; i < end; ++i) {
				this.snapZones.pop().DeleteAsync(0);
			}
			this.onSnapConfigChange();
		}

		const tickInterval = state.tickInterval;
		const speed = state.speed;
		const dropSpeed = state.dropSpeed;
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const velAngle = state.velAngle;
		const rightMove = state.rightMove;
		const bSnapShift = state.snapShift;

		if (this.snapEnable && this.snapAccel) {
			const snapOffset = MomMath.remapAngle(
				(bSnapShift ? 0 : Math.PI * 0.25 * (rightMove > 0 ? -1 : 1)) - viewAngle
			);

			// draw snap zones
			if (speed >= this.snapMinSpeed) {
				const targetOffset = MomMath.remapAngle(velAngle - viewAngle);
				const targetAngle = this.findFastAngle(
					dropSpeed,
					this.maxGroundSpeed,
					this.maxGroundSpeed * tickInterval
				);
				const leftTarget = -targetAngle - targetOffset + Math.PI * 0.25;
				const rightTarget = targetAngle - targetOffset - Math.PI * 0.25;
				this.updateSnaps(snapOffset, leftTarget, rightTarget, speed);
			} else {
				this.clearZones(this.snapZones);
			}
		} else {
			this.clearZones(this.snapZones);
		}
	}

	findSnapGains(): number[] {
		const snapGains = [];
		this.snapGainRange = [0, 0];
		for (let i = 0; i < 0.5 * this.snapAngles.length; ++i) {
			const left = this.snapAngles[i];
			const right = this.snapAngles[i + 1];
			const angle = 0.5 * (left + right);

			const xGain = Math.round(this.snapAccel * Math.cos(angle));
			const yGain = Math.round(this.snapAccel * Math.sin(angle));
			const gainDiff = Math.hypot(xGain, yGain) - this.snapAccel;
			snapGains.push(gainDiff);

			this.snapGainRange[0] = Math.min(gainDiff, this.snapGainRange[0]);
			this.snapGainRange[1] = Math.max(gainDiff, this.snapGainRange[1]);
		}
		return snapGains;
	}

	updateSnaps(snapOffset: number, leftTarget: number, rightTarget: number, speed: number) {
		const snapGains = this.findSnapGains();
		const zones = this.snapZones;

		for (const [i, zone] of zones.entries()) {
			// wrap the angles to only [-pi/2, pi/2]
			const left = MomMath.wrapToHalfPi(this.snapAngles[i] - snapOffset);
			const right = MomMath.wrapToHalfPi(this.snapAngles[(i + 1) % zones.length] - snapOffset);
			const bUseUncolored = !this.snapHeightgainEnable && !this.snapColorMode && i % 2;
			let snapColor = bUseUncolored ? this.snapAltColor : this.snapColor;
			let hlSnapColor = bUseUncolored ? this.snapHlAltColor : this.snapHlColor;
			const snapClass = bUseUncolored ? UNCOLORED_SNAP_CLASS : COLORED_SNAP_CLASS;

			const minGain = this.snapGainRange[0];
			const maxGain = this.snapGainRange[1];
			const diffGain = snapGains[i % snapGains.length];
			const alpha = maxGain === minGain ? 1 : (diffGain - minGain) / (maxGain - minGain);
			const heightFactor = 0.8 * alpha + 0.2;
			const height = this.NaNCheck(this.snapHeight, 0);

			const bSplit = this.handleSplitZoneWrap(zone, left, right, snapClass, this.snapSplitZone);
			if (bSplit) this.applyClass(this.snapSplitZone, snapClass);
			const zoneParts = bSplit ? [zone, this.snapSplitZone] : [zone];

			for (const part of zoneParts) {
				if (this.snapHeightgainEnable && !Number.isNaN(heightFactor)) {
					part.style.height = heightFactor * height + 'px';
					part.style.marginBottom = height + 'px';
					part.style.verticalAlign = 'bottom';
				} else {
					part.style.height = height + 'px';
					part.style.marginBottom = height + 'px';
				}
			}

			if (this.snapColorMode) {
				snapColor = rgbaStringLerp(this.snapSlowColor, this.snapFastColor, alpha) as rgbaColor;
			}

			let bHighlight = false;
			switch (this.snapHlMode) {
				case 0:
					bHighlight = false;
					break;
				case 1:
					bHighlight = left < 0 && right > 0;
					break;
				case 2:
					// "target" zones only highlight when moving
					if (speed > this.cgazMinSpeed) {
						let stopPoint, direction;
						if (left - leftTarget <= 0 && right - leftTarget >= 0) {
							stopPoint = MomMath.approxEquals(zone.rightPx, zone.leftPx, 1)
								? 0
								: this.NaNCheck(
										(
											(this.mapToScreen(leftTarget) - zone.leftPx) /
											(zone.rightPx - zone.leftPx)
										).toFixed(3),
										0
									);
							direction = '0% 0%, 100% 0%';
							bHighlight = true;
						} else if (left - rightTarget <= 0 && right - rightTarget >= 0) {
							stopPoint = MomMath.approxEquals(zone.rightPx, zone.leftPx, 1)
								? 0
								: this.NaNCheck(
										(
											(zone.rightPx - this.mapToScreen(rightTarget)) /
											(zone.rightPx - zone.leftPx)
										).toFixed(3),
										0
									);
							direction = '100% 0%, 0% 0%';
							bHighlight = true;
						}
						if (bHighlight) {
							hlSnapColor =
								`gradient(linear, ${direction}, from(${hlSnapColor}), color-stop( ${stopPoint}, ${hlSnapColor} ), color-stop( ${stopPoint}, ${snapColor} ), to(${snapColor}))` as rgbaColor;
						}
					}
					break;
			}

			for (const part of zoneParts) {
				part.style.backgroundColor = bHighlight ? hlSnapColor : snapColor;
			}
		}
	}

	/**
	 * Updates a zone whose edges were wrapped into [-pi/2, pi/2].
	 * A zone crossing the +-pi/2 seam comes in with left > right, so its part past the seam is drawn on splitZone.
	 * Returns whether splitZone was used.
	 */
	handleSplitZoneWrap(zone: ZonePanel, left: number, right: number, zoneClass: StyleObject, splitZone: ZonePanel) {
		if (left <= right) {
			this.updateZone(zone, left, right, 0, zoneClass);
			return false;
		}

		this.updateZone(splitZone, -Math.PI * 0.5, right, 0, zoneClass);
		this.updateZone(zone, left, Math.PI * 0.5, 0, zoneClass);
		return true;
	}
}
