import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import { rgbaStringLerp } from 'util/colors';
import { DFHudComponent, InputMode, StyleObject, ZonePanel } from 'common/df-hud';

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
	/** Whether the held input's target is on the left of the velocity, kept while the wish runs along the velocity */
	snapActiveLeft = true;

	constructor() {
		super();

		this.registerComponent(
			'#Customizer_Df_Snap_Name',
			GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			{
				minSpeed: this.numberStyle('#Customizer_Df_MinSpeed', 0, 10000, (value) => (this.snapMinSpeed = value)),
				height: this.numberStyle('#Customizer_Height', 1, 50, (value) => (this.snapHeight = value)),
				colors: this.groupStyle('#Customizer_Colors', ['color', 'altColor']),
				color: this.colorStyle('#Customizer_Color', (value) => (this.snapColor = value)),
				altColor: this.colorStyle('#Customizer_Df_Snap_AltColor', (value) => (this.snapAltColor = value)),
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
					'#Customizer_Df_Highlight',
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
				)
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

			if (speed >= this.snapMinSpeed) {
				const targetAngle = this.findFastAngle(
					dropSpeed,
					this.maxGroundSpeed,
					this.maxGroundSpeed * tickInterval
				);
				// view-relative targets of the held input and its mirror, placed like prime sight's, in [-pi, pi]
				const [leftWishOffset, rightWishOffset] = this.findTargetWishOffsets(state, viewAngle);
				const leftTarget = MomMath.remapAngle(-targetAngle - velAngle + leftWishOffset + viewAngle);
				const rightTarget = MomMath.remapAngle(targetAngle - velAngle + rightWishOffset + viewAngle);
				this.updateSnaps(snapOffset, leftTarget, rightTarget, speed);
			} else {
				this.clearZones(this.snapZones);
			}
		} else {
			this.clearZones(this.snapZones);
		}
	}

	/**
	 * Wish offsets (relative to the view, positive to the left) of the inputs whose targets the left and right zones
	 * highlight: the held input on its side of the velocity and its mirror on the other, as prime sight picks them. They
	 * are of the kind the drawn zones are laid out for (diagonals, or single keys when the zones are shifted), so each
	 * target lands in a zone of its own input. With no keys held it's the diagonals around the key nearest the velocity.
	 */
	findTargetWishOffsets(state: DefragAPI.HUDFrameState, viewAngle: number): [number, number] {
		const inputMode = state.inputMode;
		const velFromView = MomMath.remapAngle(state.velAngle - viewAngle);
		const wishOffset = this.findKeyWish(state).offset;
		const bStrafe = inputMode === InputMode.STRAFE_LEFT || inputMode === InputMode.STRAFE_RIGHT;
		const bTurn = inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT;
		// VQ3 accelerates the same way for all 8 inputs, and so do single keys on the ground, where the zones shift
		const bSameAccel = state.snapShift || state.physicsMode === DefragAPI.DefragPhysics.VQ3;
		const bForwardOnly = inputMode === InputMode.AIR_CONTROL && bSameAccel;

		if (!bStrafe && !bTurn && !bForwardOnly) {
			const nearestKeyOffset = Math.round(velFromView / (Math.PI * 0.5)) * Math.PI * 0.5;
			return [
				MomMath.remapAngle(nearestKeyOffset + Math.PI * 0.25),
				MomMath.remapAngle(nearestKeyOffset - Math.PI * 0.25)
			];
		}

		const wishFromVel = MomMath.remapAngle(viewAngle + wishOffset - state.velAngle);
		if (Math.abs(wishFromVel) > 0.01 && Math.abs(wishFromVel) < Math.PI - 0.01) {
			this.snapActiveLeft = wishFromVel > 0;
		}

		let activeOffset = wishOffset;
		let inactiveOffset: number;
		if (bSameAccel) {
			// VQ3 uses the same travel input as prime sight; CPM ground single keys keep a diagonal one
			const travelStep = Math.PI * (state.physicsMode === DefragAPI.DefragPhysics.VQ3 ? 0.5 : 0.25);
			inactiveOffset = this.findVQ3MirrorOffset(wishOffset, velFromView, travelStep);
		} else if (bStrafe) {
			inactiveOffset = this.findCPMMirrorOffset(wishOffset, velFromView);
		} else {
			// CPM a/d turns use the strafe diagonals on either side
			const strafeOffset = Math.PI * (Math.cos(velFromView) >= 0 ? 0.25 : 0.75);
			activeOffset = Math.sign(wishOffset) * strafeOffset;
			inactiveOffset = -activeOffset;
		}

		return this.snapActiveLeft ? [activeOffset, inactiveOffset] : [inactiveOffset, activeOffset];
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
			const hlSnapColor = bUseUncolored ? this.snapHlAltColor : this.snapHlColor;
			const snapClass = bUseUncolored ? UNCOLORED_SNAP_CLASS : COLORED_SNAP_CLASS;

			const minGain = this.snapGainRange[0];
			const maxGain = this.snapGainRange[1];
			const diffGain = snapGains[i % snapGains.length];
			const alpha = maxGain === minGain ? 1 : (diffGain - minGain) / (maxGain - minGain);
			const heightFactor = 0.8 * alpha + 0.2;
			const height = this.NaNCheck(this.snapHeight, 0);

			const bSplit = this.handleSplitZoneWrap(zone, left, right, snapClass, this.snapSplitZone);
			if (bSplit) this.applyClass(this.snapSplitZone, snapClass);
			// a split zone is drawn as [left, pi/2] on the zone and [-pi/2, right] on the split zone
			const zoneParts = bSplit
				? [
						{ panel: zone, left, right: Math.PI * 0.5 },
						{ panel: this.snapSplitZone, left: -Math.PI * 0.5, right }
					]
				: [{ panel: zone, left, right }];

			for (const part of zoneParts) {
				// zones stand on the bottom of the strip, so height gain grows them upwards
				part.panel.style.height =
					(this.snapHeightgainEnable && !Number.isNaN(heightFactor) ? heightFactor * height : height) + 'px';
				part.panel.style.verticalAlign = 'bottom';
			}

			if (this.snapColorByGain) {
				snapColor = rgbaStringLerp(this.snapSlowColor, this.snapFastColor, alpha) as rgbaColor;
			}

			let bHighlight = false;
			// target mode colors each part on its own, since a zone can hold both targets or have them on different parts
			const partColors = new Map<ZonePanel, string>();
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
						for (const part of zoneParts) {
							const color = this.findTargetGradient(
								part,
								leftTarget,
								rightTarget,
								hlSnapColor,
								snapColor
							);
							if (color) partColors.set(part.panel, color);
						}
					}
					break;
			}

			for (const part of zoneParts) {
				part.panel.style.backgroundColor = partColors.get(part.panel) ?? (bHighlight ? hlSnapColor : snapColor);
			}
		}
	}

	/**
	 * Background for a zone part highlighted from its left edge up to the left target and from the right target to its
	 * right edge, or null when it holds neither target. Both targets in one part highlight both ends, or all of it when
	 * they cross.
	 */
	findTargetGradient(
		part: { panel: ZonePanel; left: number; right: number },
		leftTarget: number,
		rightTarget: number,
		hlColor: string,
		color: string
	): string {
		const panel = part.panel;
		const bLeft = part.left <= leftTarget && leftTarget <= part.right;
		const bRight = part.left <= rightTarget && rightTarget <= part.right;
		if (!bLeft && !bRight) return null;

		const width = panel.rightPx - panel.leftPx;
		// fraction of the part's width from its left edge to a target
		const stop = (target: number) =>
			MomMath.approxEquals(panel.rightPx, panel.leftPx, 1)
				? 0
				: Math.min(Math.max(this.NaNCheck((this.mapToScreen(target) - panel.leftPx) / width, 0), 0), 1);
		const leftStop = bLeft ? stop(leftTarget) : 0;
		const rightStop = bRight ? stop(rightTarget) : 1;
		if (leftStop >= rightStop) return hlColor;

		const stops = [];
		if (bLeft)
			stops.push(
				`color-stop(${leftStop.toFixed(4)}, ${hlColor})`,
				`color-stop(${leftStop.toFixed(4)}, ${color})`
			);
		if (bRight)
			stops.push(
				`color-stop(${rightStop.toFixed(4)}, ${color})`,
				`color-stop(${rightStop.toFixed(4)}, ${hlColor})`
			);
		const ends = [bLeft ? hlColor : color, bRight ? hlColor : color];
		return `gradient(linear, 0% 0%, 100% 0%, from(${ends[0]}), ${stops.join(', ')}, to(${ends[1]}))`;
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
