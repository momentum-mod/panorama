'use strict';

const TimerFlags = {
	NONE: 0,
	LANDING: 1 << 0,
	KNOCKBACK: 1 << 1,
	WATERJUMP: 1 << 2
};

const ColorClass = {
	FRICTION: 'groundboost__meter--friction',
	SLICK: 'groundboost__meter--slick'
};

const MAX_TIMER_MS = 250;
const MS_2_DEG = 360 / MAX_TIMER_MS;

class Groundboost {
	/** @type {Panel} @static */
	static groundboostMeter = $('#GroundboostMeter');
	/** @type {Label} @static */
	static groundboostTime = $('#GroundboostTime');
	/** @type {Panel} @static */
	static container = $('#GroundboostContainer');

	static onLoad() {
		this.colorClass = ColorClass.FRICTION;
		this.groundboostMeter.AddClass(this.colorClass);

		this.container.AddClass('groundboost__container--hide');
		this.visible = false;
		this.missedJumpTimer = 0;
	}

	static onUpdate() {
		const lastMoveData = MomentumMovementAPI.GetLastMoveData();
		const timer = lastMoveData.defragTimer;
		const timerFlags = lastMoveData.defragTimerFlags;
		const curTime = MomentumMovementAPI.GetCurrentTime();

		// Only toggle visibility on if the player is grounded
		if (lastMoveData.moveStatus === 1) {
			if (timerFlags & TimerFlags.KNOCKBACK) {
				// Knockback is what causes no-friction condition
				this.setColor(ColorClass.SLICK);
				const fill = Math.min(timer * MS_2_DEG, 360).toFixed(2) - 360;

				this.missedJumpTimer = 0;
				this.groundboostTime.text = timer;
				this.groundboostMeter.style.clip = `radial(50% 50%, 0deg, ${fill}deg)`;

				if (!this.visible) {
					this.container.RemoveClass('groundboost__container--hide');
					this.visible = true;
				}
			} else if (this.visible) {
				// Player is grounded and no longer has the friction flag
				if (this.missedJumpTimer === 0) {
					this.missedJumpTimer = curTime;
					this.setColor(ColorClass.FRICTION);
				}

				const val = Math.min(MAX_TIMER_MS, Math.round(1000 * (curTime - this.missedJumpTimer)));
				const fill = Math.min(val * MS_2_DEG, 360).toFixed(2) - 360;

				this.groundboostTime.text = val;
				this.groundboostMeter.style.clip = `radial(50% 50%, ${-fill}deg, ${fill}deg)`;
				if (val === MAX_TIMER_MS) this.fadeOut();
			}
		} else if (this.visible && !(timerFlags & TimerFlags.KNOCKBACK)) {
			// Player no longer grounded, freeze meter and fade out
			this.fadeOut();
		}
	}

	static setColor(color) {
		if (this.colorClass === color) return;

		this.groundboostMeter.RemoveClass(this.colorClass);
		this.colorClass = color;
		this.groundboostMeter.AddClass(this.colorClass);
	}

	static fadeOut() {
		this.container.AddClass('groundboost__container--hide');
		this.visible = false;
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));
		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
	}
}
