import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import * as MomMath from 'util/math';
import { rgbaStringLerp, rgbaStringToTuple, tupleToRgbaString } from 'util/colors';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { AIR_ACCEL, DFHudComponent, InputMode, StyleObject, ZonePanel } from 'common/df-hud';

enum TruenessMode {
	GROUND = 1 << 0, // show ground zones
	PROJECTED = 1 << 1, // show zones scaled by +jump/+crouch
	CPM_TURN = 1 << 2 // show a/d and ground zones
}

let HIGHLIGHT_CLASS: StyleObject;
let PRIME_SIGHT_CLASS: StyleObject;

@PanelHandler()
class DFPrimeHandler extends DFHudComponent {
	primeContainer = $('#PrimeContainer');
	primeZones: ZonePanel[] = [];
	primeFirstZoneLeft = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneLeft'));
	primeFirstZoneRight = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneRight'));
	primeSplitZone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeSplitZone'));
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

	onUpdate() {
		const state = DefragAPI.GetHUDFrameState();
		if (!state.valid) return;

		// clear last frame's special zones
		this.clearZones([
			this.primeSplitZone,
			this.primeFirstZoneLeft,
			this.primeFirstZoneRight,
			this.primeHighlightZone
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
			this.updatePrimeSight(state, viewDir, viewAngle, targetAngle, boundaryAngle, velAngle, wishDir);

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
		velAngle: number,
		wishDir: vec2
	) {
		const inputMode = state.inputMode;
		const velocity = state.velocity;
		const gainZonesMap = new Map<ZonePanel, number>();
		const phyMode = state.physicsMode;

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
				fillLeftZones = Boolean(
					this.primeTruenessMode & TruenessMode.CPM_TURN || phyMode === DefragAPI.DefragPhysics.VQ3
				);
				if (fillLeftZones) leftOffset = -Math.PI * 0.5 - viewAngle;
				const mirrorTarget = this.findFastAngle(state.speed, this.maxGroundSpeed, AIR_ACCEL);
				rightTarget = MomMath.wrapToHalfPi(mirrorTarget - velAngle);
				break;
			}
			case InputMode.TURN_RIGHT: {
				fillRightZones = Boolean(
					this.primeTruenessMode & TruenessMode.CPM_TURN || phyMode === DefragAPI.DefragPhysics.VQ3
				);
				if (fillRightZones) rightOffset = Math.PI * 0.5 - viewAngle;
				const mirrorTarget = this.findFastAngle(state.speed, this.maxGroundSpeed, AIR_ACCEL);
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
			this.primeFirstZoneLeft.rightPx = this.mapToScreen(MomMath.wrapToHalfPi(leftTarget - leftOffset));
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
			this.primeFirstZoneRight.leftPx = this.mapToScreen(MomMath.wrapToHalfPi(rightTarget - rightOffset));
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

	/** Updates zones that overlap cgaz zones. Returns the max potential gain from updated zones. */
	fillActivePrimeZones(
		zoneRange: { direction: number; start: number; end: number },
		offset: number,
		angles: number[],
		gainZonesMap: Map<ZonePanel, number>,
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

	zoneCopy(pasteZone: ZonePanel, copyZone: ZonePanel) {
		pasteZone.leftAngle = copyZone.leftAngle;
		pasteZone.rightAngle = copyZone.rightAngle;
		pasteZone.leftPx = copyZone.leftPx;
		pasteZone.rightPx = copyZone.rightPx;
	}
}
