'use strict';

// TODO: remove these globals
let MAX_GROUND_SPEED = 320;
const AIR_ACCEL = 1;
const DEFAULT_ACCEL = 2.56;
const DEFAULT_SPEED = 320;
const HASTE_ACCEL = 3.328; // (max speed) * (air accel = 1) * (tick interval) * (haste factor)
const HASTE_SPEED = 416;

let NEUTRAL_CLASS;
let SLOW_CLASS;
let FAST_CLASS;
let TURN_CLASS;
let WIN_ZONE_CLASS;
let MIRROR_CLASS;
let COMPASS_CLASS;

let COLORED_SNAP_CLASS;
let UNCOLORED_SNAP_CLASS;
let HIGHLIGHTED_SNAP_CLASS;
let HIGHLIGHTED_ALT_SNAP_CLASS;

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

	static compassArrow = $('#CompassArrow');
	static compassArrowIcon = $('#CompassArrowIcon');
	static tickContainer = $('#CompassTicks');
	static compassTickFull = initZonePanel($('#FullTick'));
	static compassTickHalf = initZonePanel($('#HalfTick'));
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
		this.applyClassBorder(this.leftMirrorZone, 2, MIRROR_CLASS);
		this.applyClassBorder(this.rightMirrorZone, 2, MIRROR_CLASS);
		this.applyClassBorder(this.mirrorSplitZone, 2, MIRROR_CLASS);

		if (this.snapEnable) {
			this.onSnapConfigChange();
		}
		if (this.windicatorEnable) {
			this.onWindicatorConfigChange();
		}
		if (this.compassPitchEnable || this.compassMode) {
			this.onCompassConfigChange();
		}
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

		const accelConfig = DefragAPI.GetHUDAccelCFG(); // needed for aligning snaps to top of cgaz bar by default
		const offset = this.snapOffset + (accelConfig.enable ? 0.5 * accelConfig.height + accelConfig.offset : 0);
		COLORED_SNAP_CLASS = new StyleObject(this.snapHeight, offset, this.snapColor);
		UNCOLORED_SNAP_CLASS = new StyleObject(this.snapHeight, offset, this.snapAltColor);
		HIGHLIGHTED_SNAP_CLASS = new StyleObject(this.snapHeight, offset, this.snapHlColor);
		HIGHLIGHTED_ALT_SNAP_CLASS = new StyleObject(this.snapHeight, offset, this.snapHlAltColor);

		this.setupContainer(this.snapContainer, offset);
		for (let i = 0; i < this.snapZones?.length; ++i) {
			this.applyClass(this.snapZones[i], i % 2 ? UNCOLORED_SNAP_CLASS : COLORED_SNAP_CLASS);
		}
	}

	static onWindicatorConfigChange() {
		const windicatorArrowConfig = DefragAPI.GetHUDWIndicatorCFG();
		this.windicatorEnable = windicatorArrowConfig.enable;
		this.windicatorSize = windicatorArrowConfig.size;
		this.windicatorColor = windicatorArrowConfig.color;

		const accelConfig = DefragAPI.GetHUDAccelCFG();
		const width = 2 * this.windicatorSize;
		const height = accelConfig.height + 2 * width;
		const offset = accelConfig.enable ? accelConfig.offset : 0;
		this.setupArrow(
			this.windicatorArrow,
			this.windicatorArrowIcon,
			height,
			width,
			offset,
			'top',
			this.windicatorColor
		);

		WIN_ZONE_CLASS = new StyleObject(accelConfig.height, accelConfig.offset, this.windicatorColor);
		this.applyClassBorder(this.windicatorZone, 2, WIN_ZONE_CLASS);
	}

	static onCompassConfigChange() {
		const compassConfig = DefragAPI.GetHUDCompassCFG();
		this.compassMode = compassConfig.compassMode;
		this.compassSize = compassConfig.compassSize;
		this.compassPitchEnable = compassConfig.pitchEnable;
		this.compassPitchTarget = String(compassConfig.pitchTarget).split(' ');
		this.compassStatMode = compassConfig.statMode;
		this.compassColor = compassConfig.color;
		this.compassHlColor = compassConfig.highlightColor;

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

		const accelConfig = DefragAPI.GetHUDAccelCFG();
		const offset = accelConfig.offset - 0.5 * (accelConfig.height + this.compassSize);
		const size = this.NaNCheck(this.compassSize, 0);
		this.setupContainer(this.tickContainer, offset);
		this.compassTickFull.style.height = size + 'px';
		this.compassTickHalf.style.height = size * 0.5 + 'px';

		const width = 2 * this.compassSize;
		const height = accelConfig.height + 2 * width;
		this.setupArrow(
			this.compassArrow,
			this.compassArrowIcon,
			height,
			width,
			accelConfig.offset,
			'bottom',
			this.compassColor
		);
	}

	static onUpdate() {
		// clear last frame's split zones
		this.clearZones([this.accelSplitZone, this.snapSplitZone, this.mirrorSplitZone]);

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
				this.findSnapAngles(this.snapAccel);
			}
		} else {
			if (this.snapAccel !== DEFAULT_ACCEL) {
				this.snapAccel = DEFAULT_ACCEL;
				MAX_GROUND_SPEED = DEFAULT_SPEED;

				// find snap zone borders without haste
				this.findSnapAngles(this.snapAccel);
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

		const forwardMove = this.getDot(viewDir, wishDir).toFixed(0);
		const rightMove = this.getCross(viewDir, wishDir).toFixed(0);

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

			const targetOffset = this.remapAngle(velAngle - viewAngle);
			const targetAngle = this.findFastAngle(dropSpeed, MAX_GROUND_SPEED, MAX_GROUND_SPEED * tickInterval);
			const leftTarget = -targetAngle - targetOffset + Math.PI * 0.25;
			const rightTarget = targetAngle - targetOffset - Math.PI * 0.25;

			// draw snap zones
			if (speed >= this.snapMinSpeed) {
				this.updateSnaps(snapOffset, leftTarget, rightTarget);
			} else {
				this.clearZones(this.snapZones);
			}
		} else {
			this.clearZones(this.snapZones);
		}

		let velocityAngle = this.remapAngle(viewAngle - velAngle);
		// compass
		if (this.compassMode) {
			const bShouldHighlight =
				Math.abs(this.remapAngle(8 * velAngle) * 0.125) < 0.01 && speed >= this.accelMinSpeed;
			const color = bShouldHighlight ? this.compassHlColor : this.compassColor;

			// ticks
			this.compassTickFull.leftAngle = this.findCompassTick(viewAngle);
			this.compassTickFull.rightAngle = this.compassTickFull.leftAngle + this.halfPi;
			this.compassTickHalf.leftAngle = this.findCompassTick(viewAngle - 0.5 * this.halfPi);
			this.compassTickHalf.rightAngle = this.compassTickHalf.leftAngle + this.halfPi;

			// -1/+1 balances the 2px border across the compass tick
			this.compassTickFull.leftPx = this.mapToScreenWidth(this.compassTickFull.leftAngle) - 1;
			this.compassTickFull.rightPx = this.mapToScreenWidth(this.compassTickFull.rightAngle) + 1;
			this.compassTickHalf.leftPx = this.mapToScreenWidth(this.compassTickHalf.leftAngle) - 1;
			this.compassTickHalf.rightPx = this.mapToScreenWidth(this.compassTickHalf.rightAngle) + 1;

			this.drawZone(this.compassTickFull);
			this.drawZone(this.compassTickHalf);

			this.compassTickFull.style.borderColor = color;
			this.compassTickHalf.style.borderColor = color;

			// arrow
			if (Math.abs(velocityAngle) < this.hFov) {
				this.compassArrowIcon.RemoveClass('arrow__down');
				this.compassArrowIcon.AddClass('arrow__up');
			} else {
				this.compassArrowIcon.RemoveClass('arrow__up');
				this.compassArrowIcon.AddClass('arrow__down');
				velocityAngle = this.remapAngle(velocityAngle - Math.PI);
			}
			const leftEdge = this.mapToScreenWidth(velocityAngle) - this.compassSize;
			this.compassArrow.style.marginLeft = this.NaNCheck(leftEdge, 0) + 'px';
			this.compassArrowIcon.style.washColor = color;
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
				Math.abs(this.distToNearestTick(velAngle)) < 0.01 && speed >= this.accelMinSpeed
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
		const singleAxisMax = snapAccel.toFixed(0);
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

		this.snapAngles = angles.sort((a, b) => a - b);
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

			const xGain = (this.snapAccel * Math.cos(angle)).toFixed(0);
			const yGain = (this.snapAccel * Math.sin(angle)).toFixed(0);
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
				const A = this.splitColorString(this.snapSlowColor);
				const B = this.splitColorString(this.snapFastColor);
				snapColor = this.getColorStringFromArray(this.colorLerp(A, B, alpha));
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

	static drawZone(zone) {
		// assign widths
		const width = zone.rightPx - zone.leftPx;
		zone.style.width = this.NaNCheck(Number(width).toFixed(0), 0) + 'px';

		// assign position via margin (center screen at 0)
		zone.style.marginLeft = this.NaNCheck(Number(zone.leftPx).toFixed(0), 0) + 'px';
	}

	static findCompassTick(angle) {
		//return this.mapToScreenWidth(1 * this.remapAngle(1 * angle));
		while (angle > 0) {
			angle -= this.halfPi;
		}
		while (angle <= -this.hFov) {
			angle += this.halfPi;
		}
		return angle;
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
		arrowIcon.style.washColor = color;
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
				return ((1 + Math.tan(angle) / Math.tan(this.hFov)) * screenWidth * 0.5).toFixed(0);
			case 1:
				return ((1 + angle / this.hFov) * screenWidth * 0.5).toFixed(0);
			case 2:
				return ((1 + Math.tan(angle * 0.5) / Math.tan(this.hFov * 0.5)) * screenWidth * 0.5).toFixed(0);
		}
	}

	static mapToScreenHeight(angle) {
		const screenHeight = this.screenY / this.scale;

		if (Math.abs(angle) >= this.vFov) {
			return Math.sign(angle) > 0 ? screenHeight : 0;
		}

		switch (this.projection) {
			case 0:
				return ((1 + Math.tan(angle) / Math.tan(this.vFov)) * screenHeight * 0.5).toFixed(0);
			case 1:
				return ((1 + angle / this.vFov) * screenHeight * 0.5).toFixed(0);
			case 2:
				return ((1 + Math.tan(angle * 0.5) / Math.tan(this.vFov * 0.5)) * screenHeight * 0.5).toFixed(0);
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

	static distToNearestTick(angle) {
		angle += Math.PI * 0.125;
		const integer = Math.trunc((angle * 4) / Math.PI);
		angle -= integer * 0.25 * Math.PI;
		return angle < 0 ? angle + 0.125 * Math.PI : angle - 0.125 * Math.PI;
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

	static colorLerp(A, B, alpha) {
		return A.map((Ai, i) => Ai + alpha * (B[i] - Ai));
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));

		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDProjectionChange', this.onProjectionChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDFOVChange', this.onHudFovChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDAccelChange', this.onAccelConfigChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDSnapChange', this.onSnapConfigChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDWIndicatorChange', this.onWindicatorConfigChange.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDCompassChange', this.onCompassConfigChange.bind(this));
	}
}
