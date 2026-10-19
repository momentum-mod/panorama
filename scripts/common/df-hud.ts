import * as MomMath from 'util/math';
import { rgbaStringToRgb } from 'util/colors';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import {
	CustomizerComponentProperties,
	CustomizerPropertyType,
	registerHUDCustomizerComponent
} from 'common/hud-customizer';

export const AIR_ACCEL = 1;
export const DEFAULT_ACCEL = 2.56;
export const DEFAULT_SPEED = 320;
export const HASTE_ACCEL = 3.328; // (max speed) * (air accel = 1) * (tick interval) * (haste factor)
export const HASTE_SPEED = 416;

/** Speed of the made-up strafe the components draw while the HUD customizer is open */
export const PREVIEW_SPEED = 600;

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
	color: rgbaColor;
	align: Style['verticalAlign'];

	constructor(height: number, color: rgbaColor) {
		this.height = height;
		this.align = 'center';
		this.color = color;
	}
}

/** Highlight checks the pitch and compass share with the angles component, so the numbers light up with them */
export interface DFHudHighlights {
	pitch?: (state: DefragAPI.HUDFrameState) => boolean;
	yaw?: (state: DefragAPI.HUDFrameState) => boolean;
}

/** The shared highlight checks; components each run in their own context, so they meet on the global object */
export function getDFHudHighlights(): DFHudHighlights {
	const global = UiToolkitAPI.GetGlobalObject();
	global['DFHudHighlights'] ??= {};
	return global['DFHudHighlights'] as DFHudHighlights;
}

export type DFHudStyle = NonNullable<CustomizerComponentProperties['dynamicStyles']>[string];

/** Extra properties for a style, where `tooltip` is a localization token */
type DFHudStyleExtra = { tooltip?: string } & Record<string, unknown>;

function localizeExtra({ tooltip, ...extra }: DFHudStyleExtra) {
	return tooltip ? { ...extra, tooltip: $.Localize(tooltip) } : extra;
}

/** Movement to build a made-up frame from, see DFHudComponent.previewState */
export interface PreviewMovement {
	speed: number;
	/** Radians */
	velAngle: number;
	/** Radians; ignored when wishSpeed is 0 */
	wishAngle: number;
	wishSpeed: number;
	acceleration: number;
}

/**
 * Shared base for the DF HUD components. Each component is a late-updating C++ shell (MomHudDF<Component>) whose
 * HudProcessInput runs once per rendered frame, after the view is set up, and reads everything view- and
 * movement-related from DefragAPI.GetHUDFrameState() (through getFrameState) so all components agree within a frame.
 * Settings come from the HUD customizer.
 */
export abstract class DFHudComponent {
	screenY = $.GetContextPanel().actuallayoutheight;
	screenX = $.GetContextPanel().actuallayoutwidth;
	scale = $.GetContextPanel().actualuiscale_y;
	/** Screen pixels per layout px horizontally; Panorama scales every px length by this */
	scaleX = $.GetContextPanel().actualuiscale_x;
	/** Half of the horizontal FOV (crosshair to screen edge), in radians */
	halfHFov = 0;
	/** Half of the vertical FOV (crosshair to screen edge), in radians */
	halfVFov = 0;
	projection: ProjectionMode = DefragAPI.GetHUDProjection();

	maxGroundSpeed = DEFAULT_SPEED; // changes with haste status
	snapAccel = 0;
	snapAngles: number[] = [];

	/** Whether the HUD customizer is open, so the component draws a made-up frame to be seen while placing it */
	bPreview = false;
	/** Whether the customizer settings have been applied, so there is something to draw with */
	bConfigured = false;

	constructor() {
		$.RegisterForUnhandledEvent('OnDefragHUDProjectionChange', () => {
			this.projection = DefragAPI.GetHUDProjection();
		});
		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => (this.bPreview = true));
		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => (this.bPreview = false));

		// The C++ shell only processes input while the panel is enabled (customizer toggle), in DF modes and first person
		$.RegisterEventHandler('HudProcessInput', $.GetContextPanel(), () => this.bConfigured && this.onUpdate());
	}

	abstract onUpdate(): void;

	/** Applies the current customizer settings to the panels. Runs once all settings have loaded and on every change. */
	abstract applyConfig(): void;

	/**
	 * Registers the component with the HUD customizer. Strips span the screen width and only move vertically, since
	 * everything in them is placed by its angle from the crosshair. `properties.description` is a localization token.
	 */
	registerComponent(
		name: string,
		gamemode: Gamemode | Gamemode[],
		dynamicStyles: Record<string, DFHudStyle>,
		properties: Partial<CustomizerComponentProperties> = {}
	) {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize(name),
			resizeX: false,
			resizeY: false,
			moveX: false,
			gamemode,
			dynamicStyles,
			postInit: () => {
				this.applyConfig();
				this.bConfigured = true;
			},
			...properties,
			description: properties.description && $.Localize(properties.description)
		});
	}

	numberStyle(name: string, min: number, max: number, set: (value: number) => void, extra: DFHudStyleExtra = {}) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.NUMBER_ENTRY,
			settingProps: { min, max },
			callbackFunc: (_: GenericPanel, value: number) => set(value),
			onChanged: () => this.applyConfig(),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	checkboxStyle(name: string, set: (value: boolean) => void, extra: DFHudStyleExtra = {}) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.CHECKBOX,
			callbackFunc: (_: GenericPanel, value: boolean) => set(value),
			onChanged: () => this.applyConfig(),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	colorStyle(name: string, set: (value: rgbaColor) => void, extra: DFHudStyleExtra = {}) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.COLOR_PICKER,
			callbackFunc: (_: GenericPanel, value: rgbaColor) => set(value),
			onChanged: () => this.applyConfig(),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	dropdownStyle(
		name: string,
		options: Array<{ label: string; value: string }>,
		set: (value: string) => void,
		extra: DFHudStyleExtra = {}
	) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.DROPDOWN,
			options: options.map(({ label, value }) => ({ label: $.Localize(label), value })),
			callbackFunc: (_: GenericPanel, value: string) => set(value),
			onChanged: () => this.applyConfig(),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	groupStyle(name: string, children: string[], extra: DFHudStyleExtra = {}) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.NONE,
			expandable: true,
			children: children.map((styleID) => ({ styleID })),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	/** Sets the strip's height, which is what the customizer shows and drags. */
	setStripHeight(height: number) {
		$.GetContextPanel().style.height = Math.max(this.NaNCheck(height, 0), 1) + 'px';
	}

	/** This frame's state, or a made-up strafe on this frame's view while the customizer is open. */
	getFrameState(): DefragAPI.HUDFrameState {
		const state = DefragAPI.GetHUDFrameState();
		return this.bPreview && state.valid ? this.previewState(state) : state;
	}

	/**
	 * The made-up frame the customizer preview draws: a W+D air strafe at the angle of max speed gain. Components
	 * that only show for other inputs override this.
	 */
	previewState(state: DefragAPI.HUDFrameState): DefragAPI.HUDFrameState {
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const maxSpeed = state.maxspeed > 0 ? state.maxspeed : DEFAULT_SPEED;
		const wishAngle = MomMath.remapAngle(viewAngle - Math.PI * 0.25);
		const maxAccel = AIR_ACCEL * maxSpeed * state.tickInterval;
		const velAngle = MomMath.remapAngle(wishAngle + this.findFastAngle(PREVIEW_SPEED, maxSpeed, maxAccel));
		return this.withMovement(state, {
			speed: PREVIEW_SPEED,
			velAngle,
			wishAngle,
			wishSpeed: maxSpeed,
			acceleration: AIR_ACCEL
		});
	}

	/** A copy of the frame state in the air with the given movement, derived the same way as CDFHudFrameState. */
	withMovement(state: DefragAPI.HUDFrameState, movement: PreviewMovement): DefragAPI.HUDFrameState {
		const { speed, velAngle, wishSpeed, acceleration } = movement;
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const wishDir =
			wishSpeed > 0
				? { x: Math.cos(movement.wishAngle), y: Math.sin(movement.wishAngle), z: 0 }
				: { x: 0, y: 0, z: 0 };
		const wishAngle = wishSpeed > 0 ? movement.wishAngle : 0;

		const viewDir = { x: Math.cos(viewAngle), y: Math.sin(viewAngle) };
		const crossViewWish = viewDir.x * wishDir.y - viewDir.y * wishDir.x;
		const forwardMove = Math.round(viewDir.x * wishDir.x + viewDir.y * wishDir.y);
		const rightMove = Math.round(crossViewWish);
		const crossWishView = -crossViewWish;
		const inputMode =
			Math.round(MomMath.magnitude(wishDir)) * (1 << Math.round(2 * crossWishView * crossWishView)) +
			(Math.round(crossWishView) > 0 ? 1 : 0);
		const bAirControlPhysics = state.physicsMode !== DefragAPI.DefragPhysics.VQ3;

		return {
			...state,
			velocity: { x: speed * Math.cos(velAngle), y: speed * Math.sin(velAngle), z: 0 },
			speed,
			dropSpeed: speed,
			wishVel: { x: wishDir.x * wishSpeed, y: wishDir.y * wishSpeed, z: 0 },
			acceleration,
			friction: 0,
			maxspeed: state.maxspeed > 0 ? state.maxspeed : DEFAULT_SPEED,
			moveStatus: MomentumMovementAPI.PlayerMoveStatus.AIR,
			hasteTime: 0,
			wishDir,
			wishAngle,
			velAngle,
			forwardMove,
			rightMove,
			inputMode,
			falling: true,
			snapShift: Math.abs(forwardMove) !== Math.abs(rightMove) && !bAirControlPhysics,
			airControl:
				bAirControlPhysics && wishSpeed > 0 && Math.abs(MomMath.remapAngle(wishAngle - viewAngle)) < 0.01
		};
	}

	/** Pull this frame's screen size and FOV. */
	updateView(state: DefragAPI.HUDFrameState) {
		this.screenY = $.GetContextPanel().actuallayoutheight;
		this.screenX = $.GetContextPanel().actuallayoutwidth;
		this.scale = $.GetContextPanel().actualuiscale_y;
		this.scaleX = $.GetContextPanel().actualuiscale_x;
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

	/**
	 * Maps an angle to a layout px position that lands exactly on a screen pixel. Layout px are scaled by the UI
	 * scale (1080p reference), so rounding in layout px would put edges between screen pixels at 1440p and 4K.
	 */
	mapToScreen(angle: number): number {
		return MomMath.mapAngleToScreenDist(angle, this.halfHFov, this.screenX, 1, this.projection) / this.scaleX;
	}

	/**
	 * A layout px length as a style value covering exactly the given number of whole screen pixels. Panorama rounds
	 * a panel's scaled size up to a whole pixel, so the length is pulled just under it to keep the next pixel free.
	 */
	pixelLength(length: number, uiScale: number): string {
		const pixels = Math.round(this.NaNCheck(length, 0) * uiScale);
		return pixels > 0 ? ((pixels - 0.01) / uiScale).toFixed(4) + 'px' : '0px';
	}

	/** A layout px offset as a style value landing exactly on a screen pixel. */
	pixelOffset(offset: number, uiScale: number): string {
		return (Math.round(this.NaNCheck(offset, 0) * uiScale) / uiScale).toFixed(4) + 'px';
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
		// edges are already on screen pixels, so neighbouring zones meet without a gap or an overlap
		zone.style.width = this.pixelLength(zone.rightPx - zone.leftPx, this.scaleX);

		// assign position via position (center screen at 0)
		zone.style.position = `${this.pixelOffset(zone.leftPx, this.scaleX)} 0px 0px`;
	}

	setupContainer(container: GenericPanel) {
		container.style.height = '100%';
		container.style.verticalAlign = 'center';
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
		align: Style['verticalAlign'],
		color: rgbaColor
	) {
		arrow.style.height = this.NaNCheck(height, 0) + 'px';
		arrow.style.width = this.NaNCheck(width, 0) + 'px';
		arrow.style.verticalAlign = 'center';
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
