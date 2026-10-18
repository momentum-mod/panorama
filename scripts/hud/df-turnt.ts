import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import * as MomMath from 'util/math';
import { rgbaStringLerp } from 'util/colors';
import { ColorPair, SyncColors } from 'common/sync-colors';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { DFHudComponent, InputMode, isOnSlick, StyleObject, ZonePanel } from 'common/df-hud';

/** A view change bigger than this in one frame is a teleport or spectator switch, not mouse movement */
const MAX_YAW_DELTA = Math.PI * 0.25;
/** Rate error, past the tolerance, at which W or S ticks are fully the loss color */
const FULL_COLOR_ERROR = 0.5;
/** Bisection steps for the asymmetric perfect band, both for its split and for the wish angle holding each edge */
const BAND_STEPS = 24;
/** Bounds on how much the tick drift is scaled on either side of an asymmetric band */
const MIN_DRIFT_WEIGHT = 0.5;
const MAX_DRIFT_WEIGHT = 4;
/** Newton steps for the W turn cubic, starting from the small-k root cos^2 = 2/3 */
const CUBIC_STEPS = 6;

/**
 * Velocity turn per tick, in radians, for holding a wish angle. pinned is the turn the ticks follow. A/D and the
 * ground also have the turns between their speed ranges: gaining speed up to pinned (max gain), still gaining up to
 * noLoss, then losing speed while turning up to maxTurn.
 */
interface TurnRates {
	pinned: number;
	noLoss?: number;
	maxTurn?: number;
	/** W or S and the ground: angle of the wish direction from the velocity that gives the pinned turn, for the arrow */
	wishOffset?: number;
	/** A/D, VTG air and slick: the perfect band's ends, split by what holding each side costs (see findPerfectBand) */
	perfectMin?: number;
	perfectMax?: number;
}

let TICK_CLASS: StyleObject;

/**
 * Turnt-meter: shows whether the view turns at the optimal rate where the optimal strafe angle moves every tick
 * (air control with W or S alone, the strafe accel with A or D alone, VTG air with any keys, and any keys on the ground
 * or on slick, as in a circle jump). A row of ticks is pinned to the view a reference turn would have (the air control
 * cubic root for W or S, the max speed gain angle otherwise), so they stand still at that rate and drift left or right
 * as fast as the rate is off.
 */
@PanelHandler()
class DFTurntHandler extends DFHudComponent {
	turntContainer = $('#TurntContainer');
	turntArrow = $('#TurntArrow');
	turntArrowIcon = $<Image>('#TurntArrowIcon');
	ticks: ZonePanel[] = [];

	turntEnable: boolean;
	turntMinSpeed: float;
	turntHeight: float;
	turntOffset: float;
	turntTickWidth: float;
	turntSpacing: number;
	turntSpan: number;
	turntTolerance: float;
	turntSmoothing: float;
	turntFadeTime: float;
	turntArrowEnable: boolean;
	turntArrowSize: float;
	turntArrowColor: rgbaColor;

	physics: DefragAPI.TurntPhysics;
	/** The physics mode the physics values were read in */
	physicsMode: DefragAPI.DefragPhysics | undefined;
	/** The last turn rates worked out, kept while fading out */
	rates: TurnRates | null = null;

	/** Offset of the tick row from the crosshair, in radians, wrapped to one tick spacing */
	phase = 0;
	/** Smoothed view turn per tick in radians, positive when turning the same way as the velocity */
	turnRate = 0;
	/** Fade in and out as the turnt-meter becomes relevant */
	alpha = 0;
	/** Which way the velocity turns, kept while the wish direction is on the velocity line */
	turnSign = 1;
	lastViewYaw: number | undefined;
	bWasRelevant = false;

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

		$.RegisterForUnhandledEvent('OnDefragHUDTurntChange', () => this.onTurntConfigChange());
	}

	onLoad() {
		this.projection = DefragAPI.GetHUDProjection();
		this.physics = $.GetContextPanel<MomHudDFTurnt>().GetTurntPhysics();
		this.onTurntConfigChange();
	}

	onTurntConfigChange() {
		const turntConfig = $.GetContextPanel<MomHudDFTurnt>().GetTurntCFG();
		this.turntEnable = turntConfig.enable;
		this.turntMinSpeed = turntConfig.minSpeed;
		this.turntHeight = turntConfig.height;
		this.turntOffset = turntConfig.offset;
		this.turntTickWidth = turntConfig.tickWidth;
		this.turntSpacing = MomMath.deg2rad(turntConfig.spacing);
		this.turntSpan = MomMath.deg2rad(turntConfig.span);
		this.turntTolerance = turntConfig.tolerance;
		this.turntSmoothing = turntConfig.smoothing;
		this.turntFadeTime = turntConfig.fadeTime;
		this.turntArrowEnable = turntConfig.arrowEnable;
		this.turntArrowSize = turntConfig.arrowSize;
		this.turntArrowColor = turntConfig.arrowColor;

		TICK_CLASS = new StyleObject(this.turntHeight, this.turntOffset, SyncColors.PERFECT[0] as rgbaColor);

		this.setupContainer(this.turntContainer, this.turntOffset);
		this.turntContainer.style.height = this.turntHeight + 'px';

		// the arrow sits on top of the tick row, pointing down at it
		const arrowWidth = 2 * this.turntArrowSize;
		this.setupArrow(
			this.turntArrow,
			this.turntArrowIcon,
			this.turntHeight + 2 * arrowWidth,
			arrowWidth,
			this.turntOffset,
			'top',
			this.turntArrowColor
		);
		this.turntArrow.visible = false;

		// enough ticks to cover the span on both sides, plus one for the phase moving them
		const count = 2 * Math.ceil(this.NaNCheck(this.turntSpan / this.turntSpacing, 0)) + 3;
		while (this.ticks.length < count)
			this.ticks.push(
				this.initZonePanel($.CreatePanel('Panel', this.turntContainer, `TurntTick${this.ticks.length}`))
			);
		while (this.ticks.length > count) this.ticks.pop().DeleteAsync(0);

		for (const tick of this.ticks) this.applyClass(tick, TICK_CLASS);
		this.clearZones(this.ticks);
	}

	onUpdate() {
		const state = DefragAPI.GetHUDFrameState();
		if (!state.valid) return;

		this.updateView(state);

		const frameTime = state.frameTime;
		const viewYaw = MomMath.deg2rad(state.viewYaw);
		let yawDelta = this.lastViewYaw === undefined ? 0 : MomMath.remapAngle(viewYaw - this.lastViewYaw);
		this.lastViewYaw = viewYaw;
		if (Math.abs(yawDelta) > MAX_YAW_DELTA) yawDelta = 0;

		const inputMode = state.inputMode;
		const bTurn = inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT;
		// the physics values only change with the gamemode, but the panel can outlive a gamemode change
		if (state.physicsMode !== this.physicsMode) {
			this.physics = $.GetContextPanel<MomHudDFTurnt>().GetTurntPhysics();
			this.physicsMode = state.physicsMode;
		}

		const bGround = state.moveStatus === MomentumMovementAPI.PlayerMoveStatus.WALK;
		// VQ3 slick accelerates like VQ3 air, which has no rate to follow
		const bGroundRelevant = !(state.physicsMode === DefragAPI.DefragPhysics.VQ3 && isOnSlick(state));
		// VTG air turns like the A/D strafe accel with any keys
		const bVTGAir = state.physicsMode === DefragAPI.DefragPhysics.VTG && inputMode !== InputMode.NONE;
		const bAirRelevant =
			state.falling &&
			(bVTGAir ||
				(bTurn
					? this.physics.airStrafeAccelerate > 0
					: inputMode === InputMode.AIR_CONTROL && this.physics.airControl > 0));
		let bRelevant =
			this.turntEnable &&
			(bGround ? bGroundRelevant : bAirRelevant) &&
			state.speed >= this.turntMinSpeed &&
			frameTime > 0;

		const rates = !bRelevant
			? null
			: bGround
				? this.findGroundRates(state)
				: bVTGAir
					? this.findVTGAirRates(state)
					: bTurn
						? this.findStrafeTurnRates(state)
						: this.findAirControlRates(state);
		bRelevant = bRelevant && rates !== null;

		const fadeStep = this.turntFadeTime > 0 ? frameTime / this.turntFadeTime : 1;
		this.alpha = Math.min(Math.max(this.alpha + (bRelevant ? fadeStep : -fadeStep), 0), 1);

		if (bRelevant) {
			// the velocity turns toward the wish direction
			const wishFromVel = MomMath.remapAngle(this.findKeyWish(state).angle - state.velAngle);
			if (Math.abs(wishFromVel) > 0.01 && Math.abs(wishFromVel) < Math.PI - 0.01)
				this.turnSign = Math.sign(wishFromVel);

			// ticks are pinned to the view the reference turn would have, so they move by however much this frame missed it
			const ticksPerFrame = frameTime / state.tickInterval;
			// with an asymmetric band, the ticks drift faster the costlier the side the turn is on
			const drift = yawDelta - this.turnSign * rates.pinned * ticksPerFrame;
			this.phase = this.wrapToSpacing(
				this.phase + drift * this.findDriftWeight(rates, this.turnSign * drift > 0)
			);

			const turn = (this.turnSign * yawDelta) / ticksPerFrame;
			const smoothing = this.turntSmoothing > 0 ? 1 - Math.exp(-frameTime / this.turntSmoothing) : 1;
			this.turnRate = this.bWasRelevant ? MomMath.lerp(this.turnRate, turn, smoothing) : turn;
			this.rates = rates;
		}
		this.bWasRelevant = bRelevant;

		if (this.alpha <= 0 || !this.rates) {
			this.clearZones(this.ticks);
			this.turntArrow.visible = false;
			return;
		}

		this.updateArrow(state);

		const color =
			this.rates.maxTurn === undefined
				? this.findRateColor(this.turnRate / this.rates.pinned)
				: this.findStrafeTurnColor();
		const half = Math.floor(this.ticks.length / 2);
		for (const [i, tick] of this.ticks.entries()) {
			const angle = (i - half) * this.turntSpacing + this.phase;
			const fade = 1 - Math.pow(Math.abs(angle) / this.turntSpan, 2);
			if (fade <= 0 || Math.abs(angle) >= this.halfHFov) {
				this.clearZones([tick]);
				continue;
			}

			const center = this.mapToScreen(angle);
			tick.leftPx = center - 0.5 * this.turntTickWidth;
			tick.rightPx = tick.leftPx + this.turntTickWidth;
			this.drawZone(tick);
			tick.style.backgroundColor = color;
			tick.style.opacity = (fade * this.alpha).toFixed(3);
		}
	}

	/** Points at the wish direction that gives the optimal W or S turn, like the old windicator arrow. */
	updateArrow(state: DefragAPI.HUDFrameState) {
		const wishOffset = this.rates.wishOffset;
		if (!this.turntArrowEnable || wishOffset === undefined) {
			this.turntArrow.visible = false;
			return;
		}

		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const angle = MomMath.remapAngle(viewAngle - (state.velAngle + this.turnSign * wishOffset));
		if (!(Math.abs(angle) < this.halfHFov)) {
			this.turntArrow.visible = false;
			return;
		}

		const leftEdge = this.mapToScreen(angle) - this.turntArrowSize;
		this.turntArrow.style.position = `${this.NaNCheck(leftEdge, 0)}px 0px 0px`;
		this.turntArrow.style.opacity = this.alpha.toFixed(3);
		this.turntArrow.visible = true;
	}

	/**
	 * W or S tick color, the same synchronizer gradient as A/D: slow to good while under-rotating, perfect within the
	 * tolerance, neutral to loss while over-rotating.
	 */
	findRateColor(ratio: number): color {
		const tolerance = this.turntTolerance;

		let pair: ColorPair;
		if (Math.abs(ratio - 1) <= tolerance) pair = SyncColors.PERFECT;
		else if (ratio < 1) pair = this.lerpColorPair(SyncColors.SLOW, SyncColors.GOOD, ratio / (1 - tolerance));
		else pair = this.lerpColorPair(SyncColors.NEUTRAL, SyncColors.LOSS, (ratio - 1 - tolerance) / FULL_COLOR_ERROR);

		return this.colorPairGradient(pair);
	}

	/**
	 * A/D and ground tick color, a synchronizer gradient over the speed ranges: slow to good while turning slower than
	 * the max gain rate, perfect at it, fading to neutral at the no-loss rate, to loss at the max turn rate and to stop
	 * past it. Above the ground max speed every turn loses speed, so the no-loss rate is the max gain rate.
	 */
	findStrafeTurnColor(): color {
		const turn = this.turnRate;
		const { pinned: maxGain, noLoss, maxTurn, perfectMin, perfectMax } = this.rates;
		if (perfectMin !== undefined && perfectMax !== undefined)
			return this.findBandTurnColor(turn, perfectMin, perfectMax, noLoss, maxTurn);

		const tolerance = this.turntTolerance * maxGain;

		let pair: ColorPair;
		if (turn <= 0) pair = SyncColors.STOP;
		else if (Math.abs(turn - maxGain) <= tolerance) pair = SyncColors.PERFECT;
		else if (turn < maxGain)
			pair = this.lerpColorPair(SyncColors.SLOW, SyncColors.GOOD, turn / (maxGain - tolerance));
		else if (turn < noLoss)
			pair = this.lerpColorPair(SyncColors.PERFECT, SyncColors.NEUTRAL, (turn - maxGain) / (noLoss - maxGain));
		else if (turn < maxTurn)
			pair = this.lerpColorPair(SyncColors.NEUTRAL, SyncColors.LOSS, (turn - noLoss) / (maxTurn - noLoss));
		else pair = this.lerpColorPair(SyncColors.LOSS, SyncColors.STOP, (turn - maxTurn) / (maxTurn - noLoss));

		return this.colorPairGradient(pair);
	}

	/**
	 * How much faster the ticks drift while turning too fast or too slow: the tolerance over that side's share of the
	 * perfect band, so the side whose band is narrower because holding it costs more drifts faster. 1 without an
	 * asymmetric band.
	 */
	findDriftWeight(rates: TurnRates, bFast: boolean): number {
		const { pinned, perfectMin, perfectMax } = rates;
		const tolerance = this.turntTolerance * pinned;
		if (perfectMin === undefined || perfectMax === undefined || !(tolerance > 0)) return 1;

		const width = bFast ? perfectMax - pinned : pinned - perfectMin;
		return Math.min(Math.max(tolerance / width, MIN_DRIFT_WEIGHT), MAX_DRIFT_WEIGHT);
	}

	/**
	 * The A/D and ground gradient around an asymmetric perfect band: slow to good up to its slow end, and the
	 * no-loss and max turn ranges starting no sooner than its fast end.
	 */
	findBandTurnColor(turn: number, perfectMin: number, perfectMax: number, noLoss: number, maxTurn: number): color {
		const noLossStart = Math.max(noLoss, perfectMax);
		const maxTurnStart = Math.max(maxTurn, noLossStart);
		// the ranges past the band can be empty when it reaches the max turn, so fall back to its width
		const lossRange = maxTurnStart - noLossStart || perfectMax - perfectMin;

		let pair: ColorPair;
		if (turn <= 0) pair = SyncColors.STOP;
		else if (turn >= perfectMin && turn <= perfectMax) pair = SyncColors.PERFECT;
		else if (turn < perfectMin) pair = this.lerpColorPair(SyncColors.SLOW, SyncColors.GOOD, turn / perfectMin);
		else if (turn < noLossStart)
			pair = this.lerpColorPair(
				SyncColors.PERFECT,
				SyncColors.NEUTRAL,
				(turn - perfectMax) / (noLossStart - perfectMax)
			);
		else if (turn < maxTurnStart)
			pair = this.lerpColorPair(SyncColors.NEUTRAL, SyncColors.LOSS, (turn - noLossStart) / lossRange);
		else pair = this.lerpColorPair(SyncColors.LOSS, SyncColors.STOP, (turn - maxTurnStart) / lossRange);

		return this.colorPairGradient(pair);
	}

	colorPairGradient(pair: ColorPair): color {
		return `gradient(linear, 0% 0%, 0% 100%, from(${pair[0]}), to(${pair[1]}))` as color;
	}

	lerpColorPair(a: ColorPair, b: ColorPair, t: number): ColorPair {
		const alpha = +Math.min(Math.max(this.NaNCheck(t, 0), 0), 1).toFixed(3);
		return [rgbaStringLerp(a[0], b[0], alpha) as color, rgbaStringLerp(a[1], b[1], alpha) as color];
	}

	wrapToSpacing(angle: number): number {
		const spacing = this.turntSpacing;
		if (!(spacing > 0)) return 0;
		return angle - spacing * Math.round(angle / spacing);
	}

	/** A or D alone: the strafe accel, with no friction before it. */
	findStrafeTurnRates(state: DefragAPI.HUDFrameState): TurnRates | null {
		const speed = state.speed;
		const wishSpeed = MomMath.magnitude2D(state.wishVel);
		const accel = this.physics.airStrafeAccelerate * wishSpeed * state.tickInterval;
		if (!(speed > accel) || !(accel > 0)) return null;

		const gainCos = this.findGainCos(speed, wishSpeed, accel);
		return {
			...this.findMaxGainRates(speed, speed, wishSpeed, accel, gainCos),
			...this.findPerfectBand(speed, speed, wishSpeed, accel, gainCos)
		};
	}

	/**
	 * VTG air with any keys: like the A/D strafe accel, but the speed added per tick comes from the unclamped
	 * wishspeed while the wish velocity is capped, so the accel can outgrow the cap.
	 */
	findVTGAirRates(state: DefragAPI.HUDFrameState): TurnRates | null {
		const speed = state.speed;
		const wishSpeed = MomMath.magnitude2D(state.wishVel);
		const accel = state.accelSpeed;
		if (!(speed > accel) || !(accel > 0)) return null;

		const gainCos = this.findGainCos(speed, wishSpeed, accel);
		return {
			...this.findMaxGainRates(speed, speed, wishSpeed, accel, gainCos),
			...this.findPerfectBand(speed, speed, wishSpeed, accel, gainCos),
			wishOffset: Math.acos(gainCos)
		};
	}

	/**
	 * Any keys on the ground or on slick, as in a circle jump: the ground accel after friction. Below
	 * wishspeed - accel the most gain is straight ahead, so nothing is drawn. With friction the speed tops out where
	 * the max gain only makes up for friction, sqrt(accel (2 wishspeed - accel) / (1 - (1 - friction dt)^2)); above
	 * it the max gain angle loses the least.
	 */
	findGroundRates(state: DefragAPI.HUDFrameState): TurnRates | null {
		const dropSpeed = state.dropSpeed;
		const wishSpeed = MomMath.magnitude2D(state.wishVel);
		const accel = state.acceleration * wishSpeed * state.tickInterval;
		if (!(dropSpeed > accel) || !(accel > 0)) return null;

		if (!((wishSpeed - accel) / dropSpeed < 1)) return null;

		const gainCos = this.findGainCos(dropSpeed, wishSpeed, accel);
		return {
			...this.findMaxGainRates(state.speed, dropSpeed, wishSpeed, accel, gainCos),
			// circle jumps keep a symmetric band; slick has no friction to even out its sides
			...(isOnSlick(state) ? this.findPerfectBand(state.speed, dropSpeed, wishSpeed, accel, gainCos) : {}),
			wishOffset: Math.acos(gainCos)
		};
	}

	/**
	 * Splits the perfect band by what holding each of its ends costs. Holding a turn rate settles the wish angle where
	 * the velocity turns that fast: inside the max gain angle on the slow side, where the clipped add gains less the
	 * further in it goes, and past it on the fast side, where the full add loses more the closer it gets to the max
	 * turn (and past that the wish angle runs away). The band keeps the symmetric width of twice the tolerance, ends no
	 * further out than the max turn, and splits so that holding either end gains the same.
	 */
	findPerfectBand(
		speed: number,
		dropSpeed: number,
		wishSpeed: number,
		accel: number,
		gainCos: number
	): { perfectMin: number; perfectMax: number } {
		const stepAt = (angle: number) => {
			const cos = Math.cos(angle);
			const add = Math.max(Math.min(accel, wishSpeed - dropSpeed * cos), 0);
			const x = dropSpeed + add * cos;
			const y = add * Math.sin(angle);
			return { turn: Math.atan2(y, x), gain: Math.hypot(x, y) - speed };
		};

		// the add starts where the wishspeed is no longer covered along the wish direction
		const minAngle = Math.acos(Math.min(wishSpeed / dropSpeed, 1));
		const gainAngle = Math.acos(gainCos);
		const maxTurnAngle = Math.acos(Math.max(-accel / dropSpeed, -1));
		const pinned = stepAt(gainAngle).turn;
		const maxFast = Math.max(stepAt(maxTurnAngle).turn / pinned - 1, 0);

		// the turn rises across each side, so the wish angle holding a turn is a bisection away
		const gainHolding = (turn: number, low: number, high: number) => {
			for (let i = 0; i < BAND_STEPS; ++i) {
				const mid = 0.5 * (low + high);
				if (stepAt(mid).turn < turn) low = mid;
				else high = mid;
			}
			return stepAt(0.5 * (low + high)).gain;
		};

		// slow share of the band: a bigger one makes the slow end gain less and the fast end gain more
		const width = 2 * this.turntTolerance;
		const gainDifference = (slow: number) =>
			gainHolding(pinned * (1 - slow), minAngle, gainAngle) -
			gainHolding(pinned * (1 + width - slow), gainAngle, maxTurnAngle);

		let low = Math.max(width - maxFast, 0);
		let high = width;
		if (gainDifference(low) <= 0) high = low;
		else if (gainDifference(high) >= 0) low = high;
		else {
			for (let i = 0; i < BAND_STEPS; ++i) {
				const mid = 0.5 * (low + high);
				if (gainDifference(mid) > 0) low = mid;
				else high = mid;
			}
		}

		const slow = 0.5 * (low + high);
		return { perfectMin: pinned * (1 - slow), perfectMax: pinned * (1 + width - slow) };
	}

	/**
	 * Cosine of the max gain angle. The accel adds its full amount from where it stops being clipped,
	 * cos = (wishspeed - accel) / dropSpeed, outward. Inside that the clipped add leaves speed^2 =
	 * dropSpeed^2 sin^2 + wishspeed^2, which peaks at 90 degrees, so an accel bigger than the wishspeed gains the most
	 * straight across.
	 */
	findGainCos(dropSpeed: number, wishSpeed: number, accel: number): number {
		return Math.min(Math.max((wishSpeed - accel) / dropSpeed, 0), 1);
	}

	/**
	 * Turn rates for an accel clipped to the wishspeed, after friction leaves dropSpeed of the speed, so each range
	 * edge is closed form: max gain at gainCos (see findGainCos), no loss where the speed ends where it started,
	 * cos = (speed^2 - dropSpeed^2 - accel^2) / (2 accel dropSpeed) with the full accel or
	 * -sqrt(dropSpeed^2 + wishspeed^2 - speed^2) / dropSpeed with the clipped add, and max turn where the added
	 * velocity is tangent to the new one, cos = -accel / dropSpeed.
	 */
	findMaxGainRates(speed: number, dropSpeed: number, wishSpeed: number, accel: number, gainCos: number): TurnRates {
		// the add is clipped to what's left of the wishspeed along the wish direction
		const clipCos = (wishSpeed - accel) / dropSpeed;
		const turnAt = (cos: number) => {
			const sin = Math.sqrt(1 - cos * cos);
			const add = Math.max(Math.min(accel, wishSpeed - dropSpeed * cos), 0);
			return Math.atan2(add * sin, dropSpeed + add * cos);
		};

		const pinned = turnAt(gainCos);
		let noLossCos = (speed * speed - dropSpeed * dropSpeed - accel * accel) / (2 * accel * dropSpeed);
		// an accel bigger than the wishspeed is clipped on the turning side too, out to clipCos
		const clippedSpeedSquared = dropSpeed * dropSpeed + wishSpeed * wishSpeed;
		if (noLossCos > clipCos && clipCos < 0 && clippedSpeedSquared >= speed * speed)
			noLossCos = Math.max(-Math.sqrt(clippedSpeedSquared - speed * speed) / dropSpeed, clipCos);
		return {
			pinned,
			// past the max speed every angle loses speed, so nothing is between max gain and no loss
			noLoss: noLossCos < gainCos ? turnAt(Math.max(noLossCos, -1)) : pinned,
			maxTurn: turnAt(-accel / dropSpeed)
		};
	}

	/**
	 * W or S alone, only once air accel adds nothing at the best angle. Air control then turns the velocity by
	 * atan(k c^2 s / (v + k c^3)) with k = 32 * aircontrol * dt, which peaks where k c^3 + 3 v c^2 - 2 v = 0.
	 * Below that speed the best angle is the fast angle boundary, where accel and air control mix, so nothing is drawn.
	 */
	findAirControlRates(state: DefragAPI.HUDFrameState): TurnRates | null {
		const speed = state.speed;
		const wishSpeed = MomMath.magnitude2D(state.wishVel);
		const k = 32 * this.physics.airControl * state.tickInterval;
		if (!(speed > 0) || !(k > 0) || !(wishSpeed > 0)) return null;

		let cos = Math.sqrt(2 / 3);
		for (let i = 0; i < CUBIC_STEPS; ++i) {
			const f = k * cos * cos * cos + 3 * speed * cos * cos - 2 * speed;
			const df = 3 * k * cos * cos + 6 * speed * cos;
			cos -= f / df;
		}

		// accel adds nothing while the wish speed is no more than the velocity along the wish direction
		if (speed * cos < wishSpeed) return null;

		const sin = Math.sqrt(1 - cos * cos);
		const cubicTurn = Math.atan2(k * cos * cos * sin, speed + k * cos * cos * cos);

		// the fast angle boundary can still out-turn the cubic root just past the speed where accel stops
		const accel = this.physics.airAccelerate * wishSpeed * state.tickInterval;
		const fastCos = (wishSpeed - accel) / speed;
		if (fastCos > -1 && fastCos < 1) {
			const fastTurn = this.simulateTurn(Math.acos(fastCos), speed, wishSpeed, state.tickInterval);
			if (fastTurn > cubicTurn) return null;
		}

		return { pinned: cubicTurn, wishOffset: Math.acos(cos) };
	}

	/** How far one tick of W or S air movement turns the velocity, with the wish direction at angle from it. */
	simulateTurn(angle: number, speed: number, wishSpeed: number, tickInterval: number): number {
		const wishX = Math.cos(angle);
		const wishY = Math.sin(angle);
		let velX = speed;
		let velY = 0;

		let accel = this.physics.airAccelerate;
		if (this.physics.airDecelerate >= 0 && MomMath.rad2deg(angle) > this.physics.airDecelerateAngle)
			accel = this.physics.airDecelerate;

		const addSpeed = wishSpeed - speed * wishX;
		if (addSpeed > 0) {
			const accelSpeed = Math.min(accel * wishSpeed * tickInterval, addSpeed);
			velX += accelSpeed * wishX;
			velY += accelSpeed * wishY;
		}

		if (this.physics.airControl > 0) {
			const newSpeed = Math.sqrt(velX * velX + velY * velY);
			const dot = (velX * wishX + velY * wishY) / newSpeed;
			if (dot > 0) {
				// the game adds k * wishdir to speed * veldir, which is the velocity itself
				const k = 32 * this.physics.airControl * dot * dot * tickInterval;
				velX += k * wishX;
				velY += k * wishY;
			}
		}

		return Math.atan2(velY, velX);
	}
}
