import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import * as MomMath from 'util/math';
import { rgbaStringLerp } from 'util/colors';
import { ColorPair, SyncColors } from 'common/sync-colors';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { DFHudComponent, InputMode, StyleObject, ZonePanel } from 'common/df-hud';

/** A view change bigger than this in one frame is a teleport or spectator switch, not mouse movement */
const MAX_YAW_DELTA = Math.PI * 0.25;
/** Rate error, past the tolerance, at which W or S ticks are fully the loss color */
const FULL_COLOR_ERROR = 0.5;
/** Newton steps for the W turn cubic, starting from the small-k root cos^2 = 2/3 */
const CUBIC_STEPS = 6;

/**
 * Velocity turn per tick, in radians, for holding a wish angle. pinned is the turn the ticks follow. A/D also has the
 * turns between its speed ranges: gaining speed up to pinned (max gain), still gaining up to noLoss, then losing
 * speed while turning up to maxTurn.
 */
interface TurnRates {
	pinned: number;
	noLoss?: number;
	maxTurn?: number;
	/** W or S only: angle of the wish direction from the velocity that gives the pinned turn, for the arrow */
	wishOffset?: number;
}

let TICK_CLASS: StyleObject;

/**
 * Turnt-meter: shows whether the view turns at the optimal rate where the optimal strafe angle moves every tick
 * (CPM air control with W or S alone, and A or D alone). A row of ticks is pinned to the view a reference turn would
 * have (the air control cubic root for W or S, the max speed gain angle for A/D), so they stand still at that rate
 * and drift left or right as fast as the rate is off.
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
		let bRelevant =
			this.turntEnable &&
			state.physicsMode === DefragAPI.DefragPhysics.CPM &&
			state.falling &&
			(inputMode === InputMode.AIR_CONTROL || bTurn) &&
			state.speed >= this.turntMinSpeed &&
			frameTime > 0;

		// the physics values only change with the gamemode, but the panel can outlive a gamemode change
		if (bRelevant && !this.bWasRelevant) this.physics = $.GetContextPanel<MomHudDFTurnt>().GetTurntPhysics();

		const rates = bRelevant ? (bTurn ? this.findStrafeTurnRates(state) : this.findAirControlRates(state)) : null;
		bRelevant = bRelevant && rates !== null;

		const fadeStep = this.turntFadeTime > 0 ? frameTime / this.turntFadeTime : 1;
		this.alpha = Math.min(Math.max(this.alpha + (bRelevant ? fadeStep : -fadeStep), 0), 1);

		if (bRelevant) {
			// the velocity turns toward the wish direction
			const wishFromVel = MomMath.remapAngle(state.wishAngle - state.velAngle);
			if (Math.abs(wishFromVel) > 0.01 && Math.abs(wishFromVel) < Math.PI - 0.01)
				this.turnSign = Math.sign(wishFromVel);

			// ticks are pinned to the view the reference turn would have, so they move by however much this frame missed it
			const ticksPerFrame = frameTime / state.tickInterval;
			this.phase = this.wrapToSpacing(this.phase + yawDelta - this.turnSign * rates.pinned * ticksPerFrame);

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
	 * A/D tick color, a synchronizer gradient over the speed ranges: slow to good while turning slower than the max
	 * gain rate, perfect at it, fading to neutral at the no-loss rate, to loss at the max turn rate and to stop past it.
	 */
	findStrafeTurnColor(): color {
		const turn = this.turnRate;
		const { pinned: maxGain, noLoss, maxTurn } = this.rates;
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

	/**
	 * A or D alone: the strafe accel always adds its full amount past the max gain angle, so each range edge is closed
	 * form. Max gain sits where the accel stops being clipped, cos = (wishspeed - accel) / speed, no loss where the
	 * speed is unchanged, cos = -accel / (2 speed), and max turn where the added velocity is tangent to the new one,
	 * cos = -accel / speed.
	 */
	findStrafeTurnRates(state: DefragAPI.HUDFrameState): TurnRates | null {
		const speed = state.speed;
		const wishSpeed = MomMath.magnitude2D(state.wishVel);
		const accel = this.physics.airStrafeAccelerate * wishSpeed * state.tickInterval;
		if (!(speed > accel) || !(accel > 0)) return null;

		const turnAt = (cos: number) => {
			const sin = Math.sqrt(1 - cos * cos);
			return Math.atan2(accel * sin, speed + accel * cos);
		};

		return {
			pinned: turnAt(Math.min((wishSpeed - accel) / speed, 1)),
			noLoss: turnAt(-accel / (2 * speed)),
			maxTurn: turnAt(-accel / speed)
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
