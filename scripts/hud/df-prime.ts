import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import * as MomMath from 'util/math';
import { rgbaStringLerp, rgbaStringToTuple, tupleToRgbaString } from 'util/colors';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { DFHudComponent, InputMode, isOnSlick, StyleObject, ZonePanel } from 'common/df-hud';

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

	primeEnable: boolean;
	primeTruenessMode: int32;
	primeChain: boolean;
	primeShowInactive: boolean;
	primeShowHalfBeat: boolean;
	primeHalfBeatEarly: boolean;
	primeInactiveChain: boolean;
	primeInactiveOutline: boolean;
	primeInactiveOutlineWidth: float;
	primeInactiveGainColor: boolean;
	primeLockOneLine: boolean;
	primeMinSpeed: float;
	primeHeight: float;
	primeOffset: float;
	primeGainColor: rgbaColor;
	primeLossColor: rgbaColor;
	primeAltColor: rgbaColor;
	primeHlEnable: boolean;
	primeHlStrength: float;
	primeHlBorder: int32;
	primeHlColor: rgbaColor;
	primeHeightgainEnable: boolean;
	primeColorgainEnable: boolean;
	primeArrowEnable: boolean;
	primeArrowSize: float;
	primeArrowColor: rgbaColor;
	/** Which side of the velocity the active chain is on, kept while the wish direction is on the velocity line */
	primeActiveLeft = true;

	constructor() {
		super();

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

		$.RegisterForUnhandledEvent('OnDefragHUDPrimeChange', () => this.onPrimeConfigChange());
	}

	onLoad() {
		this.projection = DefragAPI.GetHUDProjection();
		this.onPrimeConfigChange();
	}

	onPrimeConfigChange() {
		const primeConfig = $.GetContextPanel<MomHudDFPrime>().GetPrimeCFG();
		this.primeEnable = primeConfig.enable;
		this.primeTruenessMode = primeConfig.truenessMode;
		this.primeChain = primeConfig.chainEnable;
		this.primeShowInactive = primeConfig.inactiveEnable;
		this.primeShowHalfBeat = primeConfig.inactiveEnable && primeConfig.inactiveHalfBeatMode > 0;
		this.primeHalfBeatEarly = primeConfig.inactiveHalfBeatMode === 2;
		this.primeInactiveChain = primeConfig.inactiveChainEnable;
		this.primeInactiveOutline = primeConfig.inactiveOutlineEnable;
		this.primeInactiveOutlineWidth = primeConfig.inactiveOutlineWidth;
		this.primeInactiveGainColor = primeConfig.inactiveGainColorEnable;
		this.primeLockOneLine = primeConfig.oneLineEnable;
		this.primeMinSpeed = primeConfig.minSpeed;
		this.primeHeight = primeConfig.height;
		this.primeOffset = primeConfig.offset;
		this.primeGainColor = primeConfig.gainColor;
		this.primeLossColor = primeConfig.lossColor;
		this.primeAltColor = primeConfig.altColor;
		this.primeHlEnable = primeConfig.highlightEnable;
		this.primeHlStrength = primeConfig.highlightStrength;
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

	onUpdate() {
		const state = DefragAPI.GetHUDFrameState();
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
		const { angle: wishAngle, dir: wishDir } = this.findKeyWish(state);
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const viewDir = {
			x: Math.cos(viewAngle),
			y: Math.sin(viewAngle)
		};

		this.clearZones(this.primeZones);
		this.clearZones(this.primeInactiveZonesLeft);
		this.clearZones(this.primeInactiveZonesRight);
		this.clearZones(this.primeExtraZones);

		if (this.primeEnable && phyMode !== DefragAPI.DefragPhysics.VTG && speed > this.primeMinSpeed) {
			// the real acceleration gives ground zones on the ground (GROUND) and a/d turn zones in the air (CPM_TURN,
			// always in VQ3); otherwise the zones use the air strafe acceleration. VQ3 slick accelerates the same way
			// as VQ3 air, so it gets the air zones whatever GROUND is set to
			const bAirAccel = state.falling || (phyMode === DefragAPI.DefragPhysics.VQ3 && isOnSlick(state));
			const useSnapAccel = bAirAccel
				? !(this.primeTruenessMode & TruenessMode.CPM_TURN || phyMode === DefragAPI.DefragPhysics.VQ3)
				: !(this.primeTruenessMode & TruenessMode.GROUND);
			// PROJECTED scales the zones by how much +jump/+crouch cut the wish speed below the max speed, for the air
			// strafe zones as well as the real ones. With no keys held the wish velocity is zero, which would push the
			// targets out to 90 degrees; leave those unscaled so the inactive zones sit where a key press would put them
			const wishSpeed = MomMath.magnitude(state.wishVel);
			const projectedScale =
				this.primeTruenessMode & TruenessMode.PROJECTED && wishSpeed > 0 && state.maxspeed > 0
					? Math.min(wishSpeed / state.maxspeed, 1)
					: 1;
			const primeMaxSpeed = state.maxspeed * projectedScale;
			const primeMaxAccel = state.acceleration * primeMaxSpeed * tickInterval;
			const primeSightSpeed = useSnapAccel ? this.maxGroundSpeed * projectedScale : primeMaxSpeed;
			const primeSightAccel = useSnapAccel ? this.snapAccel * projectedScale : primeMaxAccel;

			if (this.primeAccel !== primeSightAccel) {
				this.primeAccel = primeSightAccel;

				this.primeAngles = this.findSnapAngles(primeSightAccel);
			}

			// the pool only grows, so takeoffs and landings, whose angle tables differ in size, don't recreate panels
			while (this.primeZones.length < this.primeAngles.length)
				this.primeZones.push(this.initPrimeZone(`PrimeZone${this.primeZones.length}`));

			const targetAngle = this.findFastAngle(dropSpeed, primeSightSpeed, primeSightAccel);
			// the air strafe target, for the a/d turn chains drawn with the air strafe angles
			const strafeTargetAngle = this.findFastAngle(
				dropSpeed,
				this.maxGroundSpeed * projectedScale,
				this.snapAccel * projectedScale
			);
			const boundaryAngle = this.findStopAngle(
				primeSightAccel,
				speedSquared,
				dropSpeed,
				dropSpeedSquared,
				targetAngle
			);
			this.updatePrimeSight(state, viewDir, viewAngle, targetAngle, strafeTargetAngle, boundaryAngle, velAngle);

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
		} else {
			this.primeArrow.visible = false;
		}
	}

	updatePrimeSight(
		state: DefragAPI.HUDFrameState,
		viewDir: vec2,
		viewAngle: number,
		targetAngle: number,
		strafeTargetAngle: number,
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
		const wishOffset = this.findKeyWish(state).offset;
		const strafeOffset = Math.PI * (Math.cos(velAngle - viewAngle) >= 0 ? 0.25 : 0.75);
		const velFromView = MomMath.remapAngle(velAngle - viewAngle);
		const bVQ3 = phyMode === DefragAPI.DefragPhysics.VQ3;

		// With no keys held, the zones use the two inputs 45 degrees either side of the input nearest the velocity,
		// the left chain taking the one on the left so it stays on the left of the velocity. VQ3 accelerates the same
		// way for all 8 inputs, so that can be any of them: W+A/W+D moving along W, A/S moving along S+A. CPM single
		// keys turn instead, so it always uses the diagonals around the nearest key: W+A/W+D when the velocity points
		// forward, S+A/S+D backward, W+A/S+A to the left and W+D/S+D to the right.
		const noKeyStep = Math.PI * (bVQ3 ? 0.25 : 0.5);
		const nearestInputOffset = Math.round(velFromView / noKeyStep) * noKeyStep;
		let leftWishOffset = MomMath.remapAngle(nearestInputOffset + Math.PI * 0.25);
		let rightWishOffset = MomMath.remapAngle(nearestInputOffset - Math.PI * 0.25);
		let bFill = false;
		// W or S alone is air control in CPM, but VQ3 accelerates the same way in every direction
		const bForwardOnly = inputMode === InputMode.AIR_CONTROL && bVQ3;

		if (inputMode === InputMode.STRAFE_LEFT || inputMode === InputMode.STRAFE_RIGHT || bForwardOnly) {
			bFill = true;
		} else if (inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT) {
			bFill = Boolean(this.primeTruenessMode & TruenessMode.CPM_TURN || bVQ3);
		}

		// The active chain is on whichever side of the velocity the wish direction is
		const wishFromVel = MomMath.remapAngle(viewAngle + wishOffset - velAngle);
		if (
			(state.forwardMove || state.rightMove) &&
			Math.abs(wishFromVel) > 0.01 &&
			Math.abs(wishFromVel) < Math.PI - 0.01
		) {
			this.primeActiveLeft = wishFromVel > 0;
		}

		const bTurn = inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT;
		// VQ3 only: the half-beat input drawn beside the mirrored one on the inactive side, when shown
		let halfBeatOffset: number = null;
		if (bFill || bTurn) {
			// the active side uses the actual wish direction (or its strafe equivalent when a turn isn't filled),
			// and the inactive side mirrors it across the velocity
			const sideSign = Math.sign(wishOffset);
			const activeOffset = bFill ? wishOffset : sideSign * strafeOffset;
			let inactiveOffset: number;
			if (bVQ3) {
				inactiveOffset = this.findVQ3MirrorOffset(wishOffset, velFromView, targetAngle);
				halfBeatOffset = this.findVQ3HalfBeatOffset(wishOffset, velFromView, targetAngle, inactiveOffset);
			} else {
				// CPM: a diagonal mirrors across whichever of its two keys is nearer the velocity (W+A pairs with W+D
				// around W, or with S+A around A), so the pair matches the no-key zones and the inactive side stays
				// across the velocity. A/D turns mirror to the strafe diagonal on the other side.
				const keyA = wishOffset - Math.PI * 0.25;
				const keyB = wishOffset + Math.PI * 0.25;
				const mirrorKey =
					Math.abs(MomMath.remapAngle(velFromView - keyA)) <= Math.abs(MomMath.remapAngle(velFromView - keyB))
						? keyA
						: keyB;
				inactiveOffset = bTurn ? -sideSign * strafeOffset : MomMath.remapAngle(2 * mirrorKey - wishOffset);
			}
			if (this.primeActiveLeft) {
				leftWishOffset = activeOffset;
				rightWishOffset = inactiveOffset;
			} else {
				leftWishOffset = inactiveOffset;
				rightWishOffset = activeOffset;
			}
		}

		// CPM a/d turns mirror to an air strafe diagonal, so that side uses the air strafe target. VQ3 single keys
		// mirror to another single key with the same acceleration.
		if (bTurn && !bVQ3) {
			if (this.primeActiveLeft) rightTarget = strafeTargetAngle - velAngle;
			else leftTarget = -strafeTargetAngle - velAngle;
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

		if (fillLeftZones && this.primeChain) {
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

		if (fillRightZones && this.primeChain) {
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

		// VQ3 half-beat (see findVQ3HalfBeatOffset), drawn as an extra inactive chain beside the mirrored one
		if (halfBeatOffset !== null) {
			const halfBeatWishDir = MomMath.rotateVector2D(viewDir, halfBeatOffset);
			const bLeft = !this.primeActiveLeft;
			const halfBeatChain = this.findPrimeChain(
				bLeft ? -targetAngle - velAngle : targetAngle - velAngle,
				-halfBeatOffset - viewAngle,
				this.primeAngles
			);
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

		// CPM a/d turns: the inactive side shows the opposite diagonal (W+D while holding A), so also show the
		// same-side diagonal (W+A) as inactive zones; either can have more gain depending on the velocity. Half-beat
		// is VQ3-only, so the extra chain's panels are free here.
		if (bTurnScaleOnly && this.primeShowInactive) {
			const sameWishOffset = Math.sign(wishOffset) * strafeOffset;
			const sameWishDir = MomMath.rotateVector2D(viewDir, sameWishOffset);
			const bLeft = MomMath.remapAngle(viewAngle + sameWishOffset - velAngle) > 0;
			const sameChain = this.findPrimeChain(
				bLeft ? -strafeTargetAngle - velAngle : strafeTargetAngle - velAngle,
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
				(secondLine ? linePixels - heightPixels : linePixels) / uiScale,
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
					(gain < 0 ? linePixels : 0) / uiScale,
					uiScale
				);

				const [r, g, b, a = 255] = rgbaStringToTuple(zone.color);
				zone.color = tupleToRgbaString([r, g, b, MomMath.lerp(a, 255, this.primeHlStrength)]);
			}

			zone.style.backgroundColor = zone.color;
		}
	}

	/**
	 * Wish offset of the VQ3 inactive side. VQ3 accelerates the same way for all 8 inputs, so it takes the input of the
	 * same kind as the held one (diagonal or single key) whose target across the velocity is nearest the crosshair.
	 * Holding W+A that's W+D moving along W, S+A along A and S+D along S+A; holding A it's D moving along W. An input
	 * within 22.5 degrees of the velocity isn't strafing, so the inactive side uses the same keys.
	 */
	findVQ3MirrorOffset(wishOffset: number, velFromView: number, targetAngle: number): number {
		if (Math.abs(MomMath.remapAngle(wishOffset - velFromView)) <= Math.PI * 0.125) return wishOffset;

		const keyStep = Math.PI * 0.5;
		const bDiagonal =
			Math.abs(MomMath.remapAngle(wishOffset - Math.round(wishOffset / keyStep) * keyStep)) > Math.PI * 0.125;
		const kindOffset = bDiagonal ? Math.PI * 0.25 : 0;
		const ideal = velFromView + (this.primeActiveLeft ? -targetAngle : targetAngle);
		return MomMath.remapAngle(Math.round((ideal - kindOffset) / keyStep) * keyStep + kindOffset);
	}

	/**
	 * Wish offset of the VQ3 half-beat, or null when it isn't shown: the input 135 degrees from the held one on the
	 * inactive side (D while holding W+A and moving along W, S+A while holding W and moving along W+A, A while holding
	 * W+D and moving along W+A). It's shown once its target lies past the active target on the inactive side, so its
	 * chain, which runs outward from the target, never overlaps the active zones, or with the early option, as soon as
	 * its target is closer to the crosshair than the mirrored input's. An input within 22.5 degrees of the velocity
	 * isn't strafing, so it has none.
	 */
	findVQ3HalfBeatOffset(wishOffset: number, velFromView: number, targetAngle: number, mirrorOffset: number): number {
		if (!this.primeShowHalfBeat || Math.abs(MomMath.remapAngle(wishOffset - velFromView)) <= Math.PI * 0.125)
			return null;

		// view-relative chain target of a wish offset on a side of the velocity (1 left, -1 right)
		const findTarget = (offset: number, side: number) =>
			MomMath.remapAngle(offset - velFromView - side * targetAngle);
		const inactiveSide = this.primeActiveLeft ? -1 : 1;
		const halfBeatOffset = MomMath.remapAngle(wishOffset + inactiveSide * 0.75 * Math.PI);
		const halfBeatTarget = findTarget(halfBeatOffset, inactiveSide);
		const bShowHalfBeat = this.primeHalfBeatEarly
			? Math.abs(halfBeatTarget) < Math.abs(findTarget(mirrorOffset, inactiveSide))
			: (halfBeatTarget - findTarget(wishOffset, -inactiveSide)) * -inactiveSide > 0;
		return bShowHalfBeat ? halfBeatOffset : null;
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
		const border = this.primeInactiveOutline ? this.primeInactiveOutlineWidth : 0;
		zone.style.backgroundColor = this.primeInactiveOutline ? 'rgba(0, 0, 0, 0)' : color;
		zone.style.border = `${border}px solid ${color}`;
		zone.style.padding = border ? `-${border}px` : '0px';
	}

	/** Creates a panel for the active chains. Zones are never deleted: ones past the angle table stay cleared. */
	initPrimeZone(id: string): ZonePanel {
		const zone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, id));
		zone.color = this.primeAltColor; // used for highlight
		if (PRIME_SIGHT_CLASS) this.applyClass(zone, PRIME_SIGHT_CLASS);
		zone.style.verticalAlign = 'top';
		return zone;
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
	 * and its panel pool grows to the chain's angle table.
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
	 * Fills a chain's active zones outward from its first zone, up to the first zone past the cgaz boundary.
	 * Returns new gainMax after calculating each zone's gain.
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
