import { PanelHandler } from 'util/module-helpers';
import { magnitude2D } from 'util/math';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

enum TimerFlags {
	NONE = 0,
	LANDING = 1 << 0,
	KNOCKBACK = 1 << 1,
	WATERJUMP = 1 << 2
}

//Defaults should be set in /config/hud_defaults.kv3
const MeterColor = {
	FRICTION: 'rgba(255, 106, 106, 1)',
	NO_CRASH: 'rgba(255, 255, 255, 1)',
	SLICK: 'rgba(16, 118, 168, 1)'
};

//Defaults should be set in /config/hud_defaults.kv3
const LabelColor = {
	GAIN: 'rgba(16, 118, 168, 1)',
	FLAT: 'rgba(255, 255, 255, 1)',
	LOSS: 'rgba(255, 106, 106, 1)'
};

enum LabelMode {
	HIDE = 'hide',
	TIME = 'time',
	SPEED = 'speed'
}

type GroundboostConfig = {
	showFrictionTime: boolean;
	showNoCrashHighlight: boolean;
	labelTextMode: LabelMode;
	labelColorMode: LabelMode;
	idealEndMs: int32;
};

const MAX_TIMER_MS = 250;
const MS_2_DEG = 360 / MAX_TIMER_MS;

@PanelHandler()
class GroundboostHandler {
	readonly panels = {
		container: $<Panel>('#GroundboostContainer'),
		groundboostBackground: $<Image>('#GroundboostBackground'),
		groundboostMeter: $<Image>('#GroundboostMeter'),
		groundboostLabel: $<Label>('#GroundboostLabel')
	};

	config = {} as GroundboostConfig;

	visible: boolean;
	missedJumpTimer = 0;
	peakSpeed = 0;
	startSpeed = 0;
	dummyGB = false;
	dummyGBColors = {
		meterColor: MeterColor.SLICK,
		labelColor: LabelColor.GAIN
	};

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			onLoad: () => this.onMapInit(),
			handledEvents: [
				{ event: 'HudProcessInput', panel: $.GetContextPanel(), callback: () => this.onHudUpdate() }
			]
		});

		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => {
			this.dummyGB = true;
			this.dummyGBColors = {
				meterColor: MeterColor.SLICK,
				labelColor: LabelColor.GAIN
			};

			this.startDummyGB();
		});

		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => {
			this.dummyGB = false;
			this.fadeOut();
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			dynamicStyles: {
				//As of writing this there is no way to re-rasterize an svg as the textureheight needs to be set on panel creation
				//There should be some way to rerasterize an image added to panorama, perhaps it should even happen automatically when textureheight is changed
				//Blame @GordiNoki for this awful code

				//TODO: For whatever reason the panel is white after resizing and needs to be moved to regain proper color
				size: {
					name: 'Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.panels.container.RemoveAndDeleteChildren();

						this.panels.groundboostBackground = $.CreatePanel(
							'Image',
							this.panels.container,
							'GroundboostBackground',
							{
								textureheight: value,
								class: 'groundboost__background-meter'
							}
						);

						this.panels.groundboostBackground.SetImage('file://{images}/hud/meter-ring.svg');

						this.panels.groundboostMeter = $.CreatePanel(
							'Image',
							this.panels.container,
							'GroundboostMeter',
							{
								textureheight: value,
								class: 'groundboost__meter'
							}
						);

						this.panels.groundboostMeter.SetImage('file://{images}/hud/meter-ring.svg');

						this.panels.groundboostLabel = $.CreatePanel(
							'Label',
							this.panels.container,
							'GroundboostLabel',
							{
								class: 'groundboost__label'
							}
						);

						this.panels.container.style.width = `${value}px`;
						this.panels.container.style.height = `${value}px`;

						this.startDummyGB();
					}
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.groundboost__label',
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.groundboost__label',
					styleProperty: 'fontSize'
				},
				showFrictionTime: {
					name: 'Show Friction Time',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.config.showFrictionTime = value;
					}
				},
				noCrashHighlight: {
					name: 'Highlight lack of crash landing',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.config.showNoCrashHighlight = value;
						if (this.config.showNoCrashHighlight) this.dummyGBColors.meterColor = MeterColor.NO_CRASH;
						if (!this.config.showNoCrashHighlight) this.dummyGBColors.meterColor = MeterColor.SLICK;
						this.startDummyGB();
					}
				},
				labelTextMode: {
					name: 'Label Mode',
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'Hide', value: LabelMode.HIDE },
						{ label: 'Remaining Time', value: LabelMode.TIME },
						{ label: 'Speed Gain', value: LabelMode.SPEED }
					],
					callbackFunc: (_, value) => {
						this.config.labelTextMode = value as LabelMode;
						if (this.config.labelTextMode === LabelMode.HIDE)
							this.panels.groundboostLabel.style.visibility = 'collapse';
						else this.panels.groundboostLabel.style.visibility = 'visible';
					}
				},
				labelColorMode: {
					name: 'Label Color Mode',
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'No Coloring', value: LabelMode.HIDE },
						{ label: 'Remaining Time', value: LabelMode.TIME },
						{ label: 'Speed Gain', value: LabelMode.SPEED }
					],
					callbackFunc: (_, value) => {
						this.config.labelColorMode = value as LabelMode;
					}
				},
				//TODO: Make this a child of labelColorMode and only show when it's LabelMode.TIME
				idealTimeRemaining: {
					name: 'Ticks Left For Ideal End',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.config.idealEndMs = value * 8;
					},
					settingProps: { min: 1, max: 31 }
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.groundboost__background-meter',
					callbackFunc: (panel, value) => {
						const splitRGBA = this.splitRgbFromAlpha(value);
						panel.style.washColor = splitRGBA[0];
						panel.style.opacity = splitRGBA[1];
					}
				},
				meterSlickColor: {
					name: 'Meter Slick Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						MeterColor.SLICK = value;
						this.dummyGBColors.meterColor = MeterColor.SLICK;
						this.startDummyGB();
					}
				},
				meterFrictionColor: {
					name: 'Meter Friction Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						MeterColor.FRICTION = value;
						this.dummyGBColors.meterColor = MeterColor.FRICTION;
						this.startDummyGB();
					}
				},
				meterNoCrashHighlight: {
					name: 'Meter No Crash Landing Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						MeterColor.NO_CRASH = value;
						this.dummyGBColors.meterColor = MeterColor.NO_CRASH;
						this.startDummyGB();
					}
				},
				labelFlatColor: {
					name: 'Label Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						LabelColor.FLAT = value;
						this.dummyGBColors.labelColor = LabelColor.FLAT;
						this.startDummyGB();
					}
				},
				labelGainColor: {
					name: 'Label Gain Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						LabelColor.GAIN = value;
						this.dummyGBColors.labelColor = LabelColor.GAIN;
						this.startDummyGB();
					}
				},
				labelLossColor: {
					name: 'Label Loss Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						LabelColor.LOSS = value;
						this.dummyGBColors.labelColor = LabelColor.LOSS;
						this.startDummyGB();
					}
				}
			}
		});
	}

	onMapInit() {
		this.panels.groundboostMeter.style.washColor = MeterColor.NO_CRASH;

		this.panels.container.AddClass('groundboost__container--hide');
		this.visible = false;
		this.missedJumpTimer = 0;
		this.peakSpeed = 0;
		this.startSpeed = 0;
	}

	onHudUpdate() {
		if (this.dummyGB) return;

		const hudData = MomentumMovementAPI.GetMoveHudData();
		let timer = hudData.defragTimer;
		const timerFlags = hudData.defragTimerFlags;
		const curTime = MomentumMovementAPI.GetCurrentTime();
		const speed = magnitude2D(MomentumPlayerAPI.GetVelocity());
		const deltaSpeed = speed - this.startSpeed;
		let bUpdateMeter = false;

		// Only toggle visibility on if the player is grounded
		if (hudData.moveStatus === MomentumMovementAPI.PlayerMoveStatus.WALK) {
			if (timerFlags & TimerFlags.KNOCKBACK) {
				// Knockback is what causes no-friction condition
				// Crashland extends the timer to max duration
				if (!this.visible) {
					this.startGB((timerFlags & TimerFlags.LANDING) !== 0);
				}
				bUpdateMeter = true;
			} else if (this.visible) {
				bUpdateMeter = true;
				if (this.config.showFrictionTime) {
					// Player is grounded and no longer has the friction flag
					if (this.missedJumpTimer === 0) {
						this.missedJumpTimer = curTime;
						this.setMeterColor(MeterColor.FRICTION);
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
					this.config.labelTextMode === LabelMode.SPEED
						? Number(deltaSpeed).toFixed(0)
						: this.missedJumpTimer
							? -timer
							: timer;
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
		this.setMeterColor(this.config.showNoCrashHighlight && !bCrashLand ? MeterColor.NO_CRASH : MeterColor.SLICK);
		this.setTextColor(this.config.labelColorMode === LabelMode.SPEED ? LabelColor.GAIN : LabelColor.FLAT);
	}

	startDummyGB() {
		if (!this.dummyGB) return;
		this.startGB(false);

		this.setMeterColor(this.dummyGBColors.meterColor);
		this.setTextColor(this.dummyGBColors.labelColor);

		const randomFill = Math.floor(Math.random() * 180) + 90 - 360;
		const start = this.dummyGBColors.meterColor === MeterColor.FRICTION ? -randomFill : 0;

		let randomText = Math.floor(Math.random() * 100 + 50).toString();
		if (this.dummyGBColors.labelColor === LabelColor.LOSS) randomText = '-' + randomText;

		this.panels.groundboostMeter.style.clip = `radial(50% 50%, ${start}deg, ${randomFill}deg)`;
		this.panels.groundboostLabel.text = randomText;
	}

	setMeterColor(color: string) {
		const splitRGBA = this.splitRgbFromAlpha(color);
		this.panels.groundboostMeter.style.washColor = splitRGBA[0];
		this.panels.groundboostMeter.style.opacity = splitRGBA[1];
	}

	updateTextColor(speed: number, timer: number) {
		if (this.config.labelTextMode === LabelMode.HIDE || this.config.labelColorMode === LabelMode.HIDE) return;

		switch (this.config.labelColorMode) {
			case LabelMode.TIME:
				if (!this.missedJumpTimer) {
					this.setTextColor(timer <= this.config.idealEndMs ? LabelColor.GAIN : LabelColor.FLAT);
				} else {
					this.setTextColor(LabelColor.LOSS);
				}
				break;
			case LabelMode.SPEED:
				if (speed < this.peakSpeed && speed >= this.startSpeed) {
					this.setTextColor(LabelColor.FLAT);
				} else if (speed < this.startSpeed) {
					this.setTextColor(LabelColor.LOSS);
				}
				break;
			default:
				this.setTextColor(LabelColor.FLAT);
				break;
		}
	}

	setTextColor(color: string) {
		if (this.config.labelTextMode === LabelMode.HIDE || this.config.labelColorMode === LabelMode.HIDE) return;

		this.panels.groundboostLabel.style.color = color;
	}

	fadeOut() {
		this.panels.container.AddClass('groundboost__container--hide');
		this.visible = false;
	}

	splitRgbFromAlpha(rgbaString: string) {
		const values = rgbaString.match(/[\d.]+%?/g);
		return [`rgba(${values[0]}, ${values[1]}, ${values[2]}, 1)`, values[3]];
	}
}
