import * as MomMath from 'util/math';
import { rgbaStringToRgb } from 'util/colors';

export const AIR_ACCEL = 1;
export const DEFAULT_ACCEL = 2.56;
export const DEFAULT_SPEED = 320;
export const HASTE_ACCEL = 3.328; // (max speed) * (air accel = 1) * (tick interval) * (haste factor)
export const HASTE_SPEED = 416;

export enum ProjectionMode {
	PERSPECTIVE = 0,
	ARC_LENGTH = 1,
	PANORAMIC = 2
}

export enum InputMode {
	NONE = 0,
	AIR_CONTROL = 1,
	STRAFE_LEFT = 2,
	STRAFE_RIGHT = 3,
	TURN_LEFT = 4,
	TURN_RIGHT = 5
}

export interface ZonePanel extends Panel {
	leftAngle: number;
	rightAngle: number;
	leftPx: number;
	rightPx: number;
	isInactive: boolean;
	color: rgbaColor;
}

export class StyleObject {
	height: number;
	offset: number;
	color: rgbaColor;
	align: Style['verticalAlign'];

	constructor(height: number, offset: number, color: rgbaColor) {
		this.height = height;
		this.offset = offset;
		this.align = 'center';
		this.color = color;
	}
}

/**
 * Shared base for the DF HUD components. Each component is a late-updating C++ shell (MomHudDF<Component>) whose
 * HudProcessInput runs once per rendered frame, after the view is set up, and reads everything view- and
 * movement-related from DefragAPI.GetHUDFrameState() so all components agree within a frame.
 */
export abstract class DFHudComponent {
	screenY = $.GetContextPanel().actuallayoutheight;
	screenX = $.GetContextPanel().actuallayoutwidth;
	scale = $.GetContextPanel().actualuiscale_y;
	/** Half of the horizontal FOV (crosshair to screen edge), in radians */
	halfHFov = 0;
	/** Half of the vertical FOV (crosshair to screen edge), in radians */
	halfVFov = 0;
	projection: ProjectionMode = DefragAPI.GetHUDProjection();

	maxGroundSpeed = DEFAULT_SPEED; // changes with haste status
	snapAccel = 0;
	snapAngles: number[] = [];

	constructor() {
		$.RegisterForUnhandledEvent('OnDefragHUDProjectionChange', () => {
			this.projection = DefragAPI.GetHUDProjection();
		});
	}

	/** Pull this frame's screen size and FOV. */
	updateView(state: DefragAPI.HUDFrameState) {
		this.screenY = $.GetContextPanel().actuallayoutheight;
		this.screenX = $.GetContextPanel().actuallayoutwidth;
		this.scale = $.GetContextPanel().actualuiscale_y;
		this.halfHFov = MomMath.deg2rad(state.hFov) * 0.5;
		this.halfVFov = MomMath.deg2rad(state.vFov) * 0.5;
	}

	/** Update snap accel and ground speed for the current haste status, recomputing snap angles when it changes. */
	updateSnapAccel(hasteTime: number): boolean {
		const accel = hasteTime ? HASTE_ACCEL : DEFAULT_ACCEL;
		if (this.snapAccel === accel) return false;

		this.snapAccel = accel;
		this.maxGroundSpeed = hasteTime ? HASTE_SPEED : DEFAULT_SPEED;

		// find snap zone borders
		this.snapAngles = this.findSnapAngles(this.snapAccel);
		return true;
	}

	mapToScreen(angle: number): number {
		return MomMath.mapAngleToScreenDist(angle, this.halfHFov, this.screenX, this.scale, this.projection);
	}

	/**
	 * Wish direction from the held keys and this frame's view: its offset from the view (positive to the left), its
	 * world angle and a unit vector. The engine's wish angle is from the last movement tick, so it lags the view while
	 * turning. With no keys held it keeps the engine's zero wish.
	 */
	findKeyWish(state: DefragAPI.HUDFrameState): { offset: number; angle: number; dir: vec2 } {
		const offset = Math.atan2(state.rightMove, state.forwardMove);
		if (!state.forwardMove && !state.rightMove) return { offset, angle: state.wishAngle, dir: state.wishDir };

		const angle = MomMath.remapAngle(MomMath.deg2rad(state.viewYaw) + offset);
		return { offset, angle, dir: { x: Math.cos(angle), y: Math.sin(angle) } };
	}

	findSlowAngle(dropSpeed: number, dropSpeedSquared: number, speedSquared: number, maxSpeed: number) {
		const threshold = Math.sqrt(Math.max(maxSpeed * maxSpeed - speedSquared + dropSpeedSquared, 0));
		return Math.acos(dropSpeed < threshold ? 1 : threshold / dropSpeed);
	}

	findFastAngle(dropSpeed: number, maxSpeed: number, maxAccel: number) {
		const threshold = maxSpeed - maxAccel;
		return Math.acos(dropSpeed < threshold ? 1 : threshold / dropSpeed);
	}

	findTurnAngle(speed: number, dropSpeed: number, maxAccel: number, fastCgazAngle: number) {
		const threshold = speed - dropSpeed;
		return Math.max(Math.acos(maxAccel < threshold ? 1 : threshold / maxAccel), fastCgazAngle);
	}

	findStopAngle(
		maxAccel: number,
		speedSquared: number,
		dropSpeed: number,
		dropSpeedSquared: number,
		turnCgazAngle: number
	) {
		const top = speedSquared - dropSpeedSquared - maxAccel * maxAccel;
		const btm = 2 * maxAccel * dropSpeed;

		if (top >= btm) {
			return 0;
		} else if (-top >= btm) {
			return Math.PI;
		}

		return Math.max(Math.acos(btm < top ? 1 : top / btm), turnCgazAngle);
	}

	findSnapAngles(snapAccel: number): number[] {
		const singleAxisMax = Math.round(snapAccel);
		const breakPoints = this.findBreakPoints(snapAccel, singleAxisMax, []);

		const angles = breakPoints;
		const points = breakPoints.length;

		// mirror angles to fill [-Pi/2, Pi/2]
		for (let i = 0; i < points; ++i)
			angles.push(
				-breakPoints[i],
				MomMath.remapAngle(Math.PI * 0.5 - breakPoints[i]),
				MomMath.remapAngle(breakPoints[i] - Math.PI * 0.5)
			);

		return angles.sort((a, b) => a - b);
	}

	findBreakPoints(accel: number, value: number, breakPoints: number[]) {
		// get each rounding break point from the max single-axis value
		if (value > 0) {
			breakPoints.push(Math.acos((value - 0.5) / accel));
			breakPoints = this.findBreakPoints(accel, value - 1, breakPoints);
		}

		return breakPoints;
	}

	updateZone(
		zone: ZonePanel,
		left: number,
		right: number,
		offset: number,
		zoneClass: StyleObject,
		splitZone?: ZonePanel
	) {
		let wrap = right > left;

		zone.leftAngle = MomMath.remapAngle(left - offset);
		zone.rightAngle = MomMath.remapAngle(right - offset);

		wrap = zone.rightAngle > zone.leftAngle ? !wrap : wrap;

		// map angles to screen
		zone.leftPx = this.mapToScreen(zone.leftAngle);
		zone.rightPx = this.mapToScreen(zone.rightAngle);

		if (wrap && splitZone) {
			// draw second part of split zone
			this.applyClass(splitZone, zoneClass);
			splitZone.leftAngle = -this.halfHFov;
			splitZone.rightAngle = zone.rightAngle;
			splitZone.leftPx = this.mapToScreen(splitZone.leftAngle);
			splitZone.rightPx = this.mapToScreen(splitZone.rightAngle);
			this.drawZone(splitZone);

			zone.rightAngle = this.halfHFov;
			zone.rightPx = this.mapToScreen(zone.rightAngle);
		}
		this.drawZone(zone);
	}

	drawZone(zone: ZonePanel) {
		// assign widths
		const width = zone.rightPx - zone.leftPx;
		zone.style.width = this.NaNCheck(Number(width).toFixed(0), 0) + 'px';

		// assign position via position (center screen at 0)
		zone.style.position = `${this.NaNCheck(Number(zone.leftPx).toFixed(0), 0)}px 0px 0px`;
	}

	setupContainer(container: GenericPanel, offset: number) {
		container.style.verticalAlign = 'center';
		container.style.transform = `translatey( ${this.NaNCheck(-offset, 0)}px )`;
		container.style.overflow = 'noclip noclip';
	}

	applyClass(panel: GenericPanel, zoneClass: StyleObject) {
		panel.style.height = this.NaNCheck(zoneClass.height, 0) + 'px';
		panel.style.verticalAlign = zoneClass.align;
		panel.style.backgroundColor = zoneClass.color;
		panel.style.overflow = 'noclip noclip';
	}

	applyClassBorder(panel: GenericPanel, thickness: number, zoneClass: StyleObject) {
		panel.style.height = this.NaNCheck(zoneClass.height, 0) + 'px';
		panel.style.border = `${thickness}px solid ${zoneClass.color}`;
		panel.style.padding = `-${thickness}px`;
		panel.style.verticalAlign = zoneClass.align;
		panel.style.overflow = 'noclip noclip';
	}

	setupArrow(
		arrow: GenericPanel,
		arrowIcon: Image,
		height: number,
		width: number,
		offset: number,
		align: Style['verticalAlign'],
		color: rgbaColor
	) {
		arrow.style.height = this.NaNCheck(height, 0) + 'px';
		arrow.style.width = this.NaNCheck(width, 0) + 'px';
		arrow.style.verticalAlign = 'center';
		arrow.style.transform = `translatey( ${this.NaNCheck(-offset, 0)}px )`;
		arrow.style.overflow = 'noclip noclip';

		arrowIcon.style.height = this.NaNCheck(width, 0) + 'px';
		arrowIcon.style.width = this.NaNCheck(width, 0) + 'px';
		arrowIcon.style.washColor = rgbaStringToRgb(color);
		arrowIcon.style.overflow = 'noclip noclip';
		arrowIcon.style.verticalAlign = align;
	}

	clearZones(zones: ZonePanel[]) {
		for (const zone of zones) {
			zone.leftPx = 0;
			zone.rightPx = 0;
			this.drawZone(zone);
		}
	}

	NaNCheck(val: string | number, def: number): number {
		return Number.isNaN(Number(val)) ? def : (val as number);
	}

	initZonePanel(panel: Panel): ZonePanel {
		return Object.assign(panel, {
			leftAngle: 0,
			rightAngle: 0,
			leftPx: 0,
			rightPx: 0,
			isInactive: false,
			color: '' as rgbaColor
		});
	}
}
