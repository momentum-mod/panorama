const TimerFlags = {
	NONE: 0,
	LANDING: 1 << 0,
	KNOCKBACK: 1 << 1,
	WATERJUMP: 1 << 2
};

const ColorClass = {
	FRICTION: 'groundboost__meter--friction',
	SLICK: 'groundboost__meter--slick',
	CRASH: 'groundboost__meter--crash'
};

const LabelClass = {
	GAIN: 'groundboost__label--gain',
	FLAT: 'groundboost__label--flat',
	LOSS: 'groundboost__label--loss',
	HIDE: 'groundboost__label--hide'
};

const MAX_TIMER_MS = 250;
const MS_2_DEG = 360 / MAX_TIMER_MS;
const IDEAL_END_MS = 40; // 5 ticks

class Groundboost {
	/** @type {Panel} @static */
	static groundboostMeter = $('#GroundboostMeter');
	/** @type {Label} @static */
	static groundboostLabel = $('#GroundboostLabel');
	/** @type {Panel} @static */
	static container = $('#GroundboostContainer');

	static onLoad() {
		this.onConfigChange();

		this.colorClass = ColorClass.SLICK;
		this.groundboostMeter.AddClass(this.colorClass);

		this.labelClass = LabelClass.FLAT;

		this.container.AddClass('groundboost__container--hide');
		this.visible = false;
		this.missedJumpTimer = 0;
		this.peakSpeed = 0;
		this.startSpeed = 0;
	}

	static onUpdate() {
		const lastMoveData = MomentumMovementAPI.GetLastMoveData();
		let timer = lastMoveData.defragTimer;
		const timerFlags = lastMoveData.defragTimerFlags;
		const curTime = MomentumMovementAPI.GetCurrentTime();
		const speed = this.getSize(MomentumPlayerAPI.GetVelocity());
		const deltaSpeed = speed - this.startSpeed;
		let bUpdateMeter = false;

		// Only toggle visibility on if the player is grounded
		if (lastMoveData.moveStatus === 1) {
			if (timerFlags & TimerFlags.KNOCKBACK) {
				// Knockback is what causes no-friction condition
				// Crashland extends the timer to max duration
				if (!this.visible) {
					this.startGB(timerFlags & TimerFlags.LANDING);
				}
				bUpdateMeter = true;
			} else if (this.visible) {
				bUpdateMeter = true;
				if (this.overshootEnable) {
					// Player is grounded and no longer has the friction flag
					if (this.missedJumpTimer === 0) {
						this.missedJumpTimer = curTime;
						this.setMeterColor(ColorClass.FRICTION);
					}
					timer = Math.min(MAX_TIMER_MS, Math.round(1000 * (curTime - this.missedJumpTimer)));
					if (timer === MAX_TIMER_MS) this.fadeOut();
				} else if (!timer) {
					this.fadeOut();
				}
			}
			if (bUpdateMeter) {
				const fill = Math.min(timer * MS_2_DEG, 360).toFixed(2) - 360;
				const start = this.missedJumpTimer ? -fill : 0;
				this.groundboostMeter.style.clip = `radial(50% 50%, ${start}deg, ${fill}deg)`;

				this.peakSpeed = Math.max(speed, this.peakSpeed);
				this.updateTextColor(speed, timer);
				this.groundboostLabel.text =
					this.textMode === 2 ? Number(deltaSpeed).toFixed(0) : this.missedJumpTimer ? -timer : timer;
			}
		} else if (this.visible && !(timerFlags & TimerFlags.KNOCKBACK)) {
			// Player no longer grounded, freeze meter and fade out
			this.fadeOut();
		}
	}

	static startGB(bCrashLand) {
		this.visible = true;
		this.startSpeed = this.getSize(MomentumPlayerAPI.GetVelocity());
		this.peakSpeed = this.startSpeed;
		this.missedJumpTimer = 0;
		this.container.RemoveClass('groundboost__container--hide');
		this.setMeterColor(this.crashHlEnable && !bCrashLand ? ColorClass.SLICK : ColorClass.CRASH);
		this.setTextColor(this.textColorMode === 2 ? LabelClass.GAIN : LabelClass.FLAT);
	}

	static setMeterColor(color) {
		if (this.colorClass === color) return;

		this.groundboostMeter.RemoveClass(this.colorClass);
		this.colorClass = color;
		this.groundboostMeter.AddClass(this.colorClass);
	}

	static updateTextColor(speed, timer) {
		if (!this.textMode || !this.textColorMode) return;

		switch (this.textColorMode) {
			case 1:
				if (!this.missedJumpTimer) {
					this.setTextColor(timer <= IDEAL_END_MS ? LabelClass.GAIN : LabelClass.FLAT);
				} else {
					this.setTextColor(LabelClass.LOSS);
				}
				break;
			case 2:
				if (speed < this.peakSpeed && speed >= this.startSpeed) {
					this.setTextColor(LabelClass.FLAT);
				} else if (speed < this.startSpeed) {
					this.setTextColor(LabelClass.LOSS);
				}
				break;
			case 0:
			default:
				this.setTextColor(LabelClass.FLAT);
				break;
		}
	}

	static setTextColor(color) {
		if (!this.textMode || !this.textColorMode || this.labelClass === color) return;

		this.groundboostLabel.RemoveClass(this.labelClass);
		this.labelClass = color;
		this.groundboostLabel.AddClass(this.labelClass);
	}

	static fadeOut() {
		this.container.AddClass('groundboost__container--hide');
		this.visible = false;
	}

	static getSize(vec) {
		return Math.sqrt(this.getSizeSquared(vec));
	}

	static getSizeSquared(vec) {
		return vec.x * vec.x + vec.y * vec.y;
	}

	static onConfigChange() {
		const groundboostConfig = DefragAPI.GetHUDGroundboostCFG();
		this.overshootEnable = groundboostConfig.overshootEnable;
		this.textMode = groundboostConfig.textMode;
		this.textColorMode = groundboostConfig.textColorMode;
		this.crashHlEnable = groundboostConfig.crashHlEnable;

		if (!this.textMode) {
			this.groundboostLabel.AddClass(LabelClass.HIDE);
		} else {
			this.groundboostLabel.RemoveClass(LabelClass.HIDE);
		}
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));
		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
		$.RegisterForUnhandledEvent('OnDefragHUDGroundboostChange', this.onConfigChange.bind(this));
	}
}
