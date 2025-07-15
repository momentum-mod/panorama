import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategories, GamemodeCategory } from 'common/web';
import * as MomMath from 'util/math';
import { enhanceAlpha, rgbaStringLerp, rgbaStringToRgb } from 'util/colors';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';

let MAX_GROUND_SPEED = 320; // initialized to 320. Changes with haste status.
const AIR_ACCEL = 1;
const DEFAULT_ACCEL = 2.56;
const DEFAULT_SPEED = 320;
const HASTE_ACCEL = 3.328; // (max speed) * (air accel = 1) * (tick interval) * (haste factor)
const HASTE_SPEED = 416;

enum TruenessMode {
	GROUND = 1 << 0, // show ground zones
	PROJECTED = 1 << 1, // show zones scaled by +jump/+crouch
	CPM_TURN = 1 << 2 // show a/d and ground zones
}

export enum ProjectionMode {
	PERSPECTIVE = 0,
	ARC_LENGTH = 1,
	PANORAMIC = 2
}

enum InputMode {
	NONE = 0,
	AIR_CONTROL = 1,
	STRAFE_LEFT = 2,
	STRAFE_RIGHT = 3,
	TURN_LEFT = 4,
	TURN_RIGHT = 5
}

interface ZonePanel extends Panel {
	leftAngle: number;
	rightAngle: number;
	leftPx: number;
	rightPx: number;
	isInactive: boolean;
	color: rgbaColor;
}

let NEUTRAL_CLASS: StyleObject;
let SLOW_CLASS: StyleObject;
let FAST_CLASS: StyleObject;
let TURN_CLASS: StyleObject;
let WIN_ZONE_CLASS: StyleObject;
let MIRROR_CLASS: StyleObject;
let COMPASS_CLASS: StyleObject;
let HIGHLIGHT_CLASS: StyleObject;

let COLORED_SNAP_CLASS: StyleObject;
let UNCOLORED_SNAP_CLASS: StyleObject;
let HIGHLIGHTED_SNAP_CLASS: StyleObject;
let HIGHLIGHTED_ALT_SNAP_CLASS: StyleObject;

let PRIME_SIGHT_CLASS: StyleObject;

class StyleObject {
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

@PanelHandler()
class CgazHandler {
	accelContainer = $('#AccelContainer');
	accelZones: ZonePanel[] = [
		'LeftTurnZone',
		'LeftFastZone',
		'LeftSlowZone',
		'DeadZone',
		'RightSlowZone',
		'RightFastZone',
		'RightTurnZone',
		'AccelSplitZone',
		'LeftMirrorZone',
		'RightMirrorZone',
		'MirrorSplitZone'
	].map((id) => this.initZonePanel($('#' + id)));

	leftTurnZone = this.accelZones[0];
	leftFastZone = this.accelZones[1];
	leftSlowZone = this.accelZones[2];
	deadZone = this.accelZones[3];
	rightSlowZone = this.accelZones[4];
	rightFastZone = this.accelZones[5];
	rightTurnZone = this.accelZones[6];
	accelSplitZone = this.accelZones[7];

	leftMirrorZone = this.accelZones[8];
	rightMirrorZone = this.accelZones[9];
	mirrorSplitZone = this.accelZones[10];

	snapContainer = $('#SnapContainer');
	snapZones: ZonePanel[] = [];
	snapSplitZone = this.initZonePanel($.CreatePanel('Panel', this.snapContainer, 'SnapSplitZone'));

	primeContainer = $('#PrimeContainer');
	primeZones: ZonePanel[] = [];
	primeFirstZoneLeft = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneLeft'));
	primeFirstZoneRight = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneRight'));
	primeSplitZone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeSplitZone'));
	primeHighlightZone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeHighlightZone'));
	primeArrow = $('#PrimeArrow');
	primeArrowIcon = $<Image>('#PrimeArrowIcon');
	primeAccel: number;

	compassArrow = $('#CompassArrow');
	compassArrowIcon = $<Image>('#CompassArrowIcon');
	tickContainer = $('#CompassTicks');
	pitchLineContainer = $('#PitchLines');
	pitchStat = $<Label>('#PitchStat');
	yawStat = $<Label>('#YawStat');

	windicatorArrow = $('#WindicatorArrow');
	windicatorArrowIcon = $<Image>('#WindicatorArrowIcon');
	windicatorZone = this.initZonePanel($('#WindicatorZone'));

	screenY = $.GetContextPanel().actuallayoutheight;
	screenX = $.GetContextPanel().actuallayoutwidth;
	scale = $.GetContextPanel().actualuiscale_y;
	fov4By3 = GameInterfaceAPI.GetSettingFloat('fov_desired'); //source uses 4:3 for fov setting
	vFovTangent = 0.75 * Math.tan((0.5 * this.fov4By3 * Math.PI) / 180);
	vFov = Math.atan(this.vFovTangent);
	hFov = Math.atan((this.vFovTangent * this.screenX) / this.screenY);
	theta = Math.PI * 0.5 - 2 * Math.atan(Math.sqrt(2 + Math.sqrt(3)));
	halfPi = 0.5 * Math.PI;
	primeAngles: number[] = [];
	snapGainRange: number[] = []; // stored as [min, max]
	snapAngles: number[] = [];
	snapAccel = 0;
	bShouldUpdateStyles = false;

	projection: ProjectionMode;
	hudFov: number;

	accelEnable: boolean;
	accelMinSpeed: float;
	accelHeight: float;
	accelOffset: float;
	accelSlowColor: rgbaColor;
	accelFastColor: rgbaColor;
	accelTurnColor: rgbaColor;
	accelDzColor: rgbaColor;
	accelScaleEnable: boolean;
	accelMirrorEnable: boolean;
	accelMirrorBorder: int32;

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

	primeEnable: boolean;
	primeTruenessMode: int32;
	primeShowInactive: boolean;
	primeLockOneLine: boolean;
	primeMinSpeed: float;
	primeHeight: float;
	primeOffset: float;
	primeGainColor: rgbaColor;
	primeLossColor: rgbaColor;
	primeAltColor: rgbaColor;
	primeHlEnable: boolean;
	primeHlBorder: int32;
	primeHlColor: rgbaColor;
	primeHeightgainEnable: boolean;
	primeColorgainEnable: boolean;
	primeArrowEnable: boolean;
	primeArrowSize: float;
	primeArrowColor: rgbaColor;

	windicatorEnable: boolean;
	windicatorHeight: float;
	windicatorOffset: float;
	windicatorSize: float;
	windicatorColor: rgbaColor;
	windicatorBorder: int32;

	compassMode: int32;
	compassArrowSize: float;
	compassTickSize: float;
	compassOffset: float;
	compassPitchEnable: boolean;
	compassPitchTarget: number[];
	compassPitchWidth: float;
	compassPitchOffset: float;
	compassStatMode: int32;
	compassColor: rgbaColor;
	compassHlColor: rgbaColor;

	updateHandle: uuid = null;

	constructor() {
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

		$.RegisterForUnhandledEvent('OnDefragHUDProjectionChange', () => this.onProjectionChange());
		$.RegisterForUnhandledEvent('OnDefragHUDFOVChange', () => this.onHudFovChange());
		$.RegisterForUnhandledEvent('OnDefragHUDAccelChange', () => this.onAccelConfigChange());
		$.RegisterForUnhandledEvent('OnDefragHUDSnapChange', () => this.onSnapConfigChange());
		$.RegisterForUnhandledEvent('OnDefragHUDPrimeChange', () => this.onPrimeConfigChange());
		$.RegisterForUnhandledEvent('OnDefragHUDWIndicatorChange', () => this.onWindicatorConfigChange());
		$.RegisterForUnhandledEvent('OnDefragHUDCompassChange', () => this.onCompassConfigChange());
	}

	onLoad() {
		this.onAccelConfigChange();
		this.onSnapConfigChange();
		this.onPrimeConfigChange();
		this.onProjectionChange();
		this.onHudFovChange();
		this.onSnapConfigChange();
		this.onWindicatorConfigChange();
		this.onCompassConfigChange();
	}

	onProjectionChange() {
		this.projection = DefragAPI.GetHUDProjection();
		this.bShouldUpdateStyles = true;
	}

	onHudFovChange() {
		this.hudFov = DefragAPI.GetHUDFOV();
		this.bShouldUpdateStyles = true;
	}

	onAccelConfigChange() {
		const accelConfig = DefragAPI.GetHUDAccelCFG();
		this.accelEnable = accelConfig.enable;
		this.accelMinSpeed = accelConfig.minSpeed;
		this.accelHeight = accelConfig.height;
		this.accelOffset = accelConfig.offset;
		this.accelSlowColor = accelConfig.slowColor;
		this.accelFastColor = accelConfig.fastColor;
		this.accelTurnColor = accelConfig.turnColor;
		this.accelDzColor = accelConfig.dzColor;
		this.accelScaleEnable = accelConfig.scaleEnable;
		this.accelMirrorEnable = accelConfig.mirrorEnable;
		this.accelMirrorBorder = Math.round(accelConfig.mirrorBorder);

		NEUTRAL_CLASS = new StyleObject(this.accelHeight, this.accelOffset, this.accelDzColor);
		SLOW_CLASS = new StyleObject(this.accelHeight, this.accelOffset, this.accelSlowColor);
		FAST_CLASS = new StyleObject(this.accelHeight, this.accelOffset, this.accelFastColor);
		TURN_CLASS = new StyleObject(this.accelHeight, this.accelOffset, this.accelTurnColor);
		MIRROR_CLASS = new StyleObject(this.accelHeight, this.accelOffset, this.accelSlowColor);

		this.setupContainer(this.accelContainer, this.accelOffset);
		this.applyClass(this.leftTurnZone, TURN_CLASS);
		this.applyClass(this.leftFastZone, FAST_CLASS);
		this.applyClass(this.leftSlowZone, SLOW_CLASS);
		this.applyClass(this.deadZone, NEUTRAL_CLASS);
		this.applyClass(this.rightSlowZone, SLOW_CLASS);
		this.applyClass(this.rightFastZone, FAST_CLASS);
		this.applyClass(this.rightTurnZone, TURN_CLASS);
		this.applyClass(this.accelSplitZone, NEUTRAL_CLASS);
		this.applyClassBorder(this.leftMirrorZone, this.accelMirrorBorder, MIRROR_CLASS);
		this.applyClassBorder(this.rightMirrorZone, this.accelMirrorBorder, MIRROR_CLASS);
		this.applyClassBorder(this.mirrorSplitZone, this.accelMirrorBorder, MIRROR_CLASS);
	}

	onSnapConfigChange() {
		const snapConfig = DefragAPI.GetHUDSnapCFG();
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

	onPrimeConfigChange() {
		const primeConfig = DefragAPI.GetHUDPrimeCFG();
		this.primeEnable = primeConfig.enable;
		this.primeTruenessMode = primeConfig.truenessMode;
		this.primeShowInactive = primeConfig.inactiveEnable;
		this.primeLockOneLine = primeConfig.oneLineEnable;
		this.primeMinSpeed = primeConfig.minSpeed;
		this.primeHeight = primeConfig.height;
		this.primeOffset = primeConfig.offset;
		this.primeGainColor = primeConfig.gainColor;
		this.primeLossColor = primeConfig.lossColor;
		this.primeAltColor = primeConfig.altColor;
		this.primeHlEnable = primeConfig.highlightEnable;
		this.primeHlBorder = Math.round(primeConfig.highlightBorder);
		this.primeHlColor = primeConfig.highlightColor;
		this.primeHeightgainEnable = primeConfig.scaleHeightEnable;
		this.primeColorgainEnable = primeConfig.scaleColorEnable;
		this.primeArrowEnable = primeConfig.arrowEnable;
		this.primeArrowSize = primeConfig.arrowSize;
		this.primeArrowColor = primeConfig.arrowColor;

		PRIME_SIGHT_CLASS = new StyleObject(this.primeHeight, this.primeOffset, this.primeAltColor);
		HIGHLIGHT_CLASS = new StyleObject(this.primeHeight, this.primeOffset, this.primeHlColor);

		this.setupContainer(this.primeContainer, this.primeOffset);
		this.primeContainer.style.verticalAlign = 'center';
		this.primeContainer.style.height = 2 * this.primeHeight + 'px';
		for (const zone of this.primeZones) {
			this.applyClass(zone, PRIME_SIGHT_CLASS);
			zone.style.verticalAlign = 'top';
		}
		this.applyClass(this.primeFirstZoneLeft, PRIME_SIGHT_CLASS);
		this.primeFirstZoneLeft.style.verticalAlign = 'top';
		this.applyClass(this.primeFirstZoneRight, PRIME_SIGHT_CLASS);
		this.primeFirstZoneRight.style.verticalAlign = 'top';
		this.applyClass(this.primeSplitZone, PRIME_SIGHT_CLASS);
		this.primeSplitZone.style.verticalAlign = 'top';

		this.applyClassBorder(this.primeHighlightZone, this.primeHlBorder, HIGHLIGHT_CLASS);
		this.primeHighlightZone.style.verticalAlign = 'top';
		this.primeHighlightZone.style.zIndex = 1;

		const containerHeight = 2 * this.primeHeight;
		const width = 2 * this.primeArrowSize;
		const height = containerHeight + 2 * width;
		this.setupArrow(
			this.primeArrow,
			this.primeArrowIcon,
			height,
			width,
			this.primeOffset,
			'top',
			this.primeArrowColor
		);
	}

	onWindicatorConfigChange() {
		const windicatorConfig = DefragAPI.GetHUDWIndicatorCFG();
		this.windicatorEnable = windicatorConfig.enable;
		this.windicatorHeight = windicatorConfig.height;
		this.windicatorOffset = windicatorConfig.offset;
		this.windicatorSize = windicatorConfig.size;
		this.windicatorOffset = windicatorConfig.offset;
		this.windicatorColor = windicatorConfig.color;
		this.windicatorBorder = Math.round(windicatorConfig.border);

		const arrowWidth = 2 * this.windicatorSize;
		const arrowHeight = 2 * arrowWidth;
		this.setupArrow(
			this.windicatorArrow,
			this.windicatorArrowIcon,
			arrowHeight,
			arrowWidth,
			this.windicatorOffset,
			'top',
			this.windicatorColor
		);

		WIN_ZONE_CLASS = new StyleObject(this.windicatorHeight, this.windicatorOffset, this.windicatorColor);
		this.applyClassBorder(this.windicatorZone, this.windicatorBorder, WIN_ZONE_CLASS);
	}

	onCompassConfigChange() {
		const compassConfig = DefragAPI.GetHUDCompassCFG();
		this.compassMode = compassConfig.compassMode;
		this.compassArrowSize = compassConfig.compassArrowSize;
		this.compassTickSize = compassConfig.compassTickSize;
		this.compassOffset = compassConfig.compassOffset;
		this.compassPitchEnable = compassConfig.pitchEnable;
		this.compassPitchTarget = String(compassConfig.pitchTarget).split(' ').map(Number);
		this.compassPitchWidth = compassConfig.pitchWidth;
		this.compassPitchOffset = compassConfig.pitchOffset;
		this.compassStatMode = compassConfig.statMode;
		this.compassColor = compassConfig.color;
		this.compassHlColor = compassConfig.highlightColor;

		this.pitchLineContainer.style.width = this.compassPitchWidth + 'px';
		this.pitchLineContainer.style.transform = `translatex( ${this.compassPitchOffset}px )`;

		const pitchLines = this.pitchLineContainer?.Children();
		if (this.compassPitchTarget.length > pitchLines?.length) {
			for (let i = pitchLines?.length; i < this.compassPitchTarget.length; ++i) {
				$.CreatePanel('Panel', this.pitchLineContainer, `PitchTarget${i}`, {
					class: 'cgaz-line'
				});
			}
		}
		if (this.compassPitchTarget.length < pitchLines?.length) {
			for (let i = this.compassPitchTarget.length; i < pitchLines?.length; ++i) {
				pitchLines[i].DeleteAsync(0);
			}
		}

		this.tickContainer.style.height = this.compassTickSize + 'px';
		this.tickContainer.style.transform = `translatey( ${this.compassOffset - 0.5 * this.compassTickSize}px )`;

		const compassTicks = this.tickContainer?.Children();
		if (compassTicks?.length < 4) {
			// only up to 180 degrees are ever shown, so  only 4 ticks are
			// needed to represent all potentially visible 45-degree marks
			for (let i = compassTicks?.length; i < 4; ++i) {
				const newTick = $.CreatePanel('Panel', this.tickContainer, `CompassTick${i}`, {
					class: 'cgaz-tick'
				});
				newTick.AddClass(i % 2 ? 'cgaz-tick__half' : 'cgaz-tick__full');
			}
		}

		const width = 2 * this.compassArrowSize;
		const height = 2 * width;
		this.setupArrow(
			this.compassArrow,
			this.compassArrowIcon,
			height,
			width,
			this.compassOffset,
			'bottom',
			this.compassColor
		);
	}

	onUpdate() {
		// clear last frame's special zones
		this.clearZones([
			this.accelSplitZone,
			this.snapSplitZone,
			this.mirrorSplitZone,
			this.primeSplitZone,
			this.primeFirstZoneLeft,
			this.primeFirstZoneRight,
			this.primeHighlightZone
		]);

		this.screenY = $.GetContextPanel().actuallayoutheight;
		this.screenX = $.GetContextPanel().actuallayoutwidth;
		this.scale = $.GetContextPanel().actualuiscale_y;
		this.fov4By3 = this.hudFov || GameInterfaceAPI.GetSettingFloat('fov_desired'); //source uses 4:3 for fov setting
		this.vFovTangent = 0.75 * Math.tan((0.5 * this.fov4By3 * Math.PI) / 180);
		this.vFov = Math.atan(this.vFovTangent);
		this.hFov = Math.atan((this.vFovTangent * this.screenX) / this.screenY);

		const phyMode = DefragAPI.GetDFPhysicsMode();
		const lastMoveData = MomentumMovementAPI.GetLastMoveData();

		const tickInterval = MomentumMovementAPI.GetTickInterval();
		const maxSpeed = this.accelScaleEnable ? lastMoveData.wishspeed : lastMoveData.maxspeed;
		const accel = lastMoveData.acceleration;
		const maxAccel = accel * maxSpeed * tickInterval;

		if (lastMoveData.hasteTime) {
			if (this.snapAccel !== HASTE_ACCEL) {
				this.snapAccel = HASTE_ACCEL;
				MAX_GROUND_SPEED = HASTE_SPEED;

				// find snap zone borders with haste
				this.snapAngles = this.findSnapAngles(this.snapAccel);
			}
		} else {
			if (this.snapAccel !== DEFAULT_ACCEL) {
				this.snapAccel = DEFAULT_ACCEL;
				MAX_GROUND_SPEED = DEFAULT_SPEED;

				// find snap zone borders without haste
				this.snapAngles = this.findSnapAngles(this.snapAccel);
			}
		}

		if (this.snapAngles.length > this.snapZones?.length) {
			const start = this.snapZones?.length;
			const end = this.snapAngles.length;
			for (let i = start; i < end; ++i) {
				this.snapZones.push(this.initZonePanel($.CreatePanel('Panel', this.snapContainer, `SnapZone${i}`)));
			}
			this.onSnapConfigChange();
		} else if (this.snapAngles.length < this.snapZones?.length) {
			const start = this.snapZones?.length;
			const end = this.snapAngles.length;
			for (let i = start; i < end; ++i) {
				this.snapZones.pop().DeleteAsync(0);
			}
			this.onSnapConfigChange();
		}

		const velocity = MomentumPlayerAPI.GetVelocity();
		const speed = MomMath.magnitude2D(velocity);
		const stopSpeed = Math.max(speed, MomentumMovementAPI.GetStopspeed());
		const dropSpeed = Math.max(speed - stopSpeed * lastMoveData.friction * tickInterval, 0);
		const speedSquared = speed * speed;
		const dropSpeedSquared = dropSpeed * dropSpeed;

		const velDir = MomMath.normal2D(velocity, 0.001);
		const velAngle = Math.atan2(velocity.y, velocity.x);
		const wishDir = lastMoveData.wishdir;
		const wishAngle = MomMath.sumOfSquares2D(wishDir) > 0.001 ? Math.atan2(wishDir.y, wishDir.x) : 0;
		const viewAngle = (MomentumPlayerAPI.GetAngles().y * Math.PI) / 180;
		const viewDir = {
			x: Math.cos(viewAngle),
			y: Math.sin(viewAngle)
		};

		const forwardMove = Math.round(MomMath.dot2D(viewDir, wishDir));
		const rightMove = Math.round(MomMath.cross2D(viewDir, wishDir));

		const bIsFalling = lastMoveData.moveStatus === 0;
		const bHasAirControl = phyMode && MomMath.approxEquals(wishAngle, viewAngle, 0.01) && bIsFalling;
		const bSnapShift =
			!MomMath.approxEquals(Math.abs(forwardMove), Math.abs(rightMove), 0.01) && !(phyMode && bIsFalling);

		// find cgaz angles
		const angleOffset = MomMath.remapAngle(velAngle - wishAngle);
		const slowCgazAngle = this.findSlowAngle(dropSpeed, dropSpeedSquared, speedSquared, maxSpeed);
		const fastCgazAngle = this.findFastAngle(dropSpeed, maxSpeed, maxAccel);
		const turnCgazAngle = this.findTurnAngle(speed, dropSpeed, maxAccel, fastCgazAngle);
		const stopCgazAngle = this.findStopAngle(maxAccel, speedSquared, dropSpeed, dropSpeedSquared, turnCgazAngle);

		if (this.accelEnable) {
			// draw accel zones
			if (speed >= this.accelMinSpeed) {
				this.updateZone(
					this.leftTurnZone,
					-stopCgazAngle,
					-turnCgazAngle,
					angleOffset,
					TURN_CLASS,
					this.accelSplitZone
				);
				this.updateZone(
					this.leftFastZone,
					-turnCgazAngle,
					-fastCgazAngle,
					angleOffset,
					FAST_CLASS,
					this.accelSplitZone
				);
				this.updateZone(
					this.leftSlowZone,
					-fastCgazAngle,
					-slowCgazAngle,
					angleOffset,
					SLOW_CLASS,
					this.accelSplitZone
				);
				this.updateZone(
					this.deadZone,
					-slowCgazAngle,
					slowCgazAngle,
					angleOffset,
					NEUTRAL_CLASS,
					this.accelSplitZone
				);
				this.updateZone(
					this.rightSlowZone,
					slowCgazAngle,
					fastCgazAngle,
					angleOffset,
					SLOW_CLASS,
					this.accelSplitZone
				);
				this.updateZone(
					this.rightFastZone,
					fastCgazAngle,
					turnCgazAngle,
					angleOffset,
					FAST_CLASS,
					this.accelSplitZone
				);
				this.updateZone(
					this.rightTurnZone,
					turnCgazAngle,
					stopCgazAngle,
					angleOffset,
					TURN_CLASS,
					this.accelSplitZone
				);
			} else {
				this.clearZones(this.accelZones);
			}

			// draw mirrored strafe zones
			if (speed >= this.accelMinSpeed && this.accelMirrorEnable) {
				const mirrorAccel = (bIsFalling ? AIR_ACCEL : accel) * MAX_GROUND_SPEED * tickInterval;
				const minMirrorAngle = this.findSlowAngle(dropSpeed, dropSpeedSquared, speedSquared, MAX_GROUND_SPEED);
				const fastMirrorAngle = this.findFastAngle(dropSpeed, MAX_GROUND_SPEED, mirrorAccel);
				const turnMirrorAngle = this.findTurnAngle(speed, dropSpeed, mirrorAccel, fastMirrorAngle);
				const maxMirrorAngle = this.findStopAngle(
					mirrorAccel,
					speedSquared,
					dropSpeed,
					dropSpeedSquared,
					turnMirrorAngle
				);

				let mirrorOffset = MomMath.remapAngle(velAngle - viewAngle);
				const inputAngle = MomMath.remapAngle(viewAngle - wishAngle);

				if (MomMath.approxEquals(Math.abs(inputAngle), 0.25 * Math.PI, 0.01)) {
					mirrorOffset += (inputAngle > 0 ? -1 : 1) * Math.PI * 0.25;
					this.updateZone(
						this.leftMirrorZone,
						-maxMirrorAngle,
						-minMirrorAngle,
						mirrorOffset,
						MIRROR_CLASS,
						this.mirrorSplitZone
					);
					this.updateZone(
						this.rightMirrorZone,
						minMirrorAngle,
						maxMirrorAngle,
						mirrorOffset,
						MIRROR_CLASS,
						this.mirrorSplitZone
					);
				} else {
					this.updateZone(
						this.leftMirrorZone,
						-maxMirrorAngle,
						-minMirrorAngle,
						mirrorOffset - Math.PI * 0.25,
						MIRROR_CLASS,
						this.mirrorSplitZone
					);
					this.updateZone(
						this.rightMirrorZone,
						minMirrorAngle,
						maxMirrorAngle,
						mirrorOffset + Math.PI * 0.25,
						MIRROR_CLASS,
						this.mirrorSplitZone
					);
				}
			} else {
				this.clearZones([this.leftMirrorZone, this.rightMirrorZone]);
			}
		}

		if (this.snapEnable && this.snapAccel) {
			const snapOffset = MomMath.remapAngle(
				(bSnapShift ? 0 : Math.PI * 0.25 * (rightMove > 0 ? -1 : 1)) - viewAngle
			);

			// draw snap zones
			if (speed >= this.snapMinSpeed) {
				const targetOffset = MomMath.remapAngle(velAngle - viewAngle);
				const targetAngle = this.findFastAngle(dropSpeed, MAX_GROUND_SPEED, MAX_GROUND_SPEED * tickInterval);
				const leftTarget = -targetAngle - targetOffset + Math.PI * 0.25;
				const rightTarget = targetAngle - targetOffset - Math.PI * 0.25;
				this.updateSnaps(snapOffset, leftTarget, rightTarget);
			} else {
				this.clearZones(this.snapZones);
			}
		} else {
			this.clearZones(this.snapZones);
		}

		this.clearZones(this.primeZones);

		if (this.primeEnable) {
			const snapOffset = MomMath.remapAngle(
				(bSnapShift ? 0 : Math.PI * 0.25 * (rightMove > 0 ? -1 : 1)) - viewAngle
			);

			if (speed > this.primeMinSpeed) {
				const primeMaxSpeed =
					this.primeTruenessMode & TruenessMode.PROJECTED ? lastMoveData.wishspeed : lastMoveData.maxspeed;
				const primeMaxAccel = lastMoveData.acceleration * maxSpeed * tickInterval;
				const primeSightSpeed =
					this.primeTruenessMode & TruenessMode.CPM_TURN ? primeMaxSpeed : MAX_GROUND_SPEED;
				const primeSightAccel = this.primeTruenessMode & TruenessMode.CPM_TURN ? primeMaxAccel : this.snapAccel;

				if (this.primeAccel !== primeSightAccel) {
					this.primeAccel = primeSightAccel;

					this.primeAngles = this.findSnapAngles(primeSightAccel);
				}

				if (this.primeAngles.length > this.primeZones?.length) {
					const start = this.primeZones?.length;
					const end = this.primeAngles.length;
					for (let i = start; i < end; ++i) {
						const panel = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, `PrimeZone${i}`));
						panel.style.verticalAlign = 'top';
						panel.color = this.primeAltColor; // add color property to the zone object, used for highlight
						this.primeZones.push(panel);
					}
					this.onPrimeConfigChange();
				} else if (this.primeAngles.length < this.primeZones?.length) {
					const start = this.primeAngles.length;
					const end = this.primeZones?.length;
					for (let i = start; i < end; ++i) {
						this.primeZones.pop().DeleteAsync(0);
					}
					this.onPrimeConfigChange();
				}

				const targetAngle = this.findFastAngle(dropSpeed, primeSightSpeed, primeSightAccel);
				const boundaryAngle = this.findStopAngle(
					primeSightAccel,
					speedSquared,
					dropSpeed,
					dropSpeedSquared,
					targetAngle
				);
				this.updatePrimeSight(viewDir, viewAngle, targetAngle, boundaryAngle, velAngle, wishDir, wishAngle);

				// arrow
				if (this.primeArrowEnable) {
					if (MomMath.sumOfSquares2D(wishDir) > 0) {
						let arrowAngle =
							wishAngle -
							Math.atan2(
								Math.round(this.primeAccel * wishDir.y),
								Math.round(this.primeAccel * wishDir.x)
							);
						if (Math.abs(arrowAngle) < this.hFov) {
							this.compassArrowIcon.RemoveClass('arrow__down');
							this.compassArrowIcon.AddClass('arrow__up');
						} else {
							this.compassArrowIcon.RemoveClass('arrow__up');
							this.compassArrowIcon.AddClass('arrow__down');
							arrowAngle = MomMath.remapAngle(arrowAngle + Math.PI);
						}
						const leftEdge =
							MomMath.mapAngleToScreenDist(
								arrowAngle,
								this.hFov,
								this.screenX,
								this.scale,
								this.projection
							) - this.primeArrowSize;
						this.primeArrow.style.position = `${this.NaNCheck(leftEdge, 0)}px 0px 0px`;
						this.primeArrow.visible = true;
					} else {
						this.primeArrow.visible = false;
					}
				}
			}
		}

		let velocityAngle = MomMath.remapAngle(viewAngle - velAngle);
		// compass
		if (this.compassMode) {
			const ticks = this.tickContainer.Children();

			const bShouldHighlight =
				Math.abs(MomMath.remapAngle(8 * velAngle) * 0.125) < 0.01 && speed >= this.accelMinSpeed;
			const color = bShouldHighlight ? this.compassHlColor : this.compassColor;

			// ticks
			for (const [i, tick] of ticks.entries()) {
				const tickAngle = this.NaNCheck(MomMath.wrapToHalfPi(viewAngle + i * 0.25 * Math.PI), 0);
				const tickPx = this.NaNCheck(
					MomMath.mapAngleToScreenDist(tickAngle, this.hFov, this.screenX, this.scale, this.projection),
					0
				);
				tick.style.position = `${tickPx}px 0px 0px`;
				tick.style.backgroundColor = color;
			}

			// arrow
			if (Math.abs(velocityAngle) < this.hFov) {
				this.compassArrowIcon.RemoveClass('arrow__down');
				this.compassArrowIcon.AddClass('arrow__up');
			} else {
				this.compassArrowIcon.RemoveClass('arrow__up');
				this.compassArrowIcon.AddClass('arrow__down');
				velocityAngle = MomMath.remapAngle(velocityAngle - Math.PI);
			}
			const leftEdge =
				MomMath.mapAngleToScreenDist(velocityAngle, this.hFov, this.screenX, this.scale, this.projection) -
				this.compassArrowSize;
			this.compassArrow.style.position = `${this.NaNCheck(leftEdge, 0)}px 0px 0px`;
			this.compassArrowIcon.style.washColor = rgbaStringToRgb(color);
		}
		this.compassArrow.visible = this.compassMode % 2 && speed >= this.accelMinSpeed;
		this.tickContainer.visible = this.compassMode > 1;

		// pitch line
		if (this.compassPitchEnable) {
			const pitchLines = this.pitchLineContainer.Children();
			for (let i = 0; i < pitchLines?.length; ++i) {
				const viewPitch = MomentumPlayerAPI.GetAngles().x;
				const pitchDelta = this.compassPitchTarget[i] - viewPitch;
				const pitchDeltaPx = MomMath.mapAngleToScreenDist(
					(pitchDelta * Math.PI) / 180,
					this.vFov,
					this.screenY,
					this.scale,
					this.projection
				);
				pitchLines[i].style.position = `0px ${this.NaNCheck(pitchDeltaPx, 0)}px 0px`;
				pitchLines[i].style.backgroundColor =
					Math.abs(pitchDelta) > 0.15 ? this.compassColor : this.compassHlColor;
			}
		}

		// compass stats
		if (this.compassStatMode) {
			this.yawStat.text = MomentumPlayerAPI.GetAngles().y.toFixed(0);
			this.yawStat.style.color =
				Math.abs(MomMath.remapAngle(8 * velAngle) * 0.125) < 0.01 && speed >= this.accelMinSpeed
					? this.compassHlColor
					: this.compassColor;

			this.pitchStat.text = MomentumPlayerAPI.GetAngles().x.toFixed(1);
			let bShouldHighlight = false;
			const viewPitch = MomentumPlayerAPI.GetAngles().x;
			for (const target of this.compassPitchTarget) {
				if (Math.abs(viewPitch - target) <= 0.15) bShouldHighlight = true;
			}
			this.pitchStat.style.color = bShouldHighlight ? this.compassHlColor : this.compassColor;
		}
		this.pitchStat.visible = this.compassStatMode % 2 !== 0;
		this.yawStat.visible = this.compassStatMode > 1;

		const wTurnAngle = velocityAngle > 0 ? velocityAngle + this.theta : velocityAngle - this.theta;
		// draw w-turn indicator
		if (this.windicatorEnable && Math.abs(wTurnAngle) < this.hFov && speed >= this.accelMinSpeed) {
			this.windicatorArrow.visible = true;
			const leftEdge =
				MomMath.mapAngleToScreenDist(wTurnAngle, this.hFov, this.screenX, this.scale, this.projection) -
				this.windicatorSize;
			this.windicatorArrow.style.position = `${this.NaNCheck(leftEdge, 0)}px 0px 0px`;

			const minAngle = Math.min(wTurnAngle, 0);
			const maxAngle = Math.max(wTurnAngle, 0);

			if (bHasAirControl) {
				this.updateZone(this.windicatorZone, minAngle, maxAngle, 0, WIN_ZONE_CLASS);
			} else {
				this.windicatorZone.style.width = '0px';
			}
		} else {
			// hide arrow & box
			this.windicatorArrow.visible = false;
			this.windicatorZone.style.width = '0px';
		}
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
		zone.leftPx = MomMath.mapAngleToScreenDist(
			zone.leftAngle,
			this.hFov,
			this.screenX,
			this.scale,
			this.projection
		);
		zone.rightPx = MomMath.mapAngleToScreenDist(
			zone.rightAngle,
			this.hFov,
			this.screenX,
			this.scale,
			this.projection
		);

		if (wrap && splitZone) {
			// draw second part of split zone
			this.applyClass(splitZone, zoneClass);
			splitZone.leftAngle = -this.hFov;
			splitZone.rightAngle = zone.rightAngle;
			splitZone.leftPx = MomMath.mapAngleToScreenDist(
				this.accelSplitZone.leftAngle,
				this.hFov,
				this.screenX,
				this.scale,
				this.projection
			);
			splitZone.rightPx = MomMath.mapAngleToScreenDist(
				this.accelSplitZone.rightAngle,
				this.hFov,
				this.screenX,
				this.scale,
				this.projection
			);
			this.drawZone(splitZone);

			zone.rightAngle = this.hFov;
			zone.rightPx = MomMath.mapAngleToScreenDist(
				zone.rightAngle,
				this.hFov,
				this.screenX,
				this.scale,
				this.projection
			);
		}
		this.drawZone(zone);
	}

	updateSnaps(snapOffset: number, leftTarget: number, rightTarget: number) {
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

			if (this.snapHeightgainEnable && !Number.isNaN(heightFactor)) {
				zone.style.height = heightFactor * height + 'px';
				zone.style.marginBottom = height + 'px';
				zone.style.verticalAlign = 'bottom';
			} else {
				zone.style.height = height + 'px';
				zone.style.marginBottom = height + 'px';
			}

			this.updateZone(zone, left, right, 0, snapClass, this.snapSplitZone);

			if (this.snapColorMode) {
				snapColor = rgbaStringLerp(this.snapSlowColor, this.snapFastColor, alpha);
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
					if (MomMath.magnitude2D(MomentumPlayerAPI.GetVelocity()) > this.accelMinSpeed) {
						let stopPoint, direction;
						if (left - leftTarget <= 0 && right - leftTarget >= 0) {
							stopPoint = MomMath.approxEquals(zone.rightPx, zone.leftPx, 1)
								? 0
								: this.NaNCheck(
										(
											(MomMath.mapAngleToScreenDist(
												leftTarget,
												this.hFov,
												this.screenX,
												this.scale,
												this.projection
											) -
												zone.leftPx) /
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
											(zone.rightPx -
												MomMath.mapAngleToScreenDist(
													rightTarget,
													this.hFov,
													this.screenX,
													this.scale,
													this.projection
												)) /
											(zone.rightPx - zone.leftPx)
										).toFixed(3),
										0
									);
							direction = '100% 0%, 0% 0%';
							bHighlight = true;
						}
						if (bHighlight) {
							hlSnapColor = `gradient(linear, ${direction}, from(${hlSnapColor}), color-stop( ${stopPoint}, ${hlSnapColor} ), color-stop( ${stopPoint}, ${snapColor} ), to(${snapColor}))`;
						}
					}
					break;
			}

			zone.style.backgroundColor = bHighlight ? hlSnapColor : snapColor;
		}
	}

	updatePrimeSight(
		viewDir: vec2,
		viewAngle: number,
		targetAngle: number,
		boundaryAngle: number,
		velAngle: number,
		wishDir: vec2,
		wishAngle: number
	) {
		const cross = MomMath.cross2D(wishDir, viewDir);
		const inputMode =
			Math.round(MomMath.magnitude2D(wishDir)) * (1 << Math.round(2 * Math.pow(cross, 2))) +
			(Math.round(cross) > 0 ? 1 : 0);

		const angleOffset = MomMath.remapAngle(velAngle - wishAngle);
		const targetOffset = MomMath.remapAngle(velAngle - viewAngle);
		const inputAngle = MomMath.remapAngle(viewAngle - wishAngle) * MomMath.sumOfSquares2D(wishDir);
		const velocity = MomentumPlayerAPI.GetVelocity();
		const gainZonesMap = new Map();

		let speedGain = 0;
		let gainMax = -this.primeAccel;
		let fillLeftZones = false;
		let fillRightZones = false;
		let leftOffset = -Math.PI * 0.25 - viewAngle;
		let rightOffset = Math.PI * 0.25 - viewAngle;
		let leftTarget = MomMath.wrapToHalfPi(-targetAngle - velAngle);
		let rightTarget = MomMath.wrapToHalfPi(targetAngle - velAngle);

		switch (inputMode) {
			case InputMode.NONE: // Fall-through
			case InputMode.AIR_CONTROL: // Fall-through
			default:
				break;

			case InputMode.TURN_LEFT: {
				fillLeftZones = Boolean(this.primeTruenessMode & TruenessMode.CPM_TURN);
				if (fillLeftZones) leftOffset = -Math.PI * 0.5 - viewAngle;
				const velocity = MomentumPlayerAPI.GetVelocity();
				const speed = MomMath.magnitude2D(velocity);
				const mirrorTarget = this.findFastAngle(speed, MAX_GROUND_SPEED, AIR_ACCEL);
				rightTarget = MomMath.wrapToHalfPi(mirrorTarget - velAngle);
				break;
			}
			case InputMode.TURN_RIGHT: {
				fillRightZones = Boolean(this.primeTruenessMode & TruenessMode.CPM_TURN);
				if (fillRightZones) rightOffset = Math.PI * 0.5 - viewAngle;
				const velocity = MomentumPlayerAPI.GetVelocity();
				const speed = MomMath.magnitude2D(velocity);
				const mirrorTarget = this.findFastAngle(speed, MAX_GROUND_SPEED, AIR_ACCEL);
				leftTarget = MomMath.wrapToHalfPi(-mirrorTarget - velAngle);
				break;
			}
			case InputMode.STRAFE_LEFT: {
				fillLeftZones = true;
				break;
			}
			case InputMode.STRAFE_RIGHT: {
				fillRightZones = true;
				break;
			}
		}

		const leftAngles = fillLeftZones ? this.primeAngles : this.snapAngles;
		const rightAngles = fillRightZones ? this.primeAngles : this.snapAngles;

		const iLeft = this.updateFirstPrimeZone(leftTarget, leftOffset, this.primeFirstZoneLeft, leftAngles);
		const iRight = this.updateFirstPrimeZone(rightTarget, rightOffset, this.primeFirstZoneRight, rightAngles);

		if (fillLeftZones || this.primeShowInactive) {
			this.primeFirstZoneLeft.rightPx = MomMath.mapAngleToScreenDist(
				MomMath.wrapToHalfPi(leftTarget - leftOffset),
				this.hFov,
				this.screenX,
				this.scale,
				this.projection
			);
			this.primeFirstZoneLeft.style.backgroundColor = this.primeAltColor;
			this.drawZone(this.primeFirstZoneLeft);
			this.primeFirstZoneLeft.isInactive = !fillLeftZones;
		} else {
			this.clearZones([this.primeFirstZoneLeft]);
		}

		speedGain = this.findPrimeGain(
			this.primeFirstZoneLeft,
			velocity,
			MomMath.rotateVector2D(viewDir, 0.25 * Math.PI)
		);
		gainZonesMap.set(this.primeFirstZoneLeft, speedGain);
		if (speedGain > gainMax) gainMax = speedGain;

		if (fillRightZones || this.primeShowInactive) {
			this.primeFirstZoneRight.leftPx = MomMath.mapAngleToScreenDist(
				MomMath.wrapToHalfPi(rightTarget - rightOffset),
				this.hFov,
				this.screenX,
				this.scale,
				this.projection
			);
			this.primeFirstZoneRight.style.backgroundColor = this.primeAltColor;
			this.drawZone(this.primeFirstZoneRight);
			this.primeFirstZoneRight.isInactive = !fillRightZones;
		} else {
			this.clearZones([this.primeFirstZoneRight]);
		}

		speedGain = this.findPrimeGain(
			this.primeFirstZoneRight,
			velocity,
			MomMath.rotateVector2D(viewDir, -0.25 * Math.PI)
		);
		gainZonesMap.set(this.primeFirstZoneRight, speedGain);
		if (speedGain > gainMax) gainMax = speedGain;

		if (fillLeftZones) {
			const leftBoundary = MomMath.wrapToHalfPi(-boundaryAngle - velAngle);
			const jLeft = this.findArrayInfimum(this.primeAngles, leftBoundary);
			const zoneRange = {
				start: iLeft,
				end: jLeft,
				direction: -1
			};
			this.fillActivePrimeZones(zoneRange, leftOffset, leftAngles, gainZonesMap, gainMax, velocity, wishDir);
		}

		if (fillRightZones) {
			const rightBoundary = MomMath.wrapToHalfPi(boundaryAngle - velAngle);
			const jRight = this.findArrayInfimum(this.primeAngles, rightBoundary);
			const zoneRange = {
				start: iRight,
				end: jRight,
				direction: 1
			};
			this.fillActivePrimeZones(zoneRange, rightOffset, rightAngles, gainZonesMap, gainMax, velocity, wishDir);
		}

		const scale = 1 / (gainMax > 0 ? gainMax : this.primeAccel);
		for (const [zone, gain] of gainZonesMap.entries()) {
			const gainFactor = Math.min(Math.abs(gain * scale), 1);
			const secondLine = gain < 0 && !this.primeLockOneLine;
			const height = this.NaNCheck(this.primeHeight * (this.primeHeightgainEnable ? gainFactor : 1), 0);
			const margin = secondLine ? this.primeHeight : this.primeHeight - height;
			zone.style.height = Number(height).toFixed(0) + 'px';
			zone.style.marginTop = Number(margin).toFixed(0) + 'px';
			zone.style.marginBottom =
				Number(secondLine ? this.primeHeight - height : this.primeHeight).toFixed(0) + 'px';

			if (zone.isInactive) {
				if (inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT)
					zone.style.height = this.NaNCheck(this.primeHeight.toFixed(), 0) + 'px';
				continue;
			}

			if (gain < 0) {
				zone.color = this.primeLossColor;
			} else if (this.primeColorgainEnable) {
				zone.color = rgbaStringLerp(this.primeAltColor, this.primeGainColor, gainFactor);
			} else {
				zone.color = this.primeGainColor;
			}

			if (this.primeHlEnable && this.shouldHighlight(zone)) {
				this.zoneCopy(this.primeHighlightZone, zone);
				this.drawZone(this.primeHighlightZone);
				this.primeHighlightZone.style.marginTop = (gain < 0 ? this.primeHeight : 0) + 'px';
				zone.color = enhanceAlpha(zone.color);
			}

			zone.style.backgroundColor = zone.color;
		}
	}

	/** Updates zones that overlap cgaz zones. Returns the max potential gain from updated zones. */
	fillActivePrimeZones(
		zoneRange: { direction: number; start: number; end: number },
		offset: number,
		angles: number[],
		gainZonesMap: Map<unknown, number>,
		gainMax: number,
		velocity: vec3,
		wishDir: vec2
	) {
		const angleCount = angles.length;
		let count = (zoneRange.direction * (zoneRange.end - zoneRange.start) + angleCount) % angleCount;
		let index = zoneRange.start;
		let zone;
		while (count-- >= 0) {
			index = (index + zoneRange.direction + angleCount) % angleCount;
			zone = this.primeZones[index];

			const left = MomMath.wrapToHalfPi(angles[index] - offset);
			const right = MomMath.wrapToHalfPi(angles[(index + 1) % angleCount] - offset);
			this.updateZone(zone, left, right, 0, PRIME_SIGHT_CLASS, this.primeSplitZone);
			const speedGain = this.findPrimeGain(zone, velocity, wishDir);
			gainZonesMap.set(zone, speedGain);
			if (speedGain < 0) break;
			if (speedGain > gainMax) gainMax = speedGain;
		}
	}

	/**
	 * Get the index of the largest entry less than (or equal to) the target value - Greatest Lower Bound
	 * Array argument assumed to be sorted.
	 */
	findArrayInfimum(arr: number[], val: number): number {
		let lower = 0;
		let upper = arr.length - 1;
		if (val < arr[lower] || val > arr[upper]) return upper;

		while (lower < upper) {
			const i = Math.floor(0.5 * (lower + upper));
			if (val > arr[i]) {
				lower = i + 1;
			} else {
				upper = i;
			}
		}
		return (lower - 1 + arr.length) % arr.length;
	}

	/** Check whether center screen falls between zone left and right edge (inclusive). */
	shouldHighlight(zone: ZonePanel): boolean {
		const center = (0.5 * this.screenX) / this.scale;
		return zone.rightPx - center >= 0 && zone.leftPx - center <= 0;
	}

	findPrimeGain(zone: ZonePanel, velocity: vec2, wishDir: vec2): number {
		const avgAngle = 0.5 * (zone.leftAngle + zone.rightAngle);
		const zoneVector = MomMath.rotateVector2D(wishDir, -avgAngle);
		const snapProject = {
			x: Math.round(zoneVector.x * this.primeAccel),
			y: Math.round(zoneVector.y * this.primeAccel)
		};

		const newSpeed = MomMath.magnitude2D({
			x: Number(velocity.x) + Number(snapProject.x),
			y: Number(velocity.y) + Number(snapProject.y)
		});

		return newSpeed - MomMath.magnitude2D(velocity);
	}

	updateFirstPrimeZone(target: number, offset: number, zone: ZonePanel, angles: number[]) {
		const i = this.findArrayInfimum(angles, target);
		const left = MomMath.wrapToHalfPi(angles[i] - offset);
		const right = MomMath.wrapToHalfPi(angles[(i + 1) % angles.length] - offset);
		this.updateZone(zone, left, right, 0, PRIME_SIGHT_CLASS, this.primeSplitZone);
		return i;
	}

	drawZone(zone: ZonePanel) {
		// assign widths
		const width = zone.rightPx - zone.leftPx;
		zone.style.width = this.NaNCheck(Number(width).toFixed(0), 0) + 'px';

		// assign position via position (center screen at 0)
		zone.style.position = `${this.NaNCheck(Number(zone.leftPx).toFixed(0), 0)}px 0px 0px`;
	}

	zoneCopy(pasteZone: ZonePanel, copyZone: ZonePanel) {
		pasteZone.leftAngle = copyZone.leftAngle;
		pasteZone.rightAngle = copyZone.rightAngle;
		pasteZone.leftPx = copyZone.leftPx;
		pasteZone.rightPx = copyZone.rightPx;
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

	initZonePanel(panel: Panel) {
		return Object.assign(panel, {
			leftAngle: 0,
			rightAngle: 0,
			leftPx: 0,
			rightPx: 0,
			isInactive: false,
			color: ''
		});
	}
}
