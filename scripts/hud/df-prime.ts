import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import { rgbaStringLerp, rgbaStringToTuple, tupleToRgbaString } from 'util/colors';
import { AIR_ACCEL, DFHudComponent, InputMode, StyleObject, ZonePanel } from 'common/df-hud';

enum TruenessMode {
	GROUND = 1 << 0, // show ground zones
	PROJECTED = 1 << 1, // show zones scaled by +jump/+crouch
	CPM_TURN = 1 << 2 // show a/d turn zones in the air
}

/** One side's chain of prime zones, laid out from the zone containing its target. */
interface PrimeChain {
	angles: number[];
	/** The target wrapped into the angle table's [-pi/2, pi/2] range */
	tableTarget: number;
	/** Index of the zone containing the target, from -1 to angles.length - 1 */
	first: number;
	/** The target as a view-relative angle in [-pi, pi], never wrapped to [-pi/2, pi/2] */
	target: number;
}

const INACTIVE_BORDER = 2;

enum HalfBeatMode {
	OFF = 'off',
	ON = 'on',
	/** Show the half-beat zones before their target passes the diagonal one */
	EARLY = 'early'
}

let HIGHLIGHT_CLASS: StyleObject;
let PRIME_SIGHT_CLASS: StyleObject;

@PanelHandler()
class DFPrimeHandler extends DFHudComponent {
	primeContainer = $('#PrimeContainer');
	primeZones: ZonePanel[] = [];
	primeInactiveZonesLeft: ZonePanel[] = [];
	primeInactiveZonesRight: ZonePanel[] = [];
	/** A second inactive chain: VQ3 half-beat, or the same-side diagonal in CPM a/d turns */
	primeExtraZones: ZonePanel[] = [];
	primeExtraFirstZone = this.initInactiveZone('PrimeExtraFirstZone');
	primeFirstZoneLeft = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneLeft'));
	primeFirstZoneRight = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneRight'));
	primeHighlightZone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeHighlightZone'));
	primeArrow = $('#PrimeArrow');
	primeArrowIcon = $<Image>('#PrimeArrowIcon');
	primeAccel: number;
	primeAngles: number[] = [];

	primeTruenessMode: number;
	primeShowInactive: boolean;
	primeHalfBeatMode: HalfBeatMode;
	primeShowHalfBeat: boolean;
	primeHalfBeatEarly: boolean;
	primeInactiveChain: boolean;
	primeInactiveOutline: boolean;
	primeInactiveGainColor: boolean;
	primeLockOneLine: boolean;
	primeMinSpeed: number;
	primeHeight: number;
	primeGainColor: rgbaColor;
	primeLossColor: rgbaColor;
	primeAltColor: rgbaColor;
	primeHlEnable: boolean;
	/** 0 to 1 */
	primeHlStrength: number;
	primeHlBorder: number;
	primeHlColor: rgbaColor;
	primeHeightgainEnable: boolean;
	primeColorgainEnable: boolean;
	primeArrowEnable: boolean;
	primeArrowSize: number;
	primeArrowColor: rgbaColor;
	/** Which side of the velocity the active chain is on, kept while the wish direction is on the velocity line */
	primeActiveLeft = true;

	constructor() {
		super();

		this.primeTruenessMode = 0;
		const truenessStyle = (name: string, tooltip: string, flag: TruenessMode) =>
			this.checkboxStyle(
				name,
				(value) => {
					this.primeTruenessMode = value ? this.primeTruenessMode | flag : this.primeTruenessMode & ~flag;
				},
				{ tooltip }
			);

		this.registerComponent(
			'#Customizer_Df_Prime_Name',
			GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			{
				minSpeed: this.numberStyle(
					'#Customizer_Df_MinSpeed',
					0,
					10000,
					(value) => (this.primeMinSpeed = value)
				),
				height: this.numberStyle('#Customizer_Height', 1, 50, (value) => (this.primeHeight = value)),
				heightGain: this.checkboxStyle(
					'#Customizer_Df_HeightGain',
					(value) => (this.primeHeightgainEnable = value),
					{ tooltip: '#Customizer_Df_HeightGain_Tooltip' }
				),
				colorGain: this.checkboxStyle(
					'#Customizer_Df_ColorByGain',
					(value) => (this.primeColorgainEnable = value),
					{ tooltip: '#Customizer_Df_ColorByGain_Tooltip' }
				),
				oneLine: this.checkboxStyle(
					'#Customizer_Df_Prime_OneLine',
					(value) => (this.primeLockOneLine = value),
					{ tooltip: '#Customizer_Df_Prime_OneLine_Tooltip' }
				),
				trueness: this.groupStyle(
					'#Customizer_Df_Prime_Trueness',
					['truenessGround', 'truenessProjected', 'truenessCpmTurn'],
					{ tooltip: '#Customizer_Df_Prime_Trueness_Tooltip' }
				),
				truenessGround: truenessStyle(
					'#Customizer_Df_Prime_TruenessGround',
					'#Customizer_Df_Prime_TruenessGround_Tooltip',
					TruenessMode.GROUND
				),
				truenessProjected: truenessStyle(
					'#Customizer_Df_Prime_TruenessProjected',
					'#Customizer_Df_Prime_TruenessProjected_Tooltip',
					TruenessMode.PROJECTED
				),
				truenessCpmTurn: truenessStyle(
					'#Customizer_Df_Prime_TruenessCpmTurn',
					'#Customizer_Df_Prime_TruenessCpmTurn_Tooltip',
					TruenessMode.CPM_TURN
				),
				inactiveEnable: this.checkboxStyle(
					'#Customizer_Df_Prime_Inactive',
					(value) => (this.primeShowInactive = value),
					{
						tooltip: '#Customizer_Df_Prime_Inactive_Tooltip',
						children: [
							{ styleID: 'inactiveHalfBeat', showWhen: true },
							{ styleID: 'inactiveChain', showWhen: true },
							{ styleID: 'inactiveOutline', showWhen: true },
							{ styleID: 'inactiveGainColor', showWhen: true }
						]
					}
				),
				inactiveHalfBeat: this.dropdownStyle(
					'#Customizer_Df_Prime_InactiveHalfBeat',
					[
						{ label: '#Common_Off', value: HalfBeatMode.OFF },
						{ label: '#Common_On', value: HalfBeatMode.ON },
						{ label: '#Customizer_Df_Prime_InactiveHalfBeat_Early', value: HalfBeatMode.EARLY }
					],
					(value) => (this.primeHalfBeatMode = value as HalfBeatMode),
					{ tooltip: '#Customizer_Df_Prime_InactiveHalfBeat_Tooltip' }
				),
				inactiveChain: this.checkboxStyle(
					'#Customizer_Df_Prime_InactiveChain',
					(value) => (this.primeInactiveChain = value),
					{ tooltip: '#Customizer_Df_Prime_InactiveChain_Tooltip' }
				),
				inactiveOutline: this.checkboxStyle(
					'#Customizer_Df_Prime_InactiveOutline',
					(value) => (this.primeInactiveOutline = value)
				),
				inactiveGainColor: this.checkboxStyle(
					'#Customizer_Df_Prime_InactiveGainColor',
					(value) => (this.primeInactiveGainColor = value)
				),
				highlightEnable: this.checkboxStyle(
					'#Customizer_Df_Prime_Highlight',
					(value) => (this.primeHlEnable = value),
					{
						tooltip: '#Customizer_Df_Prime_Highlight_Tooltip',
						children: [
							{ styleID: 'highlightStrength', showWhen: true },
							{ styleID: 'highlightBorder', showWhen: true },
							{ styleID: 'highlightColor', showWhen: true }
						]
					}
				),
				highlightStrength: this.numberStyle(
					'#Customizer_Df_Prime_HighlightStrength',
					0,
					100,
					(value) => (this.primeHlStrength = value / 100)
				),
				highlightBorder: this.numberStyle(
					'#Customizer_Df_Prime_HighlightBorder',
					0,
					10,
					(value) => (this.primeHlBorder = value)
				),
				highlightColor: this.colorStyle(
					'#Customizer_Df_HighlightColor',
					(value) => (this.primeHlColor = value)
				),
				arrowEnable: this.checkboxStyle('#Customizer_Df_Arrow', (value) => (this.primeArrowEnable = value), {
					children: [
						{ styleID: 'arrowSize', showWhen: true },
						{ styleID: 'arrowColor', showWhen: true }
					]
				}),
				arrowSize: this.numberStyle(
					'#Customizer_Df_ArrowSize',
					1,
					25,
					(value) => (this.primeArrowSize = value)
				),
				arrowColor: this.colorStyle('#Customizer_Df_ArrowColor', (value) => (this.primeArrowColor = value)),
				colors: this.groupStyle('#Customizer_Colors', ['gainColor', 'lossColor', 'altColor']),
				gainColor: this.colorStyle('#Customizer_Gain', (value) => (this.primeGainColor = value)),
				lossColor: this.colorStyle('#Customizer_Loss', (value) => (this.primeLossColor = value)),
				altColor: this.colorStyle('#Customizer_Df_Prime_InactiveColor', (value) => (this.primeAltColor = value))
			},
			{
				resizeY: true,
				heightStyle: { styleID: 'height', scale: () => this.lineCount() },
				description: '#Customizer_Df_Prime_Name_Tooltip'
			}
		);
	}

	/** Lines the strip holds: gains and losses each get one, or share one in one-line mode */
	lineCount(): number {
		return this.primeLockOneLine ? 1 : 2;
	}

	applyConfig() {
		this.primeShowHalfBeat = this.primeShowInactive && this.primeHalfBeatMode !== HalfBeatMode.OFF;
		this.primeHalfBeatEarly = this.primeHalfBeatMode === HalfBeatMode.EARLY;

		PRIME_SIGHT_CLASS = new StyleObject(this.primeHeight, this.primeAltColor);
		HIGHLIGHT_CLASS = new StyleObject(this.primeHeight, this.primeHlColor);

		// gains draw on the top line and losses on the bottom one, unless they share one
		const containerHeight = this.lineCount() * this.primeHeight;
		this.setStripHeight(containerHeight);
		this.setupContainer(this.primeContainer);
		for (const zone of [
			...this.primeZones,
			...this.primeInactiveZonesLeft,
			...this.primeInactiveZonesRight,
			...this.primeExtraZones,
			this.primeExtraFirstZone
		]) {
			this.applyClass(zone, PRIME_SIGHT_CLASS);
			zone.style.verticalAlign = 'top';
		}
		this.applyClass(this.primeFirstZoneLeft, PRIME_SIGHT_CLASS);
		this.primeFirstZoneLeft.style.verticalAlign = 'top';
		this.applyClass(this.primeFirstZoneRight, PRIME_SIGHT_CLASS);
		this.primeFirstZoneRight.style.verticalAlign = 'top';

		this.applyClassBorder(this.primeHighlightZone, this.primeHlBorder, HIGHLIGHT_CLASS);
		this.primeHighlightZone.style.verticalAlign = 'top';
		this.primeHighlightZone.style.zIndex = 1;

		const width = 2 * this.primeArrowSize;
		const height = containerHeight + 2 * width;
		this.setupArrow(this.primeArrow, this.primeArrowIcon, height, width, 'top', this.primeArrowColor);
		if (!this.primeArrowEnable) this.primeArrow.visible = false;
	}

	onUpdate() {
		const state = this.getFrameState();
		if (!state.valid) return;

		// clear last frame's special zones
		this.clearZones([
			this.primeFirstZoneLeft,
			this.primeFirstZoneRight,
			this.primeHighlightZone,
			this.primeExtraFirstZone
		]);

		this.updateView(state);
		this.updateSnapAccel(state.hasteTime);

		const phyMode = state.physicsMode;
		const tickInterval = state.tickInterval;
		const speed = state.speed;
		const dropSpeed = state.dropSpeed;
		const speedSquared = speed * speed;
		const dropSpeedSquared = dropSpeed * dropSpeed;

		const velAngle = state.velAngle;
		const wishDir = state.wishDir;
		const wishAngle = state.wishAngle;
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const viewDir = {
			x: Math.cos(viewAngle),
			y: Math.sin(viewAngle)
		};

		this.clearZones(this.primeZones);
		this.clearZones(this.primeInactiveZonesLeft);
		this.clearZones(this.primeInactiveZonesRight);
		this.clearZones(this.primeExtraZones);

		if (phyMode !== DefragAPI.DefragPhysics.VTG && speed > this.primeMinSpeed) {
			// the real acceleration gives ground zones on the ground (GROUND) and a/d turn zones in the air (CPM_TURN,
			// always in VQ3); otherwise the zones use the air strafe acceleration
			const useSnapAccel = state.falling
				? !(this.primeTruenessMode & TruenessMode.CPM_TURN || phyMode === DefragAPI.DefragPhysics.VQ3)
				: !(this.primeTruenessMode & TruenessMode.GROUND);
			// with no keys held the wish velocity is zero, which would push the targets out to 90 degrees; use the
			// max speed so the inactive zones sit where a key press would put them
			const wishSpeed = MomMath.magnitude(state.wishVel);
			const primeMaxSpeed =
				this.primeTruenessMode & TruenessMode.PROJECTED && wishSpeed > 0 ? wishSpeed : state.maxspeed;
			const primeMaxAccel = state.acceleration * primeMaxSpeed * tickInterval;
			const primeSightSpeed = useSnapAccel ? this.maxGroundSpeed : primeMaxSpeed;
			const primeSightAccel = useSnapAccel ? this.snapAccel : primeMaxAccel;

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
				this.applyConfig();
			} else if (this.primeAngles.length < this.primeZones?.length) {
				const start = this.primeAngles.length;
				const end = this.primeZones?.length;
				for (let i = start; i < end; ++i) {
					this.primeZones.pop().DeleteAsync(0);
				}
				this.applyConfig();
			}

			const targetAngle = this.findFastAngle(dropSpeed, primeSightSpeed, primeSightAccel);
			const boundaryAngle = this.findStopAngle(
				primeSightAccel,
				speedSquared,
				dropSpeed,
				dropSpeedSquared,
				targetAngle
			);
			this.updatePrimeSight(state, viewDir, viewAngle, targetAngle, boundaryAngle, velAngle);

			if (this.primeArrowEnable) {
				if (MomMath.sumOfSquares2D(wishDir) > 0) {
					let arrowAngle =
						wishAngle -
						Math.atan2(Math.round(this.primeAccel * wishDir.y), Math.round(this.primeAccel * wishDir.x));
					// outside the view, point the opposite way, like the compass arrow
					if (!(Math.abs(arrowAngle) < this.halfHFov)) {
						arrowAngle = MomMath.remapAngle(arrowAngle + Math.PI);
					}
					const leftEdge = this.mapToScreen(arrowAngle) - this.primeArrowSize;
					this.primeArrow.style.position = `${this.NaNCheck(leftEdge, 0)}px 0px 0px`;
					this.primeArrow.visible = true;
				} else {
					this.primeArrow.visible = false;
				}
			}
		}
	}

	updatePrimeSight(
		state: DefragAPI.HUDFrameState,
		viewDir: vec2,
		viewAngle: number,
		targetAngle: number,
		boundaryAngle: number,
		velAngle: number
	) {
		const inputMode = state.inputMode;
		const velocity = state.velocity;
		const gainZonesMap = new Map<ZonePanel, number>();
		const phyMode = state.physicsMode;

		let speedGain = 0;
		let gainMax = -this.primeAccel;
		let leftTarget = -targetAngle - velAngle;
		let rightTarget = targetAngle - velAngle;

		// Wish direction relative to the view, positive to the left. Strafe keys put it 45 degrees off the view
		// axis when moving forward (W+A, W+D) and 135 degrees off when moving backward (S+A, S+D).
		const wishOffset = MomMath.remapAngle(state.wishAngle - viewAngle);
		const strafeOffset = Math.PI * (Math.cos(velAngle - viewAngle) >= 0 ? 0.25 : 0.75);

		// With no keys held, the zones use the two diagonals around the key nearest the velocity: W+A/W+D when it
		// points forward, S+A/S+D backward, W+A/S+A to the left and W+D/S+D to the right. The left chain takes the
		// diagonal 45 degrees left of that key, so it stays on the left of the velocity.
		const nearestKeyOffset = Math.round(MomMath.remapAngle(velAngle - viewAngle) / (Math.PI * 0.5)) * Math.PI * 0.5;
		let leftWishOffset = MomMath.remapAngle(nearestKeyOffset + Math.PI * 0.25);
		let rightWishOffset = MomMath.remapAngle(nearestKeyOffset - Math.PI * 0.25);
		let bFill = false;
		const bVQ3 = phyMode === DefragAPI.DefragPhysics.VQ3;
		// W or S alone is air control in CPM, but VQ3 accelerates the same way in every direction
		const bForwardOnly = inputMode === InputMode.AIR_CONTROL && bVQ3;

		if (inputMode === InputMode.STRAFE_LEFT || inputMode === InputMode.STRAFE_RIGHT || bForwardOnly) {
			bFill = true;
		} else if (inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT) {
			bFill = Boolean(this.primeTruenessMode & TruenessMode.CPM_TURN || bVQ3);
		}

		// The active chain is on whichever side of the velocity the wish direction is
		const wishFromVel = MomMath.remapAngle(state.wishAngle - velAngle);
		if (Math.abs(wishFromVel) > 0.01 && Math.abs(wishFromVel) < Math.PI - 0.01) {
			this.primeActiveLeft = wishFromVel > 0;
		}

		const bTurn = inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT;
		if (bFill || bTurn) {
			// the active side uses the actual wish direction (or its strafe equivalent when a turn isn't filled),
			// and the inactive side mirrors it across the view axis
			const sideSign = Math.sign(wishOffset);
			const activeOffset = bFill ? wishOffset : sideSign * strafeOffset;
			// a diagonal mirrors across whichever of its two keys is nearer the velocity (W+A pairs with W+D around W,
			// or with S+A around A), so the pair matches the no-key zones and the inactive side stays across the velocity
			const velFromView = MomMath.remapAngle(velAngle - viewAngle);
			const keyA = wishOffset - Math.PI * 0.25;
			const keyB = wishOffset + Math.PI * 0.25;
			const mirrorKey =
				Math.abs(MomMath.remapAngle(velFromView - keyA)) <= Math.abs(MomMath.remapAngle(velFromView - keyB))
					? keyA
					: keyB;
			let inactiveOffset = bTurn ? -sideSign * strafeOffset : MomMath.remapAngle(2 * mirrorKey - wishOffset);
			// W or S alone lies on the view axis, so there is nothing to mirror: the inactive side uses the same keys
			if (bForwardOnly) inactiveOffset = wishOffset;
			if (this.primeActiveLeft) {
				leftWishOffset = activeOffset;
				rightWishOffset = inactiveOffset;
			} else {
				leftWishOffset = inactiveOffset;
				rightWishOffset = activeOffset;
			}
		}

		if (bTurn) {
			const mirrorTarget = this.findFastAngle(state.speed, this.maxGroundSpeed, AIR_ACCEL);
			if (this.primeActiveLeft) rightTarget = mirrorTarget - velAngle;
			else leftTarget = -mirrorTarget - velAngle;
		}

		const fillLeftZones = bFill && this.primeActiveLeft;
		const fillRightZones = bFill && !this.primeActiveLeft;
		const leftOffset = -leftWishOffset - viewAngle;
		const rightOffset = -rightWishOffset - viewAngle;
		const leftWishDir = MomMath.rotateVector2D(viewDir, leftWishOffset);
		const rightWishDir = MomMath.rotateVector2D(viewDir, rightWishOffset);

		const leftAngles = fillLeftZones ? this.primeAngles : this.snapAngles;
		const rightAngles = fillRightZones ? this.primeAngles : this.snapAngles;

		const leftChain = this.findPrimeChain(leftTarget, leftOffset, leftAngles);
		const rightChain = this.findPrimeChain(rightTarget, rightOffset, rightAngles);

		// first zones are drawn from the target outward, but their gain uses the whole zone
		const [firstLeftEdge, firstLeftEnd] = this.primeZoneEdges(leftChain, leftChain.first);
		if (fillLeftZones || this.primeShowInactive) {
			this.drawPrimeZone(this.primeFirstZoneLeft, firstLeftEdge, leftChain.target);
			this.primeFirstZoneLeft.isInactive = !fillLeftZones;
		} else {
			this.clearZones([this.primeFirstZoneLeft]);
		}

		// both first zones count toward the height scale, so diagonal strafing shows which side has more gain;
		// CPM a/d turn zones scale by their own gain, since the mirrored strafe side's would always dwarf them
		const bTurnScaleOnly = bTurn && bFill && !bVQ3;
		speedGain = this.findPrimeGain(0.5 * (firstLeftEdge + firstLeftEnd), velocity, leftWishDir);
		gainZonesMap.set(this.primeFirstZoneLeft, speedGain);
		if ((fillLeftZones || !bTurnScaleOnly) && speedGain > gainMax) gainMax = speedGain;

		const [firstRightStart, firstRightEdge] = this.primeZoneEdges(rightChain, rightChain.first);
		if (fillRightZones || this.primeShowInactive) {
			this.drawPrimeZone(this.primeFirstZoneRight, rightChain.target, firstRightEdge);
			this.primeFirstZoneRight.isInactive = !fillRightZones;
		} else {
			this.clearZones([this.primeFirstZoneRight]);
		}

		speedGain = this.findPrimeGain(0.5 * (firstRightStart + firstRightEdge), velocity, rightWishDir);
		gainZonesMap.set(this.primeFirstZoneRight, speedGain);
		if ((fillRightZones || !bTurnScaleOnly) && speedGain > gainMax) gainMax = speedGain;

		// the boundary lies (boundaryAngle - targetAngle) further out from the target, on the same side
		if (fillLeftZones) {
			const leftBoundary = leftChain.target - (boundaryAngle - targetAngle);
			gainMax = this.fillPrimeZones(
				leftChain,
				-1,
				leftBoundary,
				this.primeZones,
				gainZonesMap,
				gainMax,
				velocity,
				leftWishDir
			);
		}

		if (fillRightZones) {
			const rightBoundary = rightChain.target + (boundaryAngle - targetAngle);
			gainMax = this.fillPrimeZones(
				rightChain,
				1,
				rightBoundary,
				this.primeZones,
				gainZonesMap,
				gainMax,
				velocity,
				rightWishDir
			);
		}

		// inactive sides always draw their first zone (above); the rest of their chain is optional
		if (this.primeShowInactive && this.primeInactiveChain) {
			const boundaryDistance = boundaryAngle - targetAngle;
			if (!fillLeftZones) {
				this.fillInactiveChain(
					leftChain,
					-1,
					leftChain.target - boundaryDistance,
					this.primeInactiveZonesLeft,
					'PrimeInactiveZoneLeft',
					gainZonesMap,
					velocity,
					leftWishDir
				);
			}
			if (!fillRightZones) {
				this.fillInactiveChain(
					rightChain,
					1,
					rightChain.target + boundaryDistance,
					this.primeInactiveZonesRight,
					'PrimeInactiveZoneRight',
					gainZonesMap,
					velocity,
					rightWishDir
				);
			}
		}

		// VQ3 half-beat: the opposite single key (D while holding W+A), with its target mirrored about the velocity
		// onto the inactive side. Shown once its target lies past the active diagonal's target (W+A) on the inactive
		// side, so its chain, which runs outward from the target, never overlaps the diagonal zones. With the early
		// option, shown as soon as its target is closer to the crosshair than the mirrored diagonal's (W+D).
		const bDiagonal = inputMode === InputMode.STRAFE_LEFT || inputMode === InputMode.STRAFE_RIGHT;
		if (this.primeShowHalfBeat && bVQ3 && bDiagonal) {
			const halfBeatWishOffset = -Math.sign(wishOffset) * Math.PI * 0.5;
			const halfBeatWishDir = MomMath.rotateVector2D(viewDir, halfBeatWishOffset);
			const bLeft = !this.primeActiveLeft;
			const halfBeatChain = this.findPrimeChain(
				bLeft ? -targetAngle - velAngle : targetAngle - velAngle,
				-halfBeatWishOffset - viewAngle,
				this.primeAngles
			);
			const mirrorTarget = (bLeft ? leftChain : rightChain).target;
			const activeTarget = (bLeft ? rightChain : leftChain).target;
			const halfBeatDirection = bLeft ? -1 : 1;
			const bShowHalfBeat = this.primeHalfBeatEarly
				? Math.abs(halfBeatChain.target) < Math.abs(mirrorTarget)
				: (halfBeatChain.target - activeTarget) * halfBeatDirection > 0;

			if (bShowHalfBeat) {
				const [firstStart, firstEnd] = this.primeZoneEdges(halfBeatChain, halfBeatChain.first);
				if (bLeft) this.drawPrimeZone(this.primeExtraFirstZone, firstStart, halfBeatChain.target);
				else this.drawPrimeZone(this.primeExtraFirstZone, halfBeatChain.target, firstEnd);
				gainZonesMap.set(
					this.primeExtraFirstZone,
					this.findPrimeGain(0.5 * (firstStart + firstEnd), velocity, halfBeatWishDir)
				);

				if (this.primeInactiveChain) {
					const direction = bLeft ? -1 : 1;
					this.fillInactiveChain(
						halfBeatChain,
						direction,
						halfBeatChain.target + direction * (boundaryAngle - targetAngle),
						this.primeExtraZones,
						'PrimeExtraZone',
						gainZonesMap,
						velocity,
						halfBeatWishDir
					);
				}
			}
		}

		// CPM a/d turns: the inactive side shows the opposite diagonal (W+D while holding A), so also show the
		// same-side diagonal (W+A) as inactive zones; either can have more gain depending on the velocity. Half-beat
		// is VQ3-only, so the extra chain's panels are free here.
		if (bTurnScaleOnly && this.primeShowInactive) {
			const sameWishOffset = Math.sign(wishOffset) * strafeOffset;
			const sameWishDir = MomMath.rotateVector2D(viewDir, sameWishOffset);
			const bLeft = MomMath.remapAngle(viewAngle + sameWishOffset - velAngle) > 0;
			const strafeTarget = this.findFastAngle(state.speed, this.maxGroundSpeed, AIR_ACCEL);
			const sameChain = this.findPrimeChain(
				bLeft ? -strafeTarget - velAngle : strafeTarget - velAngle,
				-sameWishOffset - viewAngle,
				this.snapAngles
			);
			const direction = bLeft ? -1 : 1;

			const [firstStart, firstEnd] = this.primeZoneEdges(sameChain, sameChain.first);
			if (bLeft) this.drawPrimeZone(this.primeExtraFirstZone, firstStart, sameChain.target);
			else this.drawPrimeZone(this.primeExtraFirstZone, sameChain.target, firstEnd);
			gainZonesMap.set(
				this.primeExtraFirstZone,
				this.findPrimeGain(0.5 * (firstStart + firstEnd), velocity, sameWishDir)
			);

			if (this.primeInactiveChain) {
				this.fillInactiveChain(
					sameChain,
					direction,
					sameChain.target + direction * (boundaryAngle - targetAngle),
					this.primeExtraZones,
					'PrimeExtraZone',
					gainZonesMap,
					velocity,
					sameWishDir
				);
			}
		}

		// heights are worked out in screen pixels, so every zone meets the center line on the same pixel row
		const uiScale = this.scale;
		const linePixels = Math.round(this.primeHeight * uiScale);
		const scale = this.NaNCheck(1 / (gainMax > 0 ? gainMax : this.primeAccel), 1);
		// in CPM a/d turns the inactive zones (both diagonals) scale by their own best gain, like the turn zones do
		let inactiveScale = scale;
		if (bTurnScaleOnly) {
			let inactiveGainMax = 0;
			for (const [zone, gain] of gainZonesMap.entries()) {
				if (zone.isInactive && gain > inactiveGainMax) inactiveGainMax = gain;
			}
			inactiveScale = this.NaNCheck(1 / (inactiveGainMax > 0 ? inactiveGainMax : this.primeAccel), 1);
		}
		for (const [zone, gain] of gainZonesMap.entries()) {
			const zoneScale = zone.isInactive ? inactiveScale : scale;
			const gainFactor = this.NaNCheck(Math.min(Math.abs(gain * zoneScale), 1), 1);
			const secondLine = gain < 0 && !this.primeLockOneLine;
			const height = this.NaNCheck(this.primeHeight * (this.primeHeightgainEnable ? gainFactor : 1), 0);
			const heightPixels = Math.min(Math.round(height * uiScale), linePixels);
			const marginPixels = secondLine ? linePixels : linePixels - heightPixels;
			zone.style.height = this.pixelLength(heightPixels / uiScale, uiScale);
			zone.style.marginTop = this.pixelOffset(marginPixels / uiScale, uiScale);
			zone.style.marginBottom = this.pixelOffset(
				(secondLine ? linePixels - heightPixels : (this.lineCount() - 1) * linePixels) / uiScale,
				uiScale
			);

			if (zone.isInactive) {
				this.styleInactiveZone(
					zone,
					this.primeInactiveGainColor ? this.findGainColor(gain, gainFactor) : this.primeAltColor
				);
				continue;
			}

			zone.color = this.findGainColor(gain, gainFactor);

			// first zones switch between active and inactive, so drop any inactive outline
			if (zone === this.primeFirstZoneLeft || zone === this.primeFirstZoneRight) {
				zone.style.border = '0px solid rgba(0, 0, 0, 0)';
				zone.style.padding = '0px';
			}

			if (this.primeHlEnable && this.shouldHighlight(zone)) {
				this.zoneCopy(this.primeHighlightZone, zone);
				this.drawZone(this.primeHighlightZone);
				this.primeHighlightZone.style.height = this.pixelLength(linePixels / uiScale, uiScale);
				this.primeHighlightZone.style.marginTop = this.pixelOffset(
					(secondLine ? linePixels : 0) / uiScale,
					uiScale
				);

				const [r, g, b, a = 255] = rgbaStringToTuple(zone.color);
				zone.color = tupleToRgbaString([r, g, b, MomMath.lerp(a, 255, this.primeHlStrength)]);
			}

			zone.style.backgroundColor = zone.color;
		}
	}

	/** Zone color for a gain: loss color, or gain color (scaled from the alt color when coloring by gain). */
	findGainColor(gain: number, gainFactor: number): rgbaColor {
		if (gain < 0) return this.primeLossColor;
		if (this.primeColorgainEnable)
			return rgbaStringLerp(this.primeAltColor, this.primeGainColor, gainFactor) as rgbaColor;
		return this.primeGainColor;
	}

	/** Inactive and half-beat zones are either filled or outlined with the given color. */
	styleInactiveZone(zone: ZonePanel, color: rgbaColor) {
		const border = this.primeInactiveOutline ? INACTIVE_BORDER : 0;
		zone.style.backgroundColor = this.primeInactiveOutline ? 'rgba(0, 0, 0, 0)' : color;
		zone.style.border = `${border}px solid ${color}`;
		zone.style.padding = border ? `-${border}px` : '0px';
	}

	/** Creates a panel for an inactive or half-beat chain. */
	initInactiveZone(id: string): ZonePanel {
		const zone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, id));
		zone.isInactive = true;
		if (PRIME_SIGHT_CLASS) this.applyClass(zone, PRIME_SIGHT_CLASS);
		zone.style.verticalAlign = 'top';
		return zone;
	}

	/**
	 * Fills an inactive or half-beat chain. Its gains stay out of gainMax so they don't rescale the active chain,
	 * and its panel pool is sized to the chain's angle table.
	 */
	fillInactiveChain(
		chain: PrimeChain,
		direction: number,
		boundary: number,
		pool: ZonePanel[],
		idPrefix: string,
		gainZonesMap: Map<ZonePanel, number>,
		velocity: vec3,
		wishDir: vec2
	) {
		while (pool.length < chain.angles.length) pool.push(this.initInactiveZone(`${idPrefix}${pool.length}`));
		while (pool.length > chain.angles.length) pool.pop().DeleteAsync(0);
		this.fillPrimeZones(chain, direction, boundary, pool, gainZonesMap, 0, velocity, wishDir);
	}

	/**
	 * Finds where a chain starts. The angle table covers [-pi/2, pi/2] and repeats every pi, but the chain is laid
	 * out from its view-relative target in [-pi, pi], so its zones keep their real directions and never wrap.
	 */
	findPrimeChain(target: number, offset: number, angles: number[]): PrimeChain {
		const tableTarget = MomMath.wrapToHalfPi(target);
		let first = -1;
		while (first + 1 < angles.length && angles[first + 1] <= tableTarget) ++first;
		return { angles, tableTarget, first, target: MomMath.remapAngle(target - offset) };
	}

	/** View-relative left and right edges of the chain's zone k, where k may run past either end of the table. */
	primeZoneEdges(chain: PrimeChain, k: number): [number, number] {
		const count = chain.angles.length;
		const edge = (j: number) =>
			chain.angles[((j % count) + count) % count] +
			Math.PI * Math.floor(j / count) -
			chain.tableTarget +
			chain.target;
		return [edge(k), edge(k + 1)];
	}

	/** Draws a zone from unwrapped view-relative angles. Anything outside the FOV is clipped by mapToScreen. */
	drawPrimeZone(zone: ZonePanel, left: number, right: number) {
		// a chain can run past +-pi; shift by whole turns so the zone sits at its real direction
		const turns = 2 * Math.PI * Math.round((left + right) / (4 * Math.PI));
		zone.leftAngle = left - turns;
		zone.rightAngle = right - turns;
		zone.leftPx = this.mapToScreen(zone.leftAngle);
		zone.rightPx = this.mapToScreen(zone.rightAngle);
		this.drawZone(zone);
	}

	/**
	 * Fills a chain's zones outward from its first zone, up to the first zone past the cgaz boundary.
	 * Returns gainMax raised to the largest gain among them.
	 */
	fillPrimeZones(
		chain: PrimeChain,
		direction: number,
		boundary: number,
		zones: ZonePanel[],
		gainZonesMap: Map<ZonePanel, number>,
		gainMax: number,
		velocity: vec3,
		wishDir: vec2
	) {
		const count = chain.angles.length;
		for (let step = 1; step < count; ++step) {
			const k = chain.first + direction * step;
			const zone = zones[((k % count) + count) % count];
			const [left, right] = this.primeZoneEdges(chain, k);
			this.drawPrimeZone(zone, left, right);

			// gain comes from the zone's real direction, not from what is left on screen after clipping
			const speedGain = this.findPrimeGain(0.5 * (left + right), velocity, wishDir);
			gainZonesMap.set(zone, speedGain);
			if (speedGain < 0) break;
			if (speedGain > gainMax) gainMax = speedGain;

			const innerEdge = direction > 0 ? left : right;
			if (direction * (innerEdge - boundary) >= 0) break;
		}
		return gainMax;
	}

	/** Check whether center screen falls between zone left and right edge (inclusive). */
	shouldHighlight(zone: ZonePanel): boolean {
		const center = (0.5 * this.screenX) / this.scaleX;
		return zone.rightPx - center >= 0 && zone.leftPx - center <= 0;
	}

	/** Speed gain from aiming at a view-relative angle. */
	findPrimeGain(angle: number, velocity: vec2, wishDir: vec2): number {
		const zoneVector = MomMath.rotateVector2D(wishDir, -angle);
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

	zoneCopy(pasteZone: ZonePanel, copyZone: ZonePanel) {
		pasteZone.leftAngle = copyZone.leftAngle;
		pasteZone.rightAngle = copyZone.rightAngle;
		pasteZone.leftPx = copyZone.leftPx;
		pasteZone.rightPx = copyZone.rightPx;
	}
}
