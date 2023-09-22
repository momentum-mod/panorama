// TODO: remove these globals
let MAX_GROUND_SPEED = 320; // initialized to 320. Changes with haste status.
const AIR_ACCEL = 1;
const DEFAULT_ACCEL = 2.56;
const DEFAULT_SPEED = 320;
const HASTE_ACCEL = 3.328; // (max speed) * (air accel = 1) * (tick interval) * (haste factor)
const HASTE_SPEED = 416;

const TruenessMode = {
	GROUND: 1 << 0, // show ground zones
	PROJECTED: 1 << 1, // show zones scaled by +jump/+crouch
	CPM_TURN: 1 << 2 // show a/d and ground zones
};

const InputMode = {
	NONE: 0,
	AIR_CONTROL: 1,
	STRAFE_LEFT: 2,
	STRAFE_RIGHT: 3,
	TURN_LEFT: 4,
	TURN_RIGHT: 5
};

let NEUTRAL_CLASS;
let SLOW_CLASS;
let FAST_CLASS;
let TURN_CLASS;
let WIN_ZONE_CLASS;
let MIRROR_CLASS;
let COMPASS_CLASS;
let HIGHLIGHT_CLASS;

let COLORED_SNAP_CLASS;
let UNCOLORED_SNAP_CLASS;
let HIGHLIGHTED_SNAP_CLASS;
let HIGHLIGHTED_ALT_SNAP_CLASS;

let PRIME_SIGHT_CLASS;

class StyleObject {
	constructor(height, offset, color) {
		this.height = height;
		this.offset = offset;
		this.align = 'middle';
		this.color = color;
	}
}

function initZonePanel(panel) {
	return Object.assign(panel, {
		leftAngle: 0,
		rightAngle: 0,
		leftPx: 0,
		rightPx: 0
	});
}

class Cgaz {
	static accelContainer = $('#AccelContainer');
	static accelZones = [
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
	].map((id) => initZonePanel($('#' + id)));

	static leftTurnZone = this.accelZones[0];
	static leftFastZone = this.accelZones[1];
	static leftSlowZone = this.accelZones[2];
	static deadZone = this.accelZones[3];
	static rightSlowZone = this.accelZones[4];
	static rightFastZone = this.accelZones[5];
	static rightTurnZone = this.accelZones[6];
	static accelSplitZone = this.accelZones[7];

	static leftMirrorZone = this.accelZones[8];
	static rightMirrorZone = this.accelZones[9];
	static mirrorSplitZone = this.accelZones[10];

	static snapContainer = $('#SnapContainer');
	static snapZones = [];
	static snapSplitZone = initZonePanel($.CreatePanel('Panel', this.snapContainer, 'SnapSplitZone'));

	static primeContainer = $('#PrimeContainer');
	static primeZones = [];
	static primeFirstZoneLeft = initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneLeft'));
	static primeFirstZoneRight = initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneRight'));
	static primeSplitZone = initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeSplitZone'));
	static primeHighlightZone = initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeHighlightZone'));
	static primeArrow = $('#PrimeArrow');
	static primeArrowIcon = $('#PrimeArrowIcon');

	static compassArrow = $('#CompassArrow');
	static compassArrowIcon = $('#CompassArrowIcon');
	static tickContainer = $('#CompassTicks');
	static pitchLineContainer = $('#PitchLines');
	static pitchStat = $('#PitchStat');
	static yawStat = $('#YawStat');

	static windicatorArrow = $('#WindicatorArrow');
	static windicatorArrowIcon = $('#WindicatorArrowIcon');
	static windicatorZone = initZonePanel($('#WindicatorZone'));

	static screenY = $.GetContextPanel().actuallayoutheight;
	static screenX = $.GetContextPanel().actuallayoutwidth;
	static scale = $.GetContextPanel().actualuiscale_y;
	static fov4By3 = GameInterfaceAPI.GetSettingFloat('fov_desired'); //source uses 4:3 for fov setting
	static vFovTangent = 0.75 * Math.tan((0.5 * this.fov4By3 * Math.PI) / 180);
	static vFov = Math.atan(this.vFovTangent);
	static hFov = Math.atan((this.vFovTangent * this.screenX) / this.screenY);
	static theta = Math.PI * 0.5 - 2 * Math.atan(Math.sqrt(2 + Math.sqrt(3)));
	static halfPi = 0.5 * Math.PI;
	static snapGainRange = []; // stored as [min, max]
	static snapAccel = 0;
	static bShouldUpdateStyles = false;

	static onLoad() {
		if (GameModeAPI.GetCurrentGameMode() !== GameMode.DEFRAG) return;

		this.onAccelConfigChange();
		this.onSnapConfigChange();
		this.onPrimeConfigChange();
		this.onProjectionChange();
		this.onHudFovChange();
		this.onSnapConfigChange();
		this.onWindicatorConfigChange();
		this.onCompassConfigChange();
	}

	static onProjectionChange() {
		this.projection = DefragAPI.GetHUDProjection();
		this.bShouldUpdateStyles = true;
	}

	static onHudFovChange() {
		this.hudFov = DefragAPI.GetHUDFOV();
		this.bShouldUpdateStyles = true;
	}

	static onAccelConfigChange() {
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

	static onSnapConfigChange() {
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
		for (let i = 0; i < this.snapZones?.length; ++i) {
			this.applyClass(this.snapZones[i], i % 2 ? UNCOLORED_SNAP_CLASS : COLORED_SNAP_CLASS);
		}
	}

	static onPrimeConfigChange() {
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
		this.primeContainer.style.verticalAlign = 'middle';
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

	static onWindicatorConfigChange() {
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

	static onCompassConfigChange() {
		const compassConfig = DefragAPI.GetHUDCompassCFG();
		this.compassMode = compassConfig.compassMode;
		this.compassArrowSize = compassConfig.compassArrowSize;
		this.compassTickSize = compassConfig.compassTickSize;
		this.compassOffset = compassConfig.compassOffset;
		this.compassPitchEnable = compassConfig.pitchEnable;
		this.compassPitchTarget = String(compassConfig.pitchTarget).split(' ');
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

	static onUpdate() {
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
				this.snapZones.push(initZonePanel($.CreatePanel('Panel', this.snapContainer, `SnapZone${i}`)));
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
		const speed = this.getSize(velocity);
		const stopSpeed = Math.max(speed, MomentumMovementAPI.GetStopspeed());
		const dropSpeed = Math.max(speed - stopSpeed * lastMoveData.friction * tickInterval, 0);
		const speedSquared = speed * speed;
		const dropSpeedSquared = dropSpeed * dropSpeed;

		const velDir = this.getNormal(velocity, 0.001);
		const velAngle = Math.atan2(velocity.y, velocity.x);
		const wishDir = lastMoveData.wishdir;
		const wishAngle = this.getSizeSquared(wishDir) > 0.001 ? Math.atan2(wishDir.y, wishDir.x) : 0;
		const viewAngle = (MomentumPlayerAPI.GetAngles().y * Math.PI) / 180;
		const viewDir = {
			x: Math.cos(viewAngle),
			y: Math.sin(viewAngle)
		};

		const forwardMove = Math.round(this.getDot(viewDir, wishDir));
		const rightMove = Math.round(this.getCross(viewDir, wishDir));

		const bIsFalling = lastMoveData.moveStatus === 0;
		const bHasAirControl = phyMode && this.floatEquals(wishAngle, viewAngle, 0.01) && bIsFalling;
		const bSnapShift =
			!this.floatEquals(Math.abs(forwardMove), Math.abs(rightMove), 0.01) && !(phyMode && bIsFalling);

		// find cgaz angles
		const angleOffset = this.remapAngle(velAngle - wishAngle);
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

				let mirrorOffset = this.remapAngle(velAngle - viewAngle);
				const inputAngle = this.remapAngle(viewAngle - wishAngle);

				if (this.floatEquals(Math.abs(inputAngle), 0.25 * Math.PI, 0.01)) {
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
			const snapOffset = this.remapAngle(
				(bSnapShift ? 0 : Math.PI * 0.25 * (rightMove > 0 ? -1 : 1)) - viewAngle
			);

			// draw snap zones
			if (speed >= this.snapMinSpeed) {
				const targetOffset = this.remapAngle(velAngle - viewAngle);
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
			const snapOffset = this.remapAngle(
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

					this.primeAngles = this.findSnapAngles(this.primeAccel);
				}

				if (this.primeAngles.length > this.primeZones?.length) {
					const start = this.primeZones?.length;
					const end = this.primeAngles.length;
					for (let i = start; i < end; ++i) {
						const panel = initZonePanel($.CreatePanel('Panel', this.primeContainer, `PrimeZone${i}`));
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
					if (this.getSizeSquared(wishDir) > 0) {
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
							arrowAngle = this.remapAngle(arrowAngle + Math.PI);
						}
						const leftEdge = this.mapToScreenWidth(arrowAngle) - this.primeArrowSize;
						this.primeArrow.style.marginLeft = this.NaNCheck(leftEdge, 0) + 'px';
						this.primeArrow.visible = true;
					} else {
						this.primeArrow.visible = false;
					}
				}
			}
		}

		let velocityAngle = this.remapAngle(viewAngle - velAngle);
		// compass
		if (this.compassMode) {
			const ticks = this.tickContainer.Children();

			const bShouldHighlight =
				Math.abs(this.remapAngle(8 * velAngle) * 0.125) < 0.01 && speed >= this.accelMinSpeed;
			const color = bShouldHighlight ? this.compassHlColor : this.compassColor;

			// ticks
			for (const [i, tick] of ticks.entries()) {
				const tickAngle = this.NaNCheck(this.wrapToHalfPi(viewAngle + i * 0.25 * Math.PI), 0);
				const tickPx = this.NaNCheck(this.mapToScreenWidth(tickAngle), 0);
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
				velocityAngle = this.remapAngle(velocityAngle - Math.PI);
			}
			const leftEdge = this.mapToScreenWidth(velocityAngle) - this.compassArrowSize;
			this.compassArrow.style.marginLeft = this.NaNCheck(leftEdge, 0) + 'px';
			this.compassArrowIcon.style.washColor = this.getRgbFromRgba(color);
		}
		this.compassArrow.visible = this.compassMode % 2 && speed >= this.accelMinSpeed;
		this.tickContainer.visible = this.compassMode > 1;

		// pitch line
		if (this.compassPitchEnable) {
			const pitchLines = this.pitchLineContainer.Children();
			for (let i = 0; i < pitchLines?.length; ++i) {
				const viewPitch = MomentumPlayerAPI.GetAngles().x;
				const pitchDelta = this.compassPitchTarget[i] - viewPitch;
				const pitchDeltaPx = this.mapToScreenHeight((pitchDelta * Math.PI) / 180);
				pitchLines[i].style.position = `0px ${this.NaNCheck(pitchDeltaPx, 0)}px 0px`;
				pitchLines[i].style.backgroundColor =
					Math.abs(pitchDelta) > 0.15 ? this.compassColor : this.compassHlColor;
			}
		}

		// compass stats
		if (this.compassStatMode) {
			this.yawStat.text = MomentumPlayerAPI.GetAngles().y.toFixed(0);
			this.yawStat.style.color =
				Math.abs(this.remapAngle(8 * velAngle) * 0.125) < 0.01 && speed >= this.accelMinSpeed
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
		this.pitchStat.visible = this.compassStatMode % 2;
		this.yawStat.visible = this.compassStatMode > 1;

		const wTurnAngle = velocityAngle > 0 ? velocityAngle + this.theta : velocityAngle - this.theta;
		// draw w-turn indicator
		if (this.windicatorEnable && Math.abs(wTurnAngle) < this.hFov && speed >= this.accelMinSpeed) {
			this.windicatorArrow.visible = true;
			const leftEdge = this.mapToScreenWidth(wTurnAngle) - this.windicatorSize;
			this.windicatorArrow.style.marginLeft = this.NaNCheck(leftEdge, 0) + 'px';

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

	static findSlowAngle(dropSpeed, dropSpeedSquared, speedSquared, maxSpeed) {
		const threshold = Math.sqrt(Math.max(maxSpeed * maxSpeed - speedSquared + dropSpeedSquared, 0));
		return Math.acos(dropSpeed < threshold ? 1 : threshold / dropSpeed);
	}

	static findFastAngle(dropSpeed, maxSpeed, maxAccel) {
		const threshold = maxSpeed - maxAccel;
		return Math.acos(dropSpeed < threshold ? 1 : threshold / dropSpeed);
	}

	static findTurnAngle(speed, dropSpeed, maxAccel, fastCgazAngle) {
		const threshold = speed - dropSpeed;
		return Math.max(Math.acos(maxAccel < threshold ? 1 : threshold / maxAccel), fastCgazAngle);
	}

	static findStopAngle(maxAccel, speedSquared, dropSpeed, dropSpeedSquared, turnCgazAngle) {
		const top = speedSquared - dropSpeedSquared - maxAccel * maxAccel;
		const btm = 2 * maxAccel * dropSpeed;

		if (top >= btm) {
			return 0;
		} else if (-top >= btm) {
			return Math.PI;
		}

		return Math.max(Math.acos(btm < top ? 1 : top / btm), turnCgazAngle);
	}

	static findSnapAngles(snapAccel) {
		const singleAxisMax = Math.round(snapAccel);
		let breakPoints = [];
		breakPoints = this.findBreakPoints(snapAccel, singleAxisMax, breakPoints);

		const angles = breakPoints;
		const points = breakPoints.length;

		// mirror angles to fill [-Pi/2, Pi/2]
		for (let i = 0; i < points; ++i)
			angles.push(
				-breakPoints[i],
				this.remapAngle(Math.PI * 0.5 - breakPoints[i]),
				this.remapAngle(breakPoints[i] - Math.PI * 0.5)
			);

		return angles.sort((a, b) => a - b);
	}

	static findBreakPoints(accel, value, breakPoints) {
		// get each rounding break point from the max single-axis value
		if (value > 0) {
			breakPoints.push(Math.acos((value - 0.5) / accel));
			breakPoints = this.findBreakPoints(accel, value - 1, breakPoints);
		}

		return breakPoints;
	}

	static findSnapGains() {
		const snapGains = [];
		this.snapGainRange = [0, 0];
		for (let i = 0; i < 0.5 * this.snapAngles.length; ++i) {
			const left = this.snapAngles[i];
			const right = this.snapAngles[i + 1];
			const angle = 0.5 * (left + right);

			const xGain = Math.round(this.snapAccel * Math.cos(angle));
			const yGain = Math.round(this.snapAccel * Math.sin(angle));
			const gainDiff = Math.sqrt(xGain * xGain + yGain * yGain) - this.snapAccel;
			snapGains.push(gainDiff);

			this.snapGainRange[0] = Math.min(gainDiff, this.snapGainRange[0]);
			this.snapGainRange[1] = Math.max(gainDiff, this.snapGainRange[1]);
		}
		return snapGains;
	}

	static updateZone(zone, left, right, offset, zoneClass, splitZone) {
		let wrap = right > left;

		zone.leftAngle = this.remapAngle(left - offset);
		zone.rightAngle = this.remapAngle(right - offset);

		wrap = zone.rightAngle > zone.leftAngle ? !wrap : wrap;

		// map angles to screen
		zone.leftPx = this.mapToScreenWidth(zone.leftAngle);
		zone.rightPx = this.mapToScreenWidth(zone.rightAngle);

		if (wrap) {
			// draw second part of split zone
			this.applyClass(splitZone, zoneClass);
			splitZone.leftAngle = -this.hFov;
			splitZone.rightAngle = zone.rightAngle;
			splitZone.leftPx = this.mapToScreenWidth(this.accelSplitZone.leftAngle);
			splitZone.rightPx = this.mapToScreenWidth(this.accelSplitZone.rightAngle);
			//this.drawZone(splitZone, left, this.mapToScreenWidth(this.hFov));
			this.drawZone(splitZone);

			zone.rightAngle = this.hFov;
			zone.rightPx = this.mapToScreenWidth(zone.rightAngle);
		}
		this.drawZone(zone);
	}

	static updateSnaps(snapOffset, leftTarget, rightTarget) {
		const snapGains = this.findSnapGains(this.snapAngles);
		const zones = this.snapZones;

		for (let i = 0; i < zones.length; ++i) {
			// wrap the angles to only [-pi/2, pi/2]
			const left = this.wrapToHalfPi(this.snapAngles[i] - snapOffset);
			const right = this.wrapToHalfPi(this.snapAngles[(i + 1) % zones.length] - snapOffset);
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
				zones[i].style.height = heightFactor * height + 'px';
				zones[i].style.marginBottom = height + 'px';
				zones[i].style.verticalAlign = 'bottom';
			} else {
				zones[i].style.height = height + 'px';
				zones[i].style.marginBottom = height + 'px';
			}

			this.updateZone(zones[i], left, right, 0, snapClass, this.snapSplitZone);

			if (this.snapColorMode) {
				snapColor = this.colorLerp(this.snapSlowColor, this.snapFastColor, alpha);
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
					if (this.getSize(MomentumPlayerAPI.GetVelocity()) > this.accelMinSpeed) {
						let stopPoint, direction;
						if (left - leftTarget <= 0 && right - leftTarget >= 0) {
							stopPoint = this.floatEquals(zones[i].rightPx, zones[i].leftPx, 1)
								? 0
								: this.NaNCheck(
										(
											(this.mapToScreenWidth(leftTarget) - zones[i].leftPx) /
											(zones[i].rightPx - zones[i].leftPx)
										).toFixed(3),
										0
								  );
							direction = '0% 0%, 100% 0%';
							bHighlight = true;
						} else if (left - rightTarget <= 0 && right - rightTarget >= 0) {
							stopPoint = this.floatEquals(zones[i].rightPx, zones[i].leftPx, 1)
								? 0
								: this.NaNCheck(
										(
											(zones[i].rightPx - this.mapToScreenWidth(rightTarget)) /
											(zones[i].rightPx - zones[i].leftPx)
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

			zones[i].style.backgroundColor = bHighlight ? hlSnapColor : snapColor;
		}
	}

	static updatePrimeSight(viewDir, viewAngle, targetAngle, boundaryAngle, velAngle, wishDir, wishAngle) {
		const cross = this.getCross(wishDir, viewDir);
		const inputMode =
			Math.round(this.getSize(wishDir)) * (1 << Math.round(2 * Math.pow(cross, 2))) +
			(Math.round(cross) > 0 ? 1 : 0);

		const angleOffset = this.remapAngle(velAngle - wishAngle);
		const targetOffset = this.remapAngle(velAngle - viewAngle);
		const inputAngle = this.remapAngle(viewAngle - wishAngle) * this.getSizeSquared(wishDir);
		const velocity = MomentumPlayerAPI.GetVelocity();
		const gainZonesMap = new Map();

		let speedGain = 0;
		let gainMax = -this.primeAccel;
		let fillLeftZones = false;
		let fillRightZones = false;

		switch (inputMode) {
			case InputMode.NONE: // Fall-through
			default:
				break;

			case InputMode.AIR_CONTROL: // Fall-through
			case InputMode.TURN_LEFT:
			case InputMode.TURN_RIGHT: {
				targetAngle = Math.max(Math.abs(targetAngle), Math.PI * 0.25);
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

		const leftOffset = -Math.PI * 0.25 - viewAngle;
		const leftTarget = this.wrapToHalfPi(-targetAngle - velAngle);
		const leftAngles = fillLeftZones ? this.primeAngles : this.snapAngles;
		const rightOffset = Math.PI * 0.25 - viewAngle;
		const rightTarget = this.wrapToHalfPi(targetAngle - velAngle);
		const rightAngles = fillRightZones ? this.primeAngles : this.snapAngles;

		const iLeft = this.updateFirstPrimeZone(leftTarget, leftOffset, this.primeFirstZoneLeft, leftAngles);
		const iRight = this.updateFirstPrimeZone(rightTarget, rightOffset, this.primeFirstZoneRight, rightAngles);

		if (fillLeftZones || this.primeShowInactive) {
			this.primeFirstZoneLeft.rightPx = this.mapToScreenWidth(this.wrapToHalfPi(leftTarget - leftOffset));
			this.primeFirstZoneLeft.style.backgroundColor = this.primeAltColor;
			this.drawZone(this.primeFirstZoneLeft);
			this.primeFirstZoneLeft.isInactive = !fillLeftZones;
		} else {
			this.clearZones([this.primeFirstZoneLeft]);
		}

		speedGain = this.findPrimeGain(this.primeFirstZoneLeft, velocity, this.rotateVector(viewDir, 0.25 * Math.PI));
		gainZonesMap.set(this.primeFirstZoneLeft, speedGain);
		if (speedGain > gainMax) gainMax = speedGain;

		if (fillRightZones || this.primeShowInactive) {
			this.primeFirstZoneRight.leftPx = this.mapToScreenWidth(this.wrapToHalfPi(rightTarget - rightOffset));
			this.primeFirstZoneRight.style.backgroundColor = this.primeAltColor;
			this.drawZone(this.primeFirstZoneRight);
			this.primeFirstZoneRight.isInactive = !fillRightZones;
		} else {
			this.clearZones([this.primeFirstZoneRight]);
		}

		speedGain = this.findPrimeGain(this.primeFirstZoneRight, velocity, this.rotateVector(viewDir, -0.25 * Math.PI));
		gainZonesMap.set(this.primeFirstZoneRight, speedGain);
		if (speedGain > gainMax) gainMax = speedGain;

		if (fillLeftZones) {
			const leftBoundary = this.wrapToHalfPi(-boundaryAngle - velAngle);
			const jLeft = this.findArrayInfimum(this.primeAngles, leftBoundary);
			const zoneRange = {
				start: iLeft,
				end: jLeft,
				direction: -1
			};
			this.fillActivePrimeZones(zoneRange, leftOffset, gainZonesMap, gainMax, velocity, wishDir);
		}

		if (fillRightZones) {
			const rightBoundary = this.wrapToHalfPi(boundaryAngle - velAngle);
			const jRight = this.findArrayInfimum(this.primeAngles, rightBoundary);
			const zoneRange = {
				start: iRight,
				end: jRight,
				direction: 1
			};
			this.fillActivePrimeZones(zoneRange, rightOffset, gainZonesMap, gainMax, velocity, wishDir);
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

			if (zone.isInactive) continue;

			if (gain < 0) {
				zone.color = this.primeLossColor;
			} else if (this.primeColorgainEnable) {
				zone.color = this.colorLerp(this.primeAltColor, this.primeGainColor, gainFactor);
			} else {
				zone.color = this.primeGainColor;
			}

			if (this.primeHlEnable && this.shouldHighlight(zone)) {
				this.zoneCopy(this.primeHighlightZone, zone);
				this.drawZone(this.primeHighlightZone);
				this.primeHighlightZone.style.marginTop = (gain < 0 ? this.primeHeight : 0) + 'px';
				zone.color = this.enhanceAlpha(zone.color);
			}

			zone.style.backgroundColor = zone.color;
		}
	}

	/**
	 * Updates zones that overlap cgaz zones. Returns the max potential gain from updated zones.
	 * @param {Object} zoneRange
	 * @param {Number} offset
	 * @param {String} color
	 * @param {Map<Object,Number>} gainZonesMap
	 * @param {Number} gainMax
	 * @param {Object} velocity
	 * @param {Object} wishDir
	 * @returns {Number}
	 */
	static fillActivePrimeZones(zoneRange, offset, gainZonesMap, gainMax, velocity, wishDir) {
		const angleCount = this.primeAngles.length;
		let count = (zoneRange.direction * (zoneRange.end - zoneRange.start) + angleCount) % angleCount;
		let index = zoneRange.start;
		let zone;
		while (count-- >= 0) {
			index = (index + zoneRange.direction + angleCount) % angleCount;
			zone = this.primeZones[index];

			const left = this.wrapToHalfPi(this.primeAngles[index] - offset);
			const right = this.wrapToHalfPi(this.primeAngles[(index + 1) % angleCount] - offset);
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
	 * @param {Array} arr
	 * @param {Number} val
	 * @returns {Number}
	 */
	static findArrayInfimum(arr, val) {
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

	/**
	 * Check whether center screen falls between zone left and right edge (inclusive).
	 * @param {Object} zone
	 * @returns {Boolean}
	 */
	static shouldHighlight(zone) {
		const center = (0.5 * this.screenX) / this.scale;
		return zone.rightPx - center >= 0 && zone.leftPx - center <= 0;
	}

	static findPrimeGain(zone, velocity, wishDir) {
		const avgAngle = 0.5 * (zone.leftAngle + zone.rightAngle);
		const zoneVector = this.rotateVector(wishDir, -avgAngle);
		const snapProject = {
			x: Math.round(zoneVector.x * this.primeAccel),
			y: Math.round(zoneVector.y * this.primeAccel)
		};

		const newSpeed = this.getSize({
			x: Number(velocity.x) + Number(snapProject.x),
			y: Number(velocity.y) + Number(snapProject.y)
		});

		return newSpeed - this.getSize(velocity);
	}

	static updateFirstPrimeZone(target, offset, zone, angles) {
		const i = this.findArrayInfimum(angles, target);
		const left = this.wrapToHalfPi(angles[i] - offset);
		const right = this.wrapToHalfPi(angles[(i + 1) % angles.length] - offset);
		this.updateZone(zone, left, right, 0, PRIME_SIGHT_CLASS, this.primeSplitZone);
		return i;
	}

	static drawZone(zone) {
		// assign widths
		const width = zone.rightPx - zone.leftPx;
		zone.style.width = this.NaNCheck(Number(width).toFixed(0), 0) + 'px';

		// assign position via margin (center screen at 0)
		zone.style.marginLeft = this.NaNCheck(Number(zone.leftPx).toFixed(0), 0) + 'px';
	}

	static zoneCopy(pasteZone, copyZone) {
		pasteZone.leftAngle = copyZone.leftAngle;
		pasteZone.rightAngle = copyZone.rightAngle;
		pasteZone.leftPx = copyZone.leftPx;
		pasteZone.rightPx = copyZone.rightPx;
	}

	static setupContainer(container, offset) {
		container.style.verticalAlign = 'middle';
		container.style.transform = `translatey( ${this.NaNCheck(-offset, 0)}px )`;
		container.style.overflow = 'noclip noclip';
	}

	static applyClass(panel, zoneClass) {
		panel.style.height = this.NaNCheck(zoneClass.height, 0) + 'px';
		panel.style.verticalAlign = zoneClass.align;
		panel.style.backgroundColor = zoneClass.color;
		panel.style.overflow = 'noclip noclip';
	}

	static applyClassBorder(panel, thickness, zoneClass) {
		panel.style.height = this.NaNCheck(zoneClass.height, 0) + 'px';
		panel.style.border = `${thickness}px solid ${zoneClass.color}`;
		panel.style.padding = `-${thickness}px`;
		panel.style.verticalAlign = zoneClass.align;
		panel.style.overflow = 'noclip noclip';
	}

	static setupArrow(arrow, arrowIcon, height, width, offset, align, color) {
		arrow.style.height = this.NaNCheck(height, 0) + 'px';
		arrow.style.width = this.NaNCheck(width, 0) + 'px';
		arrow.style.verticalAlign = 'middle';
		arrow.style.transform = `translatey( ${this.NaNCheck(-offset, 0)}px )`;
		arrow.style.overflow = 'noclip noclip';

		arrowIcon.style.height = this.NaNCheck(width, 0) + 'px';
		arrowIcon.style.width = this.NaNCheck(width, 0) + 'px';
		arrowIcon.style.washColor = this.getRgbFromRgba(color);
		arrowIcon.style.overflow = 'noclip noclip';
		arrowIcon.style.verticalAlign = align;
	}

	static clearZones(zones) {
		for (const zone of zones) {
			zone.leftPx = 0;
			zone.rightPx = 0;
			this.drawZone(zone);
		}
	}

	static mapToScreenWidth(angle) {
		const screenWidth = this.screenX / this.scale;

		const overhang = 1.1;
		if (Math.abs(angle) >= overhang * this.hFov) {
			return (Math.sign(angle) > 0 ? overhang : 1 - overhang) * screenWidth;
		}

		switch (this.projection) {
			case 0:
				return Math.round((1 + Math.tan(angle) / Math.tan(this.hFov)) * screenWidth * 0.5);
			case 1:
				return Math.round((1 + angle / this.hFov) * screenWidth * 0.5);
			case 2:
				return Math.round((1 + Math.tan(angle * 0.5) / Math.tan(this.hFov * 0.5)) * screenWidth * 0.5);
		}
	}

	static mapToScreenHeight(angle) {
		const screenHeight = this.screenY / this.scale;

		if (Math.abs(angle) >= this.vFov) {
			return Math.sign(angle) > 0 ? screenHeight : 0;
		}

		switch (this.projection) {
			case 0:
				return Math.round((1 + Math.tan(angle) / Math.tan(this.vFov)) * screenHeight * 0.5);
			case 1:
				return Math.round((1 + angle / this.vFov) * screenHeight * 0.5);
			case 2:
				return Math.round((1 + Math.tan(angle * 0.5) / Math.tan(this.vFov * 0.5)) * screenHeight * 0.5);
		}
	}

	static wrapToHalfPi(angle) {
		return Math.abs(angle) > Math.PI * 0.5 ? this.wrapToHalfPi(angle - Math.sign(angle) * Math.PI) : angle;
	}

	static getSize(vec) {
		return Math.sqrt(this.getSizeSquared(vec));
	}

	static getSizeSquared(vec) {
		return vec.x * vec.x + vec.y * vec.y;
	}

	static getNormal(vec, threshold) {
		const mag = this.getSize(vec);
		const vecNormal = {
			x: vec.x,
			y: vec.y
		};
		if (mag < threshold * threshold) {
			vecNormal.x = 0;
			vecNormal.y = 0;
		} else {
			const inv = 1 / mag;
			vecNormal.x *= inv;
			vecNormal.y *= inv;
		}
		return vecNormal;
	}

	static getDot(vec1, vec2) {
		return vec1.x * vec2.x + vec1.y * vec2.y;
	}

	static getCross(vec1, vec2) {
		return vec1.x * vec2.y - vec1.y * vec2.x;
	}

	static floatEquals(A, B, threshold) {
		return Math.abs(A - B) < threshold;
	}

	static NaNCheck(val, def) {
		return Number.isNaN(Number(val)) ? def : val;
	}

	// Converts [0, 2Pi) to [-Pi, Pi]
	static remapAngle(angle) {
		angle += Math.PI;
		const integer = Math.trunc(angle / (2 * Math.PI));
		angle -= integer * 2 * Math.PI;
		return angle < 0 ? angle + Math.PI : angle - Math.PI;
	}

	static rotateVector(vector, angle) {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		return {
			x: vector.x * cos - vector.y * sin,
			y: vector.y * cos + vector.x * sin
		};
	}

	static getColorStringFromArray(color) {
		return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
	}

	static splitColorString(string) {
		return string
			.slice(5, -1)
			.split(',')
			.map((c, i) => (i === 3 ? Number.parseInt(c * 255) : Number.parseInt(c)));
	}

	static colorLerp(stringA, stringB, alpha) {
		const arrayA = this.splitColorString(stringA);
		const arrayB = this.splitColorString(stringB);
		if (arrayA.length === 3) arrayA.push(255);
		if (arrayB.length === 3) arrayB.push(255);
		return this.getColorStringFromArray(arrayA.map((Ai, i) => Ai + alpha * (arrayB[i] - Ai)));
	}

	static getRgbFromRgba(colorString) {
		const [r, g, b] = this.splitColorString(colorString);
		return `rgb(${r}, ${g}, ${b})`;
	}

	static enhanceAlpha(colorString) {
		const [r, g, b, a] = this.splitColorString(colorString);
		return this.getColorStringFromArray([r, g, b, 0.25 * a + 192]);
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));

		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDProjectionChange', this.onProjectionChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDFOVChange', this.onHudFovChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDAccelChange', this.onAccelConfigChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDSnapChange', this.onSnapConfigChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDPrimeChange', this.onPrimeConfigChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDWIndicatorChange', this.onWindicatorConfigChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDCompassChange', this.onCompassConfigChange.bind(this));
	}
}
