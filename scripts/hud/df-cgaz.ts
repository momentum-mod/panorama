import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import { AIR_ACCEL, DFHudComponent, StyleObject, ZonePanel } from 'common/df-hud';

let NEUTRAL_CLASS: StyleObject;
let SLOW_CLASS: StyleObject;
let FAST_CLASS: StyleObject;
let TURN_CLASS: StyleObject;
let MIRROR_CLASS: StyleObject;

@PanelHandler()
class DFCgazHandler extends DFHudComponent {
	cgazContainer = $('#CgazContainer');
	cgazZones: ZonePanel[] = [
		'LeftTurnZone',
		'LeftFastZone',
		'LeftSlowZone',
		'DeadZone',
		'RightSlowZone',
		'RightFastZone',
		'RightTurnZone',
		'CgazSplitZone',
		'LeftMirrorZone',
		'RightMirrorZone',
		'MirrorSplitZone'
	].map((id) => this.initZonePanel($('#' + id)));

	leftTurnZone = this.cgazZones[0];
	leftFastZone = this.cgazZones[1];
	leftSlowZone = this.cgazZones[2];
	deadZone = this.cgazZones[3];
	rightSlowZone = this.cgazZones[4];
	rightFastZone = this.cgazZones[5];
	rightTurnZone = this.cgazZones[6];
	cgazSplitZone = this.cgazZones[7];

	leftMirrorZone = this.cgazZones[8];
	rightMirrorZone = this.cgazZones[9];
	mirrorSplitZone = this.cgazZones[10];

	cgazMinSpeed: number;
	cgazHeight: number;
	cgazSlowColor: rgbaColor;
	cgazFastColor: rgbaColor;
	cgazTurnColor: rgbaColor;
	cgazDzColor: rgbaColor;
	cgazScaleEnable: boolean;
	cgazMirrorEnable: boolean;
	cgazMirrorBorder: number;

	constructor() {
		super();

		this.registerComponent(
			'#Customizer_Df_Cgaz_Name',
			GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			{
				minSpeed: this.numberStyle('#Customizer_Df_MinSpeed', 0, 10000, (value) => (this.cgazMinSpeed = value)),
				height: this.numberStyle('#Customizer_Height', 1, 50, (value) => (this.cgazHeight = value)),
				colors: this.groupStyle('#Customizer_Colors', ['dzColor', 'slowColor', 'fastColor', 'turnColor']),
				dzColor: this.colorStyle('#Customizer_Df_Cgaz_DeadzoneColor', (value) => (this.cgazDzColor = value), {
					tooltip: '#Customizer_Df_Cgaz_DeadzoneColor_Tooltip'
				}),
				slowColor: this.colorStyle('#Customizer_Df_Cgaz_SlowColor', (value) => (this.cgazSlowColor = value), {
					tooltip: '#Customizer_Df_Cgaz_SlowColor_Tooltip'
				}),
				fastColor: this.colorStyle('#Customizer_Df_Cgaz_FastColor', (value) => (this.cgazFastColor = value), {
					tooltip: '#Customizer_Df_Cgaz_FastColor_Tooltip'
				}),
				turnColor: this.colorStyle('#Customizer_Df_Cgaz_TurnColor', (value) => (this.cgazTurnColor = value), {
					tooltip: '#Customizer_Df_Cgaz_TurnColor_Tooltip'
				}),
				scaleEnable: this.checkboxStyle(
					'#Customizer_Df_Cgaz_Scale',
					(value) => (this.cgazScaleEnable = value),
					{ tooltip: '#Customizer_Df_Cgaz_Scale_Tooltip' }
				),
				mirrorEnable: this.checkboxStyle(
					'#Customizer_Df_Cgaz_Mirror',
					(value) => (this.cgazMirrorEnable = value),
					{
						tooltip: '#Customizer_Df_Cgaz_Mirror_Tooltip',
						children: [{ styleID: 'mirrorBorder', showWhen: true }]
					}
				),
				mirrorBorder: this.numberStyle(
					'#Customizer_BorderWidth',
					1,
					10,
					(value) => (this.cgazMirrorBorder = value)
				)
			},
			{ resizeY: true, heightStyle: { styleID: 'height' }, description: '#Customizer_Df_Cgaz_Name_Tooltip' }
		);
	}

	applyConfig() {
		NEUTRAL_CLASS = new StyleObject(this.cgazHeight, this.cgazDzColor);
		SLOW_CLASS = new StyleObject(this.cgazHeight, this.cgazSlowColor);
		FAST_CLASS = new StyleObject(this.cgazHeight, this.cgazFastColor);
		TURN_CLASS = new StyleObject(this.cgazHeight, this.cgazTurnColor);
		MIRROR_CLASS = new StyleObject(this.cgazHeight, this.cgazSlowColor);

		this.setStripHeight(this.cgazHeight);
		this.setupContainer(this.cgazContainer);
		this.applyClass(this.leftTurnZone, TURN_CLASS);
		this.applyClass(this.leftFastZone, FAST_CLASS);
		this.applyClass(this.leftSlowZone, SLOW_CLASS);
		this.applyClass(this.deadZone, NEUTRAL_CLASS);
		this.applyClass(this.rightSlowZone, SLOW_CLASS);
		this.applyClass(this.rightFastZone, FAST_CLASS);
		this.applyClass(this.rightTurnZone, TURN_CLASS);
		this.applyClass(this.cgazSplitZone, NEUTRAL_CLASS);
		this.applyClassBorder(this.leftMirrorZone, this.cgazMirrorBorder, MIRROR_CLASS);
		this.applyClassBorder(this.rightMirrorZone, this.cgazMirrorBorder, MIRROR_CLASS);
		this.applyClassBorder(this.mirrorSplitZone, this.cgazMirrorBorder, MIRROR_CLASS);
	}

	onUpdate() {
		const state = this.getFrameState();
		if (!state.valid) return;

		// clear last frame's special zones
		this.clearZones([this.cgazSplitZone, this.mirrorSplitZone]);

		this.updateView(state);
		this.updateSnapAccel(state.hasteTime);

		const tickInterval = state.tickInterval;
		const maxSpeed = this.cgazScaleEnable ? MomMath.magnitude(state.wishVel) : state.maxspeed;
		const accel = state.acceleration;
		const maxAccel = accel * maxSpeed * tickInterval;

		const speed = state.speed;
		const dropSpeed = state.dropSpeed;
		const speedSquared = speed * speed;
		const dropSpeedSquared = dropSpeed * dropSpeed;

		const velAngle = state.velAngle;
		const wishAngle = this.findKeyWish(state).angle;
		const viewAngle = MomMath.deg2rad(state.viewYaw);

		const bIsFalling = state.falling;

		// find cgaz angles
		const angleOffset = MomMath.remapAngle(velAngle - wishAngle);
		const slowCgazAngle = this.findSlowAngle(dropSpeed, dropSpeedSquared, speedSquared, maxSpeed);
		const fastCgazAngle = this.findFastAngle(dropSpeed, maxSpeed, maxAccel);
		const turnCgazAngle = this.findTurnAngle(speed, dropSpeed, maxAccel, fastCgazAngle);
		const stopCgazAngle = this.findStopAngle(maxAccel, speedSquared, dropSpeed, dropSpeedSquared, turnCgazAngle);

		if (speed >= this.cgazMinSpeed) {
			this.updateZone(
				this.leftTurnZone,
				-stopCgazAngle,
				-turnCgazAngle,
				angleOffset,
				TURN_CLASS,
				this.cgazSplitZone
			);
			this.updateZone(
				this.leftFastZone,
				-turnCgazAngle,
				-fastCgazAngle,
				angleOffset,
				FAST_CLASS,
				this.cgazSplitZone
			);
			this.updateZone(
				this.leftSlowZone,
				-fastCgazAngle,
				-slowCgazAngle,
				angleOffset,
				SLOW_CLASS,
				this.cgazSplitZone
			);
			this.updateZone(
				this.deadZone,
				-slowCgazAngle,
				slowCgazAngle,
				angleOffset,
				NEUTRAL_CLASS,
				this.cgazSplitZone
			);
			this.updateZone(
				this.rightSlowZone,
				slowCgazAngle,
				fastCgazAngle,
				angleOffset,
				SLOW_CLASS,
				this.cgazSplitZone
			);
			this.updateZone(
				this.rightFastZone,
				fastCgazAngle,
				turnCgazAngle,
				angleOffset,
				FAST_CLASS,
				this.cgazSplitZone
			);
			this.updateZone(
				this.rightTurnZone,
				turnCgazAngle,
				stopCgazAngle,
				angleOffset,
				TURN_CLASS,
				this.cgazSplitZone
			);
		} else {
			this.clearZones(this.cgazZones);
		}

		// draw mirrored strafe zones
		if (speed >= this.cgazMinSpeed && this.cgazMirrorEnable) {
			const mirrorAccel = (bIsFalling ? AIR_ACCEL : accel) * this.maxGroundSpeed * tickInterval;
			const minMirrorAngle = this.findSlowAngle(dropSpeed, dropSpeedSquared, speedSquared, this.maxGroundSpeed);
			const fastMirrorAngle = this.findFastAngle(dropSpeed, this.maxGroundSpeed, mirrorAccel);
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
}
