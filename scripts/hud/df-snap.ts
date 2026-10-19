import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import { rgbaStringLerp } from 'util/colors';
import { DFHudComponent, StyleObject, ZonePanel } from 'common/df-hud';

let COLORED_SNAP_CLASS: StyleObject;
let UNCOLORED_SNAP_CLASS: StyleObject;

enum HighlightMode {
	NONE = 'none',
	CENTER = 'center',
	TARGET = 'target'
}

@PanelHandler()
class DFSnapHandler extends DFHudComponent {
	snapContainer = $('#SnapContainer');
	snapZones: ZonePanel[] = [];
	snapSplitZone = this.initZonePanel($.CreatePanel('Panel', this.snapContainer, 'SnapSplitZone'));
	snapGainRange: number[] = []; // stored as [min, max]

	snapMinSpeed: number;
	snapHeight: number;
	snapColor: rgbaColor;
	snapAltColor: rgbaColor;
	snapFastColor: rgbaColor;
	snapSlowColor: rgbaColor;
	snapHlColor: rgbaColor;
	snapHlAltColor: rgbaColor;
	snapHlMode: HighlightMode;
	snapColorByGain: boolean;
	snapHeightgainEnable: boolean;

	/** Target highlighting only applies when moving faster than this */
	snapTargetMinSpeed: number;

	constructor() {
		super();

		this.registerComponent(
			'#Customizer_Df_Snap_Name',
			GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			{
				minSpeed: this.numberStyle('#Customizer_Df_MinSpeed', 0, 10000, (value) => (this.snapMinSpeed = value)),
				height: this.numberStyle('#Customizer_Height', 1, 50, (value) => (this.snapHeight = value)),
				heightGain: this.checkboxStyle(
					'#Customizer_Df_HeightGain',
					(value) => (this.snapHeightgainEnable = value),
					{ tooltip: '#Customizer_Df_HeightGain_Tooltip' }
				),
				colorByGain: this.checkboxStyle(
					'#Customizer_Df_ColorByGain',
					(value) => (this.snapColorByGain = value),
					{
						tooltip: '#Customizer_Df_ColorByGain_Tooltip',
						children: [
							{ styleID: 'slowColor', showWhen: true },
							{ styleID: 'fastColor', showWhen: true }
						]
					}
				),
				slowColor: this.colorStyle('#Customizer_Df_Snap_LowGainColor', (value) => (this.snapSlowColor = value)),
				fastColor: this.colorStyle(
					'#Customizer_Df_Snap_HighGainColor',
					(value) => (this.snapFastColor = value)
				),
				highlightMode: this.dropdownStyle(
					'#Customizer_Df_Snap_HighlightMode',
					[
						{ label: '#Common_Off', value: HighlightMode.NONE },
						{ label: '#Customizer_Df_Snap_HighlightMode_Center', value: HighlightMode.CENTER },
						{ label: '#Customizer_Df_Snap_HighlightMode_Target', value: HighlightMode.TARGET }
					],
					(value) => (this.snapHlMode = value as HighlightMode),
					{
						tooltip: '#Customizer_Df_Snap_HighlightMode_Tooltip',
						children: [
							{ styleID: 'targetMinSpeed', showWhen: HighlightMode.TARGET },
							{ styleID: 'highlightColor', showWhen: [HighlightMode.CENTER, HighlightMode.TARGET] },
							{ styleID: 'highlightAltColor', showWhen: [HighlightMode.CENTER, HighlightMode.TARGET] }
						]
					}
				),
				targetMinSpeed: this.numberStyle(
					'#Customizer_Df_Snap_TargetMinSpeed',
					0,
					10000,
					(value) => (this.snapTargetMinSpeed = value),
					{ tooltip: '#Customizer_Df_Snap_TargetMinSpeed_Tooltip' }
				),
				highlightColor: this.colorStyle('#Customizer_Df_HighlightColor', (value) => (this.snapHlColor = value)),
				highlightAltColor: this.colorStyle(
					'#Customizer_Df_Snap_HighlightAltColor',
					(value) => (this.snapHlAltColor = value)
				),
				colors: this.groupStyle('#Customizer_Colors', ['color', 'altColor']),
				color: this.colorStyle('#Customizer_Color', (value) => (this.snapColor = value)),
				altColor: this.colorStyle('#Customizer_Df_Snap_AltColor', (value) => (this.snapAltColor = value))
			},
			{ resizeY: true, heightStyle: { styleID: 'height' }, description: '#Customizer_Df_Snap_Name_Tooltip' }
		);
	}

	applyConfig() {
		COLORED_SNAP_CLASS = new StyleObject(this.snapHeight, this.snapColor);
		UNCOLORED_SNAP_CLASS = new StyleObject(this.snapHeight, this.snapAltColor);

		this.setStripHeight(this.snapHeight);
		this.setupContainer(this.snapContainer);
		for (const [i, snapZone] of this.snapZones.entries()) {
			this.applyClass(snapZone, i % 2 ? UNCOLORED_SNAP_CLASS : COLORED_SNAP_CLASS);
		}
	}

	onUpdate() {
		const state = this.getFrameState();
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
			this.applyConfig();
		} else if (this.snapAngles.length < this.snapZones?.length) {
			const start = this.snapAngles.length;
			const end = this.snapZones?.length;
			for (let i = start; i < end; ++i) {
				this.snapZones.pop().DeleteAsync(0);
			}
			this.applyConfig();
		}

		const tickInterval = state.tickInterval;
		const speed = state.speed;
		const dropSpeed = state.dropSpeed;
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const velAngle = state.velAngle;
		const rightMove = state.rightMove;
		const bSnapShift = state.snapShift;

		if (this.snapAccel) {
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
			const bUseUncolored = !this.snapHeightgainEnable && !this.snapColorByGain && i % 2;
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
				// zones stand on the bottom of the strip, so height gain grows them upwards
				part.style.height =
					(this.snapHeightgainEnable && !Number.isNaN(heightFactor) ? heightFactor * height : height) + 'px';
				part.style.verticalAlign = 'bottom';
			}

			if (this.snapColorByGain) {
				snapColor = rgbaStringLerp(this.snapSlowColor, this.snapFastColor, alpha) as rgbaColor;
			}

			let bHighlight = false;
			switch (this.snapHlMode) {
				case HighlightMode.NONE:
					bHighlight = false;
					break;
				case HighlightMode.CENTER:
					bHighlight = left < 0 && right > 0;
					break;
				case HighlightMode.TARGET:
					// "target" zones only highlight when moving
					if (speed > this.snapTargetMinSpeed) {
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
