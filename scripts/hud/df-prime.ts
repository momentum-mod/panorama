import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import * as MomMath from 'util/math';
import { rgbaStringLerp, rgbaStringToTuple, tupleToRgbaString } from 'util/colors';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { DFHudComponent, InputMode, StyleObject, ZonePanel } from 'common/df-hud';

enum TruenessMode {
	GROUND = 1 << 0, // show ground zones
	PROJECTED = 1 << 1, // show zones scaled by +jump/+crouch
	CPM_TURN = 1 << 2 // show a/d and ground zones
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
	primeFirstZoneLeft = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneLeft'));
	primeFirstZoneRight = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneRight'));
	primeHighlightZone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeHighlightZone'));
	primeArrow = $('#PrimeArrow');
	primeArrowIcon = $<Image>('#PrimeArrowIcon');
	primeAccel: number;
	primeAngles: number[] = [];

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
		this.primeShowInactive = primeConfig.inactiveEnable;
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
		for (const zone of this.primeZones) {
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
		this.clearZones([this.primeFirstZoneLeft, this.primeFirstZoneRight, this.primeHighlightZone]);

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

		if (this.primeEnable && phyMode !== DefragAPI.DefragPhysics.VTG && speed > this.primeMinSpeed) {
			const useSnapAccel = !(
				this.primeTruenessMode & TruenessMode.CPM_TURN || phyMode === DefragAPI.DefragPhysics.VQ3
			);
			const primeMaxSpeed =
				this.primeTruenessMode & TruenessMode.PROJECTED ? MomMath.magnitude(state.wishVel) : state.maxspeed;
			const primeMaxAccel = state.acceleration * primeMaxSpeed * tickInterval;
			const primeSightSpeed = useSnapAccel ? this.maxGroundSpeed : primeMaxSpeed;
			const primeSightAccel = useSnapAccel ? this.snapAccel : primeMaxAccel;

			if (this.primeAccel !== primeSightAccel) {
				this.primeAccel = primeSightAccel;

				this.primeAngles = this.findSnapAngles(primeSightAccel);
			}

			// the pool only grows, so takeoffs and landings, whose angle tables differ in size, don't recreate panels
			while (this.primeZones.length < this.primeAngles.length)
				this.primeZones.push(this.initPrimeZone(`PrimeZone${this.primeZones.length}`));

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
		} else {
			this.primeArrow.visible = false;
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
		const wishOffset = this.findKeyWish(state).offset;
		const strafeOffset = Math.PI * (Math.cos(velAngle - viewAngle) >= 0 ? 0.25 : 0.75);

		// The left chain's wish direction sits strafeOffset to the left of the view when moving forward and to the
		// right when moving backward, so it stays on the left of the velocity either way.
		const bForward = strafeOffset < Math.PI * 0.5;
		let leftWishOffset = bForward ? strafeOffset : -strafeOffset;
		let rightWishOffset = -leftWishOffset;
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
		const wishFromVel = MomMath.remapAngle(viewAngle + wishOffset - velAngle);
		if (
			(state.forwardMove || state.rightMove) &&
			Math.abs(wishFromVel) > 0.01 &&
			Math.abs(wishFromVel) < Math.PI - 0.01
		) {
			this.primeActiveLeft = wishFromVel > 0;
		}

		const bTurn = inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT;
		if (bFill || bTurn) {
			// the active side uses the actual wish direction (or its strafe equivalent when a turn isn't filled),
			// and the inactive side mirrors it across the view axis
			const sideSign = Math.sign(wishOffset);
			const activeOffset = bFill ? wishOffset : sideSign * strafeOffset;
			let inactiveOffset = bTurn ? -sideSign * strafeOffset : -wishOffset;
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
			const mirrorTarget = this.findFastAngle(state.dropSpeed, this.maxGroundSpeed, this.snapAccel);
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
			this.primeFirstZoneLeft.style.backgroundColor = this.primeAltColor;
			this.primeFirstZoneLeft.isInactive = !fillLeftZones;
		} else {
			this.clearZones([this.primeFirstZoneLeft]);
		}

		speedGain = this.findPrimeGain(0.5 * (firstLeftEdge + firstLeftEnd), velocity, leftWishDir);
		gainZonesMap.set(this.primeFirstZoneLeft, speedGain);
		if (speedGain > gainMax) gainMax = speedGain;

		const [firstRightStart, firstRightEdge] = this.primeZoneEdges(rightChain, rightChain.first);
		if (fillRightZones || this.primeShowInactive) {
			this.drawPrimeZone(this.primeFirstZoneRight, rightChain.target, firstRightEdge);
			this.primeFirstZoneRight.style.backgroundColor = this.primeAltColor;
			this.primeFirstZoneRight.isInactive = !fillRightZones;
		} else {
			this.clearZones([this.primeFirstZoneRight]);
		}

		speedGain = this.findPrimeGain(0.5 * (firstRightStart + firstRightEdge), velocity, rightWishDir);
		gainZonesMap.set(this.primeFirstZoneRight, speedGain);
		if (speedGain > gainMax) gainMax = speedGain;

		if (fillLeftZones) {
			const leftBoundary = leftChain.target - (boundaryAngle - targetAngle);
			gainMax = this.fillActivePrimeZones(
				leftChain,
				-1,
				leftBoundary,
				gainZonesMap,
				gainMax,
				velocity,
				leftWishDir
			);
		}

		if (fillRightZones) {
			const rightBoundary = rightChain.target + (boundaryAngle - targetAngle);
			gainMax = this.fillActivePrimeZones(
				rightChain,
				1,
				rightBoundary,
				gainZonesMap,
				gainMax,
				velocity,
				rightWishDir
			);
		}

		const scale = this.NaNCheck(1 / (gainMax > 0 ? gainMax : this.primeAccel), 1);
		for (const [zone, gain] of gainZonesMap.entries()) {
			const gainFactor = this.NaNCheck(Math.min(Math.abs(gain * scale), 1), 1);
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

				const [r, g, b, a = 255] = rgbaStringToTuple(zone.color);
				zone.color = tupleToRgbaString([r, g, b, MomMath.lerp(a, 255, this.primeHlStrength)]);
			}

			zone.style.backgroundColor = zone.color;
		}
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
	fillActivePrimeZones(
		chain: PrimeChain,
		direction: number,
		boundary: number,
		gainZonesMap: Map<ZonePanel, number>,
		gainMax: number,
		velocity: vec3,
		wishDir: vec2
	) {
		const count = chain.angles.length;
		for (let step = 1; step < count; ++step) {
			const k = chain.first + direction * step;
			const zone = this.primeZones[((k % count) + count) % count];
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

	/** Creates a panel for the active chains. Zones are never deleted: ones past the angle table stay cleared. */
	initPrimeZone(id: string): ZonePanel {
		const zone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, id));
		zone.color = this.primeAltColor; // used for highlight
		if (PRIME_SIGHT_CLASS) this.applyClass(zone, PRIME_SIGHT_CLASS);
		zone.style.verticalAlign = 'top';
		return zone;
	}

	/** Check whether center screen falls between zone left and right edge (inclusive). */
	shouldHighlight(zone: ZonePanel): boolean {
		const center = (0.5 * this.screenX) / this.scale;
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
