import { PanelHandler } from 'util/module-helpers';
import { magnitude2D } from 'util/math';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategories, GamemodeCategory } from 'common/web_dontmodifyme';

enum TimerFlags {
	NONE = 0,
	LANDING = 1 << 0,
	KNOCKBACK = 1 << 1,
	WATERJUMP = 1 << 2
}

enum ColorClass {
	FRICTION = 'groundboost__meter--friction',
	SLICK = 'groundboost__meter--slick',
	CRASH = 'groundboost__meter--crash'
}

enum LabelClass {
	GAIN = 'groundboost__label--gain',
	FLAT = 'groundboost__label--flat',
	LOSS = 'groundboost__label--loss',
	HIDE = 'groundboost__label--hide'
}

const MAX_TIMER_MS = 250;
const MS_2_DEG = 360 / MAX_TIMER_MS;
const IDEAL_END_MS = 40; // 5 ticks

@PanelHandler()
class GroundboostHandler {
	readonly panels = {
		container: $<Panel>('#GroundboostContainer'),
		groundboostMeter: $<Panel>('#GroundboostMeter'),
		groundboostLabel: $<Label>('#GroundboostLabel')
	};

	visible: boolean;
	overshootEnable: boolean;
	crashHlEnable: boolean;
	colorClass: ColorClass;
	labelClass: LabelClass;
	missedJumpTimer = 0;
	peakSpeed = 0;
	startSpeed = 0;
	textMode: number;
	textColorMode: number;

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			onLoad: () => this.onMapInit(),
			events: [{ event: 'OnDefragHUDGroundboostChange', callback: () => this.onConfigChange() }],
			handledEvents: [
				{ event: 'HudProcessInput', panel: $.GetContextPanel(), callback: () => this.onHudUpdate() }
			]
		});
	}

	onMapInit() {
		this.onConfigChange();

		this.colorClass = ColorClass.SLICK;
		this.panels.groundboostMeter.AddClass(this.colorClass);

		this.labelClass = LabelClass.FLAT;

		this.panels.container.AddClass('groundboost__container--hide');
		this.visible = false;
		this.missedJumpTimer = 0;
		this.peakSpeed = 0;
		this.startSpeed = 0;
	}

	onHudUpdate() {
		const lastMoveData = MomentumMovementAPI.GetLastMoveData();
		let timer = lastMoveData.defragTimer;
		const timerFlags = lastMoveData.defragTimerFlags;
		const curTime = MomentumMovementAPI.GetCurrentTime();
		const speed = magnitude2D(MomentumPlayerAPI.GetVelocity());
		const deltaSpeed = speed - this.startSpeed;
		let bUpdateMeter = false;

		// Only toggle visibility on if the player is grounded
		if (lastMoveData.moveStatus === MomentumMovementAPI.PlayerMoveStatus.WALK) {
			if (timerFlags & TimerFlags.KNOCKBACK) {
				// Knockback is what causes no-friction condition
				// Crashland extends the timer to max duration
				if (!this.visible) {
					this.startGB((timerFlags & TimerFlags.LANDING) !== 0);
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
				const fill = +Math.min(timer * MS_2_DEG, 360).toFixed(2) - 360;
				const start = this.missedJumpTimer ? -fill : 0;
				this.panels.groundboostMeter.style.clip = `radial(50% 50%, ${start}deg, ${fill}deg)`;

				this.peakSpeed = Math.max(speed, this.peakSpeed);
				this.updateTextColor(speed, timer);
				this.panels.groundboostLabel.text =
					this.textMode === 2 ? Number(deltaSpeed).toFixed(0) : this.missedJumpTimer ? -timer : timer;
			}
		} else if (this.visible && !(timerFlags & TimerFlags.KNOCKBACK)) {
			// Player no longer grounded, freeze meter and fade out
			this.fadeOut();
		}
	}

	startGB(bCrashLand: boolean) {
		this.visible = true;
		this.startSpeed = magnitude2D(MomentumPlayerAPI.GetVelocity());
		this.peakSpeed = this.startSpeed;
		this.missedJumpTimer = 0;
		this.panels.container.RemoveClass('groundboost__container--hide');
		this.setMeterColor(this.crashHlEnable && !bCrashLand ? ColorClass.SLICK : ColorClass.CRASH);
		this.setTextColor(this.textColorMode === 2 ? LabelClass.GAIN : LabelClass.FLAT);
	}

	setMeterColor(color: ColorClass) {
		if (this.colorClass === color) return;

		this.panels.groundboostMeter.RemoveClass(this.colorClass);
		this.colorClass = color;
		this.panels.groundboostMeter.AddClass(this.colorClass);
	}

	updateTextColor(speed: number, timer: number) {
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

	setTextColor(color: LabelClass) {
		if (!this.textMode || !this.textColorMode || this.labelClass === color) return;

		this.panels.groundboostLabel.RemoveClass(this.labelClass);
		this.labelClass = color;
		this.panels.groundboostLabel.AddClass(this.labelClass);
	}

	fadeOut() {
		this.panels.container.AddClass('groundboost__container--hide');
		this.visible = false;
	}

	onConfigChange() {
		const groundboostConfig = DefragAPI.GetHUDGroundboostCFG();
		this.overshootEnable = groundboostConfig.overshootEnable;
		this.textMode = groundboostConfig.textMode;
		this.textColorMode = groundboostConfig.textColorMode;
		this.crashHlEnable = groundboostConfig.crashHlEnable;

		if (!this.textMode) {
			this.panels.groundboostLabel.AddClass(LabelClass.HIDE);
		} else {
			this.panels.groundboostLabel.RemoveClass(LabelClass.HIDE);
		}
	}
}
