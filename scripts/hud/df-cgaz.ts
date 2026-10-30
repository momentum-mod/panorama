import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import {
	AIR_ACCEL,
	DFHudComponent,
	InputColors,
	InputSide,
	SingleKeyMode,
	StyleObject,
	ZonePanel
} from 'common/df-hud';

let NEUTRAL_CLASS: StyleObject;
let SLOW_CLASS: StyleObject;
let FAST_CLASS: StyleObject;
let TURN_CLASS: StyleObject;
let MIRROR_CLASS: StyleObject;

/** The mirrored zone color mode that uses the slow zone color, next to the shared input color modes */
const SLOW_COLOR_MODE = 'slow';

/** A mirrored zone and the panel for its part past the screen edge, for one side of an input */
interface MirrorBand {
	zone: ZonePanel;
	split: ZonePanel;
}

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
		'CgazSplitZone'
	].map((id) => this.initZonePanel($('#' + id)));

	leftTurnZone = this.cgazZones[0];
	leftFastZone = this.cgazZones[1];
	leftSlowZone = this.cgazZones[2];
	deadZone = this.cgazZones[3];
	rightSlowZone = this.cgazZones[4];
	rightFastZone = this.cgazZones[5];
	rightTurnZone = this.cgazZones[6];
	cgazSplitZone = this.cgazZones[7];
	accelZones = [
		this.leftTurnZone,
		this.leftFastZone,
		this.leftSlowZone,
		this.rightSlowZone,
		this.rightFastZone,
		this.rightTurnZone
	];

	mirrorBands: MirrorBand[] = [];

	cgazMinSpeed: number;
	cgazHeight: number;
	cgazSlowColor: rgbaColor;
	cgazFastColor: rgbaColor;
	cgazTurnColor: rgbaColor;
	cgazDzColor: rgbaColor;
	cgazScaleEnable: boolean;
	cgazMirrorEnable: boolean;
	cgazMirrorBorder: number;
	cgazSingleKeyMode: SingleKeyMode;
	/** VQ3 mirrored zones show for inputs up to this far from the velocity, in radians */
	cgazMirrorRange: number;
	/** Mirrored zone colors by input */
	cgazMirrorColors = new InputColors('Cgaz');
	/** Which side of the velocity the held VQ3 input is on, kept while its wish is on the velocity line */
	cgazActiveLeft = true;

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
						children: [
							{ styleID: 'mirrorSingleKey', showWhen: true },
							{ styleID: 'mirrorRange', showWhen: true },
							{ styleID: 'mirrorBorder', showWhen: true },
							{ styleID: 'mirrorColor', showWhen: true }
						]
					}
				),
				mirrorSingleKey: this.singleKeyStyle((value) => (this.cgazSingleKeyMode = value)),
				mirrorRange: this.inputRangeStyle((value) => (this.cgazMirrorRange = value)),
				mirrorBorder: this.numberStyle(
					'#Customizer_BorderWidth',
					1,
					10,
					(value) => (this.cgazMirrorBorder = value)
				),
				...this.inputColorStyles(
					'mirror',
					this.cgazMirrorColors,
					'#Customizer_Df_Cgaz_MirrorColorMode',
					'#Customizer_Df_Cgaz_MirrorColorMode_Tooltip',
					[{ label: '#Customizer_Df_Cgaz_SlowColor', value: SLOW_COLOR_MODE }]
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
		MIRROR_CLASS = new StyleObject(this.cgazHeight, 'rgba(0, 0, 0, 0)');
		this.cgazMirrorColors.update();

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
		for (const { zone, split } of this.mirrorBands) {
			this.applyClass(zone, MIRROR_CLASS);
			this.applyClass(split, MIRROR_CLASS);
			// restyled with the new border on their next draw
			zone.color = split.color = '' as rgbaColor;
		}
	}

	onUpdate() {
		const state = this.getFrameState();
		if (!state.valid) return;

		// clear last frame's special zones
		this.clearZones([this.cgazSplitZone]);
		for (const { zone, split } of this.mirrorBands) this.clearZones([zone, split]);

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
		const { angle: wishAngle, offset: wishOffset } = this.findKeyWish(state);
		// With no keys held nothing accelerates, and the wish angle is the engine's zero (world yaw 0), which would
		// leave the accel zones pinned to a world direction
		const bKeysHeld = state.forwardMove !== 0 || state.rightMove !== 0;
		const viewAngle = MomMath.deg2rad(state.viewYaw);

		const bIsFalling = state.falling;

		// find cgaz angles
		const angleOffset = MomMath.remapAngle(velAngle - wishAngle);
		const slowCgazAngle = this.findSlowAngle(dropSpeed, dropSpeedSquared, speedSquared, maxSpeed);
		const fastCgazAngle = this.findFastAngle(dropSpeed, maxSpeed, maxAccel);
		const turnCgazAngle = this.findTurnAngle(speed, dropSpeed, maxAccel, fastCgazAngle);
		const stopCgazAngle = this.findStopAngle(maxAccel, speedSquared, dropSpeed, dropSpeedSquared, turnCgazAngle);

		if (bKeysHeld && speed >= this.cgazMinSpeed) {
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

			const velFromView = MomMath.remapAngle(velAngle - viewAngle);
			const sides =
				state.physicsMode === DefragAPI.DefragPhysics.VQ3
					? this.findVQ3MirrorSides(velFromView, bKeysHeld ? wishOffset : null)
					: this.findStrafeMirrorSides(velFromView, wishOffset, state);

			const drawn: MirrorBand[] = [];
			for (const [slot, { offset, bLeft }] of sides.entries()) {
				while (this.mirrorBands.length <= slot) this.mirrorBands.push(this.initMirrorBand(slot));
				const band = this.mirrorBands[slot];

				this.updateZone(
					band.zone,
					bLeft ? -maxMirrorAngle : minMirrorAngle,
					bLeft ? -minMirrorAngle : maxMirrorAngle,
					MomMath.remapAngle(velFromView - offset),
					MIRROR_CLASS,
					band.split
				);
				const color = this.cgazMirrorColors.colorAt(offset) ?? this.cgazSlowColor;
				this.styleMirrorZone(band.zone, color);
				this.styleMirrorZone(band.split, color);
				drawn.push(band);
			}

			if (state.physicsMode === DefragAPI.DefragPhysics.VQ3 && this.cgazSingleKeyMode === SingleKeyMode.CLEAR) {
				this.clearSingleKeyOverlaps(sides, drawn, bKeysHeld && this.isTwoKey(state));
			}
		}
	}

	/**
	 * Mirrored zones when only the diagonals strafe (CPM, VTG). A held diagonal mirrors across whichever of its keys is
	 * nearer the velocity (W+A gives W+D moving forwards, S+A moving left), on the other side of the velocity. Otherwise
	 * the two diagonals around the key nearest the velocity show, one on each side: W+A/W+D moving forwards, S+A/S+D
	 * backwards, W+A/S+A to the left and W+D/S+D to the right.
	 */
	findStrafeMirrorSides(velFromView: number, wishOffset: number, state: DefragAPI.HUDFrameState): InputSide[] {
		if (this.isTwoKey(state)) {
			const offset = this.findCPMMirrorOffset(wishOffset, velFromView);
			return [{ offset, bLeft: MomMath.remapAngle(offset - velFromView) > 0, bTwoKey: true }];
		}

		const nearestKeyOffset = Math.round(velFromView / (Math.PI * 0.5)) * Math.PI * 0.5;
		return [
			{ offset: MomMath.remapAngle(nearestKeyOffset + Math.PI * 0.25), bLeft: true, bTwoKey: true },
			{ offset: MomMath.remapAngle(nearestKeyOffset - Math.PI * 0.25), bLeft: false, bTwoKey: true }
		];
	}

	/**
	 * Mirrored zones in VQ3, where every input accelerates the same way: each input within the Input Range of the
	 * velocity, single keys with Single-Key Zones on. The held input's zones are already drawn on both sides.
	 */
	findVQ3MirrorSides(velFromView: number, heldOffset: number | null): InputSide[] {
		if (heldOffset !== null) {
			const wishFromVel = MomMath.remapAngle(heldOffset - velFromView);
			if (Math.abs(wishFromVel) > 0.01 && Math.abs(wishFromVel) < Math.PI - 0.01) {
				this.cgazActiveLeft = wishFromVel > 0;
			}
		}
		return this.findVQ3InputSides(
			velFromView,
			this.cgazMirrorRange,
			this.cgazSingleKeyMode,
			heldOffset,
			this.cgazActiveLeft,
			true
		);
	}

	/** Whether a diagonal is held */
	isTwoKey(state: DefragAPI.HUDFrameState): boolean {
		return state.forwardMove !== 0 && state.rightMove !== 0;
	}

	/**
	 * No Overlap: clears single-key mirrored zones that overlap a two-key one, mirrored or the held two-key input's
	 * acceleration zones.
	 */
	clearSingleKeyOverlaps(sides: InputSide[], drawn: MirrorBand[], bHeldTwoKey: boolean) {
		const twoKeyPanels: ZonePanel[] = bHeldTwoKey ? [...this.accelZones, this.cgazSplitZone] : [];
		for (const [i, band] of drawn.entries()) {
			if (sides[i].bTwoKey) twoKeyPanels.push(band.zone, band.split);
		}
		const isDrawn = (zone: ZonePanel) => zone.rightPx > zone.leftPx;
		const overlaps = (a: ZonePanel, b: ZonePanel) => a.leftPx < b.rightPx && b.leftPx < a.rightPx;

		for (const [i, band] of drawn.entries()) {
			if (sides[i].bTwoKey) continue;
			const parts = [band.zone, band.split].filter(isDrawn);
			if (parts.some((part) => twoKeyPanels.some((other) => isDrawn(other) && overlaps(part, other)))) {
				this.clearZones([band.zone, band.split]);
			}
		}
	}

	/** Creates the panels of a mirrored zone. */
	initMirrorBand(slot: number): MirrorBand {
		const create = (id: string) => {
			const zone = this.initZonePanel($.CreatePanel('Panel', this.cgazContainer, id));
			if (MIRROR_CLASS) this.applyClass(zone, MIRROR_CLASS);
			return zone;
		};
		return { zone: create(`MirrorZone${slot}`), split: create(`MirrorSplitZone${slot}`) };
	}

	/** Outlines a mirrored zone in its input's color. */
	styleMirrorZone(zone: ZonePanel, color: rgbaColor) {
		if (zone.color === color) return;
		zone.color = color;
		zone.style.border = `${this.cgazMirrorBorder}px solid ${color}`;
		zone.style.padding = `-${this.cgazMirrorBorder}px`;
	}
}
