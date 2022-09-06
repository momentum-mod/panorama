'use strict';

const TimerFlags = {
	NONE: 0,
	LANDING: 1 << 0,
	KNOCKBACK: 1 << 1,
	WATERJUMP: 1 << 2
};

const ColorClass = {
	KB: 'groundboost__meter--knockback',
	GB: 'groundboost__meter--groundboost'
};

const MS_2_DEG = 360 / 250;

class Groundboost {
	/** @type {Panel} @static */
	static groundboostMeter = $('#GroundboostMeter');
	/** @type {Label} @static */
	static groundboostTime = $('#GroundboostTime');
	/** @type {Panel} @static */
	static container = $('#GroundboostContainer');

	static onLoad() {
		this.colorClass = ColorClass.KB;
		this.groundboostMeter.AddClass(this.colorClass);

		this.container.AddClass('groundboost__container--hide');
		this.visible = false;
	}

	static onUpdate() {
		const lastMoveData = MomentumMovementAPI.GetLastMoveData();
		const timer = lastMoveData.defragTimer;
		const timerFlags = lastMoveData.defragTimerFlags;
		const newColor = timerFlags & TimerFlags.LANDING ? ColorClass.GB : ColorClass.KB;

		//knockback is what causes no-friction condition, so only display meter when the player has this flag
		if (timerFlags & TimerFlags.KNOCKBACK) {
			this.groundboostTime.text = timer;

			const fill = Math.min(timer * MS_2_DEG, 360).toFixed(2) - 360;
			this.groundboostMeter.style.clip = `radial(50% 50%, 0deg, ${fill}deg)`;

			if (this.colorClass !== newColor) {
				this.groundboostMeter.RemoveClass(this.colorClass);
				this.colorClass = newColor;
				this.groundboostMeter.AddClass(this.colorClass);
			}

			if (!this.visible) {
				this.container.RemoveClass('groundboost__container--hide');
				this.visible = true;
			}
		} else if (this.visible) {
			this.groundboostTime.text = '';
			this.groundboostMeter.style.clip = 'radial(50% 50%, 0deg, 360deg)';
			this.container.AddClass('groundboost__container--hide');
			this.visible = false;
		}
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));
		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
	}
}
