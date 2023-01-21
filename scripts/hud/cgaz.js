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
	constructor(height, offset, align, color) {
		this.height = height;
		this.offset = offset;
		this.align = align;
		this.color = color;
	}
}

class Cgaz {
	static accelContainer = $('#AccelContainer');

	static accelZones = [
		$('#LeftTurnZone'),
		$('#LeftFastZone'),
		$('#LeftSlowZone'),
		$('#DeadZone'),
		$('#RightSlowZone'),
		$('#RightFastZone'),
		$('#RightTurnZone')
	];

	static leftTurnZone = this.accelZones[0];
	static leftFastZone = this.accelZones[1];
	static leftSlowZone = this.accelZones[2];
	static deadZone = this.accelZones[3];
	static rightSlowZone = this.accelZones[4];
	static rightFastZone = this.accelZones[5];
	static rightTurnZone = this.accelZones[6];

	static leftMirrorZone = $('#LeftMirrorZone');
	static rightMirrorZone = $('#RightMirrorZone');

	static accelSplitZone = $('#AccelSplitZone');
	static snapSplitZone = $('#SnapSplitZone');
	static mirrorSplitZone = $('#MirrorSplitZone');

	static snapContainer = $('#SnapContainer');
	static snapZones = [
		$('#SnapZone0'),
		$('#SnapZone1'),
		$('#SnapZone2'),
		$('#SnapZone3'),
		$('#SnapZone4'),
		$('#SnapZone5'),
		$('#SnapZone6'),
		$('#SnapZone7'),
		$('#SnapZone8'),
		$('#SnapZone9'),
		$('#SnapZone10'),
		$('#SnapZone11')
	];

	static compassArrow = $('#CompassArrow');
	static compassArrowIcon = $('#CompassArrowIcon');
	static tickContainer = $('#CompassTicks');
	static compassTickFull = $('#FullTick');
	static compassTickHalf = $('#HalfTick');
	static pitchLine = $('#PitchLine');
	static pitchStat = $('#PitchStat');
	static yawStat = $('#YawStat');

	static windicatorArrow = $('#WindicatorArrow');
	static windicatorArrowIcon = $('#WindicatorArrowIcon');
	static windicatorZone = $('#WindicatorZone');

	static screenY = $.GetContextPanel().actuallayoutheight;
	static screenX = $.GetContextPanel().actuallayoutwidth;
	static scale = $.GetContextPanel().actualuiscale_y;
	static fov4_3 = GameInterfaceAPI.GetSettingFloat('fov_desired'); //source uses 4:3 for fov setting
	static vFov_tangent = 0.75 * Math.tan((0.5 * this.fov4_3 * Math.PI) / 180);
	static vFov = Math.atan(this.vFov_tangent);
	static hFov = Math.atan((this.vFov_tangent * this.screenX) / this.screenY);
	static theta = Math.PI * 0.5 - 2 * Math.atan(Math.sqrt(2 + Math.sqrt(3)));
	static halfPi = 0.5 * Math.PI;
	static snapGainRange = []; // stored as [min, max]
	static snapAccel = 0;
	static bShouldUpdateStyles = false;

	static onLoad() {
		if (GameModeAPI.GetCurrentGameMode() !== GameMode.DEFRAG) return;

		this.onAccelConfigChange();
		this.onProjectionChange();
		this.onHudFovChange();
		this.onSnapConfigChange();
		this.onWindicatorConfigChange();
		this.onCompassConfigChange();

		this.applyStyles();
	}

	static onProjectionChange() {
		this.projection = DefragAPI.GetHUDProjection();
		this.bShouldUpdateStyles = true;
	}

	static onHudFovChange() {
		this.hud_fov = DefragAPI.GetHUDFOV();
		this.bShouldUpdateStyles = true;
	}

	static onAccelConfigChange() {
		const accelConfig = DefragAPI.GetHUDAccelCFG();
		this.accel_enable = accelConfig.enable;
		this.accel_min_speed = accelConfig.minSpeed;
		this.accel_height = accelConfig.height;
		this.accel_offset = accelConfig.offset;
		this.accel_slow_color = accelConfig.slowColor;
		this.accel_fast_color = accelConfig.fastColor;
		this.accel_turn_color = accelConfig.turnColor;
		this.accel_dz_color = accelConfig.dzColor;
		this.accel_scale_enable = accelConfig.scaleEnable;
		this.accel_mirror_enable = accelConfig.mirrorEnable;

		this.bShouldUpdateStyles = true;
	}

	static onSnapConfigChange() {
		const snapConfig = DefragAPI.GetHUDSnapCFG();
		this.snap_enable = snapConfig.enable;
		this.snap_min_speed = snapConfig.minSpeed;
		this.snap_height = snapConfig.height;
		this.snap_offset = snapConfig.offset;
		this.snap_color = snapConfig.color;
		this.snap_alt_color = snapConfig.altColor;
		this.snap_fast_color = snapConfig.fastColor;
		this.snap_slow_color = snapConfig.slowColor;
		this.snap_hl_color = snapConfig.highlightColor;
		this.snap_hl_alt_color = snapConfig.altHighlightColor;
		this.snap_hl_mode = snapConfig.highlightMode;
		this.snap_color_mode = snapConfig.colorMode;
		this.snap_heightgain_enable = snapConfig.enableHeightGain;

		this.bShouldUpdateStyles = true;
	}

	static onWindicatorConfigChange() {
		const windicatorArrowConfig = DefragAPI.GetHUDWIndicatorCFG();
		this.windicator_enable = windicatorArrowConfig.enable;
		this.windicator_size = windicatorArrowConfig.size;
		this.windicator_color = windicatorArrowConfig.color;

		this.bShouldUpdateStyles = true;
	}

	static onCompassConfigChange() {
		const compassConfig = DefragAPI.GetHUDCompassCFG();
		this.compass_mode = compassConfig.compassMode;
		this.compass_size = compassConfig.compassSize;
		this.compass_pitch_enable = compassConfig.pitchEnable;
		this.compass_pitch_target = compassConfig.pitchTarget;
		this.compass_stat_mode = compassConfig.statMode;
		this.compass_color = compassConfig.color;
		this.compass_hl_color = compassConfig.highlightColor;

		this.bShouldUpdateStyles = true;
	}

	static applyStyles() {
		// accel zone classes
		let height = this.accel_height;
		let offset = 0;
		let align = 'middle';
		NEUTRAL_CLASS = new StyleObject(height, offset, align, this.accel_dz_color);
		SLOW_CLASS = new StyleObject(height, offset, align, this.accel_slow_color);
		FAST_CLASS = new StyleObject(height, offset, align, this.accel_fast_color);
		TURN_CLASS = new StyleObject(height, offset, align, this.accel_turn_color);
		MIRROR_CLASS = new StyleObject(height, offset, align, this.accel_slow_color);
		WIN_ZONE_CLASS = new StyleObject(height, offset, align, this.windicator_color);

		this.setupContainer(this.accelContainer, this.accel_offset, align);
		this.applyClass(this.leftTurnZone, TURN_CLASS);
		this.applyClass(this.leftFastZone, FAST_CLASS);
		this.applyClass(this.leftSlowZone, SLOW_CLASS);
		this.applyClass(this.deadZone, NEUTRAL_CLASS);
		this.applyClass(this.rightSlowZone, SLOW_CLASS);
		this.applyClass(this.rightFastZone, FAST_CLASS);
		this.applyClass(this.rightTurnZone, TURN_CLASS);
		this.applyClass(this.accelSplitZone, NEUTRAL_CLASS);
		this.applyClassBorder(this.leftMirrorZone, MIRROR_CLASS);
		this.applyClassBorder(this.rightMirrorZone, MIRROR_CLASS);
		this.applyClassBorder(this.mirrorSplitZone, MIRROR_CLASS);
		this.applyClassBorder(this.windicatorZone, WIN_ZONE_CLASS);

		// snap zone classes
		height = this.snap_height;
		offset = 0.5 * this.accel_height + this.accel_offset + this.snap_offset;
		align = 'middle';
		COLORED_SNAP_CLASS = new StyleObject(height, offset, align, this.snap_color);
		UNCOLORED_SNAP_CLASS = new StyleObject(height, offset, align, this.snap_alt_color);
		HIGHLIGHTED_SNAP_CLASS = new StyleObject(height, offset, align, this.snap_hl_color);
		HIGHLIGHTED_ALT_SNAP_CLASS = new StyleObject(height, offset, align, this.snap_hl_alt_color);

		this.setupContainer(this.snapContainer, offset, align);
		for (let i = 0; i < this.snapZones.length; ++i) {
			this.applyClass(this.snapZones[i], i % 2 ? UNCOLORED_SNAP_CLASS : COLORED_SNAP_CLASS);
		}

		// compass ticks
		offset = this.accel_offset - 0.5 * (this.accel_height + this.compass_size);
		align = 'middle';
		const size = Number.isNaN(this.compass_size) ? 0 : this.compass_size;
		this.setupContainer(this.tickContainer, offset, align);
		this.compassTickFull.style.height = size + 'px';
		this.compassTickHalf.style.height = size * 0.5 + 'px';

		// compass arrow classes
		let color = this.compass_color;
		let width = 2 * this.compass_size;
		height = this.accel_height + 2 * width;
		offset = this.accel_offset;
		align = 'bottom';
		this.setupArrow(this.compassArrow, this.compassArrowIcon, height, width, offset, align, color);

		// windicator arrow classes
		color = this.windicator_color;
		width = 2 * this.windicator_size;
		height = this.accel_height + 2 * width;
		offset = this.accel_offset;
		align = 'top';
		this.setupArrow(this.windicatorArrow, this.windicatorArrowIcon, height, width, offset, align, color);

		this.bShouldUpdateStyles = false;
	}

	static onUpdate() {
		if (this.bShouldUpdateStyles) this.applyStyles();

		// clear last frame's split zones
		this.clearZones([this.accelSplitZone, this.snapSplitZone, this.mirrorSplitZone]);

		this.screenY = $.GetContextPanel().actuallayoutheight;
		this.screenX = $.GetContextPanel().actuallayoutwidth;
		this.scale = $.GetContextPanel().actualuiscale_y;
		this.fov4_3 = this.hud_fov || GameInterfaceAPI.GetSettingFloat('fov_desired'); //source uses 4:3 for fov setting
		this.vFov_tangent = 0.75 * Math.tan((0.5 * this.fov4_3 * Math.PI) / 180);
		this.vFov = Math.atan(this.vFov_tangent);
		this.hFov = Math.atan((this.vFov_tangent * this.screenX) / this.screenY);

		const phyMode = DefragAPI.GetDFPhysicsMode();
		const lastMoveData = MomentumMovementAPI.GetLastMoveData();

		const tickInterval = MomentumMovementAPI.GetTickInterval();
		const maxSpeed = this.accel_scale_enable ? lastMoveData.wishspeed : lastMoveData.maxspeed;
		const accel = lastMoveData.acceleration;
		const maxAccel = accel * maxSpeed * tickInterval;

		if (lastMoveData.hasteEndTime < 0 || lastMoveData.hasteEndTime > MomentumMovementAPI.GetCurrentTime()) {
			this.snapAccel = HASTE_ACCEL;
			MAX_GROUND_SPEED = HASTE_SPEED;
		} else {
			this.snapAccel = DEFAULT_ACCEL;
			MAX_GROUND_SPEED = DEFAULT_SPEED;
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

		if (this.accel_enable) {
			// draw accel zones
			if (speed >= this.accel_min_speed) {
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
			if (speed >= this.accel_min_speed && this.accel_mirror_enable) {
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

		if (this.snap_enable && this.snapAccel) {
			// find snap zone borders
			const snapAngles = this.findSnapAngles(this.snapAccel);
			const snapGains = this.findSnapGains(snapAngles, this.snapAccel);
			const snapOffset = (bSnapShift ? 0 : Math.PI * 0.25) - viewAngle;

			const targetOffset = this.remapAngle(velAngle - viewAngle);
			const targetAngle = this.findFastAngle(dropSpeed, MAX_GROUND_SPEED, MAX_GROUND_SPEED * tickInterval);
			let leftTarget = -targetAngle - targetOffset + Math.PI * 0.25;
			let rightTarget = targetAngle - targetOffset - Math.PI * 0.25;

			if (forwardMove > 0) {
				if (rightMove < 0) {
					leftTarget = rightTarget;
				} else if (rightMove > 0) {
					rightTarget = leftTarget;
				}
			}

			// draw snap zones
			if (speed >= this.snap_min_speed) {
				this.updateSnaps(this.snapZones, snapAngles, snapGains, snapOffset, leftTarget, rightTarget);
			} else {
				this.clearZones(this.snapZones);
			}
		} else {
			this.clearZones(this.snapZones);
		}

		let velocityAngle = this.remapAngle(viewAngle - velAngle);
		// compass
		if (this.compass_mode) {
			const bShouldHighlight =
				Math.abs(this.remapAngle(8 * velAngle) * 0.125) < 0.01 && speed >= this.accel_min_speed;
			const color = bShouldHighlight ? this.compass_hl_color : this.compass_color;

			// ticks
			const fullTickLeftEdge = this.findCompassTick(viewAngle);
			const fullTickRightEdge = fullTickLeftEdge + this.halfPi;
			const halfTickLeftEdge = this.findCompassTick(viewAngle - 0.5 * this.halfPi);
			const halfTickRightEdge = halfTickLeftEdge + this.halfPi;

			this.drawZone(
				this.compassTickFull,
				this.mapToScreenWidth(fullTickLeftEdge) - 1, // -1 balances the 2px border across the compass tick
				this.mapToScreenWidth(fullTickRightEdge) + 1
			);
			this.drawZone(
				this.compassTickHalf,
				this.mapToScreenWidth(halfTickLeftEdge) - 1, // -1 balances the 2px border across the compass tick
				this.mapToScreenWidth(halfTickRightEdge) + 1
			);

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
			const leftEdge = this.mapToScreenWidth(velocityAngle) - this.compass_size;
			this.compassArrow.style.marginLeft = (Number.isNaN(leftEdge) ? 0 : leftEdge) + 'px';
			this.compassArrowIcon.style.washColor = color;
		}
		this.compassArrow.visible = this.compass_mode % 2 && speed >= this.accel_min_speed;
		this.tickContainer.visible = this.compass_mode > 1;

		// pitch line
		if (this.compass_pitch_enable) {
			const pitchDelta = this.mapToScreenHeight(
				((MomentumPlayerAPI.GetAngles().x - this.compass_pitch_target) * Math.PI) / 180
			);
			this.pitchLine.style.height = (Number.isNaN(pitchDelta) ? 0 : pitchDelta) + 'px';
			this.pitchLine.style.borderColor =
				Math.abs(MomentumPlayerAPI.GetAngles().x - this.compass_pitch_target) > 0.1
					? this.compass_color
					: this.compass_hl_color;
		}
		this.pitchLine.visible = this.compass_pitch_enable === 1;

		// compass stats
		if (this.compass_stat_mode) {
			this.yawStat.text = MomentumPlayerAPI.GetAngles().y.toFixed(0);
			this.yawStat.style.color =
				Math.abs(this.distToNearestTick(velAngle)) < 0.01 && speed >= this.accel_min_speed
					? this.compass_hl_color
					: this.compass_color;

			this.pitchStat.text = MomentumPlayerAPI.GetAngles().x.toFixed(1);
			this.pitchStat.style.color =
				Math.abs(MomentumPlayerAPI.GetAngles().x - this.compass_pitch_target) > 0.1
					? this.compass_color
					: this.compass_hl_color;
		}
		this.pitchStat.visible = this.compass_stat_mode % 2;
		this.yawStat.visible = this.compass_stat_mode > 1;

		const wTurnAngle = velocityAngle > 0 ? velocityAngle + this.theta : velocityAngle - this.theta;
		// draw w-turn indicator
		if (this.windicator_enable && Math.abs(wTurnAngle) < this.hFov && speed >= this.accel_min_speed) {
			this.windicatorArrow.visible = true;
			const leftEdge = this.mapToScreenWidth(wTurnAngle) - this.windicator_size;
			this.windicatorArrow.style.marginLeft = (Number.isNaN(leftEdge) ? 0 : leftEdge) + 'px';

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

		const snapAngles = breakPoints;
		const points = breakPoints.length;

		// mirror angles to fill [-Pi/2, Pi/2]
		for (let i = 0; i < points; ++i)
			snapAngles.push(
				-breakPoints[i],
				this.remapAngle(Math.PI * 0.5 - breakPoints[i]),
				this.remapAngle(breakPoints[i] - Math.PI * 0.5)
			);

		return snapAngles.sort((a, b) => a - b);
	}

	static findBreakPoints(accel, value, breakPoints) {
		// get each rounding break point from the max single-axis value
		if (value > 0) {
			breakPoints.push(Math.acos((value - 0.5) / accel));
			breakPoints = this.findBreakPoints(accel, value - 1, breakPoints);
		}

		return breakPoints;
	}

	static findSnapGains(snapAngles, snapAccel) {
		const snapGains = [];
		this.snapGainRange = [0, 0];
		for (let i = 0; i < 0.5 * snapAngles.length; ++i) {
			const left = snapAngles[i];
			const right = snapAngles[i + 1];
			const angle = 0.5 * (left + right);

			const xGain = (snapAccel * Math.cos(angle)).toFixed(0);
			const yGain = (snapAccel * Math.sin(angle)).toFixed(0);
			const gainDiff = Math.sqrt(xGain * xGain + yGain * yGain) - snapAccel;
			snapGains.push(gainDiff);

			this.snapGainRange[0] = Math.min(gainDiff, this.snapGainRange[0]);
			this.snapGainRange[1] = Math.max(gainDiff, this.snapGainRange[1]);
		}
		return snapGains;
	}

	static updateZone(zone, left, right, offset, zoneClass, splitZone) {
		let wrap = right > left;

		left = this.remapAngle(left - offset);
		right = this.remapAngle(right - offset);

		wrap = right > left ? !wrap : wrap;

		// map angles to screen
		left = this.mapToScreenWidth(left);
		right = this.mapToScreenWidth(right);

		if (wrap) {
			this.drawZone(zone, this.mapToScreenWidth(-this.hFov), right);

			// draw second part of split zone
			this.applyClass(splitZone, zoneClass);
			this.drawZone(splitZone, left, this.mapToScreenWidth(this.hFov));
		} else {
			this.drawZone(zone, left, right);
		}
	}

	static updateSnaps(zones, snapAngles, snapGains, snapOffset, leftTarget, rightTarget) {
		for (let i = 0; i < zones.length; ++i) {
			// wrap the angles to only [-pi/2, pi/2]
			const left = this.wrapToHalfPi(snapAngles[i] - snapOffset);
			const right = this.wrapToHalfPi(snapAngles[(i + 1) % zones.length] - snapOffset);
			const bUseUncolored = !this.snap_heightgain_enable && !this.snap_color_mode && i % 2;

			let bHighlight = false;
			switch (this.snap_hl_mode) {
				case 0:
					bHighlight = false;
					break;
				case 1:
					bHighlight = left < 0 && right > 0;
					break;
				case 2:
					// "target" zones only highlight when moving
					if (this.getSize(MomentumPlayerAPI.GetVelocity()) > this.accel_min_speed) {
						if (left - leftTarget < 0 && right - leftTarget > 0) {
							bHighlight = true;
						} else if (left - rightTarget < 0 && right - rightTarget > 0) {
							bHighlight = true;
						}
					}
					break;
			}

			let snapColor = bUseUncolored ? this.snap_alt_color : this.snap_color;
			const hlSnapColor = bUseUncolored ? this.snap_hl_alt_color : this.snap_hl_color;
			const snapClass = bUseUncolored ? UNCOLORED_SNAP_CLASS : COLORED_SNAP_CLASS;

			const minGain = this.snapGainRange[0];
			const maxGain = this.snapGainRange[1];
			const diffGain = snapGains[i % snapGains.length];
			const alpha = (diffGain - minGain) / (maxGain - minGain);
			const heightFactor = 0.8 * alpha + 0.2;
			const height = Number.isNaN(this.snap_height) ? 0 : this.snap_height;

			if (this.snap_color_mode) {
				const A = this.splitColorString(this.snap_slow_color);
				const B = this.splitColorString(this.snap_fast_color);
				snapColor = this.getColorStringFromArray(this.colorLerp(A, B, alpha));
			}
			zones[i].style.backgroundColor = bHighlight ? hlSnapColor : snapColor;

			if (this.snap_heightgain_enable) {
				zones[i].style.height = heightFactor * height + 'px';
				zones[i].style.marginBottom = height + 'px';
				zones[i].style.verticalAlign = 'bottom';
			} else {
				zones[i].style.height = height + 'px';
				zones[i].style.marginBottom = height + 'px';
			}

			this.updateZone(zones[i], left, right, 0, snapClass, this.snapSplitZone);
		}
	}

	static drawZone(zone, left, right) {
		// assign widths
		const width = right - left;
		zone.style.width = (Number.isNaN(width) ? 0 : Number(width).toFixed(0)) + 'px';

		// assign position via margin (center screen at 0)
		zone.style.marginLeft = (Number.isNaN(left) ? 0 : Number(left).toFixed(0)) + 'px';
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

	static setupContainer(container, offset, align) {
		container.style.verticalAlign = align;
		container.style.transform = `translatey( ${Number.isNaN(offset) ? 0 : -offset}px )`;
		container.style.overflow = 'noclip noclip';
	}

	static applyClass(zone, zoneClass) {
		zone.style.height = Number.isNaN(zoneClass.height) ? 0 : zoneClass.height + 'px';
		zone.style.verticalAlign = zoneClass.align;
		zone.style.backgroundColor = zoneClass.color;
		zone.style.overflow = 'noclip noclip';
	}

	static applyClassBorder(zone, zoneClass) {
		zone.style.height = Number.isNaN(zoneClass.height) ? 0 : zoneClass.height + 'px';
		zone.style.border = `2px solid ${zoneClass.color}`;
		zone.style.padding = '-2px';
		zone.style.verticalAlign = zoneClass.align;
		zone.style.overflow = 'noclip noclip';
	}

	static setupArrow(arrow, arrowIcon, height, width, offset, align, color) {
		arrow.style.height = Number.isNaN(height) ? 0 : height + 'px';
		arrow.style.width = Number.isNaN(width) ? 0 : width + 'px';
		arrow.style.verticalAlign = 'middle';
		arrow.style.transform = `translatey( ${Number.isNaN(offset) ? 0 : -offset}px )`;
		arrow.style.overflow = 'noclip noclip';

		arrowIcon.style.height = Number.isNaN(width) ? 0 : width + 'px';
		arrowIcon.style.width = Number.isNaN(width) ? 0 : width + 'px';
		arrowIcon.style.washColor = color;
		arrowIcon.style.overflow = 'noclip noclip';
		arrowIcon.style.verticalAlign = align;
	}

	static clearZones(zones) {
		zones.map((zone) => (zone.style.width = '0px'));
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
