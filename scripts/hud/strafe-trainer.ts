import { PanelHandler } from 'util/module-helpers';
import * as MomMath from 'util/math';
import { rgbaStringLerp } from 'util/colors';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';
import { Gamemode, GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

const Colors = {
	EXTRA: ['rgba(24, 150, 211, 1)', 'rgba(87, 200, 255, 1)'],
	PERFECT: ['rgba(87, 200, 255, 1)', 'rgba(113, 240, 255, 1)'],
	GOOD: ['rgba(21, 152, 86, 1)', 'rgba(122, 238, 122, 1)'],
	SLOW: ['rgba(248, 222, 74, 1)', 'rgba(255, 238, 0, 1)'],
	NEUTRAL: ['rgba(178, 178, 178, 1)', 'rgba(255, 255, 255, 1)'],
	LOSS: ['rgba(220, 116, 13, 1)', 'rgba(255, 188, 0, 1)'],
	STOP: ['rgba(211, 24, 24, 1)', 'rgba(255, 87, 87, 1)']
} satisfies Record<string, [color, color]>;

const DEFAULT_BUFFER_LENGTH = 10;
const DEFAULT_MIN_SPEED = 200;
const DEFAULT_SETTING_ON = 1;
const DEFAULT_SETTING_OFF = 0;

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = 1 / RAD2DEG;

enum DisplayMode {
	HALF_WIDTH_THROTTLE,
	FULL_WIDTH_THROTTLE,
	STRAFE_INDICATOR,
	SYNCHRONIZER
}

enum StatMode {
	OFF,
	ON,
	HIDE_BAR
}

@PanelHandler()
class StrafeTrainer {
	readonly panels = {
		wrapper: $('#BarWrapper'),
		segments: [$('#Segment0'), $('#Segment1'), $('#Segment2'), $('#Segment3'), $('#Segment4')],
		container: $('#Container'),
		needle: $('#Needle'),
		stats: [$<Label>('#StatsUpper'), $<Label>('#StatsLower')]
	};

	//Customizable
	displayMode: DisplayMode;
	indicatorPercentage = 90; // this value shows ~90% gain or better when strafe indicator touches needle
	syncGain = 10; // scale how fast the bars move
	colorByGainEnable: boolean;
	dynamicEnable: boolean;
	flipEnable: boolean;
	interpFrames: number;
	minSpeed: number;
	showJumpCount: boolean;
	showTakeoffSpeed: boolean;
	showYawRatio: boolean;
	showGain: boolean;
	statColorEnable: boolean;
	//If this doesn't have a color assigned by default the game breaks
	//It immediately gets overridden by hud/hud_default.kv3 anyway
	//Can't figure it out
	altColor = 'rgba(0,0,0,0)' as color;

	//Not yet customizable
	isFirstPanelColored = true; // gets toggled in wrapValueToRange()
	maxSegmentWidth = 25; // percentage of total element width
	firstPanelWidth = this.maxSegmentWidth;

	sampleWeight: number;
	gainRatioHistory: number[];
	yawRatioHistory: number[];

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: [
				Gamemode.SURF,
				Gamemode.BHOP,
				Gamemode.BHOP_HL1,
				Gamemode.CLIMB_MOM,
				Gamemode.CLIMB_KZT,
				Gamemode.CLIMB_16
			],
			events: [{ event: 'OnJumpStarted', callback: () => this.updateStats() }],
			handledEvents: [{ event: 'HudProcessInput', panel: $.GetContextPanel(), callback: () => this.onUpdate() }]
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			//TODO: Add resizing width, it needs to target a specific panel, not the root
			resizeX: true,
			resizeY: false,
			gamemode: [
				Gamemode.SURF,
				Gamemode.BHOP,
				Gamemode.BHOP_HL1,
				...GamemodeCategoryToGamemode.get(GamemodeCategory.CLIMB)
			],
			expectedMinWidth: 300,
			//TODO: Add generic border, font settings
			//TODO: Add options to edit all the colors in the colors const. They need to be expandable or they will take way too much space
			dynamicStyles: {
				//TODO: Use proper CustomizerPropertyType when available
				displayMode: {
					name: 'Display Mode',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.updateDisplayMode(value);
					},
					settingProps: { min: 0, max: 3 }
				},
				//TODO: ONLY SHOW WHEN DISPLAY MODE = 2
				indicatorPercentage: {
					name: 'Indicator Gain Percentage',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.indicatorPercentage = value;
						this.updateDisplayMode(this.displayMode);
					},
					settingProps: { min: 80, max: 99 }
				},
				//TODO: ONLY SHOW WHEN DISPLAY MODE = 3
				synchronizerSpeed: {
					name: 'Synchronizer Speed',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.syncGain = value;
					},
					settingProps: { min: 1, max: 20 }
				},
				colorByGain: {
					name: 'Color By Speed Gain',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.colorByGainEnable = value;
					}
				},
				dynamicMode: {
					name: 'Follow Strafe Direction',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.dynamicEnable = value;
					}
				},
				flipDirections: {
					name: 'Flip Directions',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.flipEnable = value;
					}
				},
				averagingWindow: {
					name: 'Averaging Window',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.updateBufferLength(value);
					},
					settingProps: { min: 1, max: 20 }
				},
				//TODO: Use slider when implemented?
				minSpeed: {
					name: 'Minimum required speed',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.minSpeed = value;
					},
					settingProps: { min: 30, max: 250 }
				},
				//TODO: Put everything below into an expandable menu option when that's available
				showJumpCount: {
					name: 'Show Jump Count',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.showJumpCount = value;
						this.updateStats();
					}
				},
				showTakeoffSpeed: {
					name: 'Show Take Off Speed',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.showTakeoffSpeed = value;
						this.updateStats();
					}
				},
				showYawRatio: {
					name: 'Show Yaw Ratio',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.showYawRatio = value;
						this.updateStats();
					}
				},
				showGain: {
					name: 'Show Gain',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.showGain = value;
						this.updateStats();
					}
				},
				//Todo: Don't show if stats are enabled
				colorStats: {
					name: 'Color Stats Based On Gain',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.statColorEnable = value;
						this.updateStats();
					}
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						this.altColor = value as color;
						this.updateDisplayMode(this.displayMode);
					}
				},
				needleColor: {
					name: 'Needle Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.strafetrainer__needle',
					styleProperty: 'backgroundColor'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['.strafetrainer__stats--upper', '.strafetrainer__stats--lower'],
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 10, max: 20 }
				}
			}
		});
	}

	onUpdate() {
		const hudData = MomentumMovementAPI.GetMoveHudData();
		const lastTickStats = MomentumMovementAPI.GetLastTickStats();

		//zero buffers
		this.addToBuffer(this.gainRatioHistory, 0);
		this.addToBuffer(this.yawRatioHistory, 0);

		const bValidWishMove = MomMath.magnitude2D(hudData.wishVel) > 0.1;
		const strafeRight = (bValidWishMove ? 1 : 0) * lastTickStats.strafeRight;
		const direction = this.dynamicEnable ? strafeRight : 1;
		const flip = this.flipEnable ? -1 : 1;

		if (bValidWishMove && MomMath.sumOfSquares2D(MomentumPlayerAPI.GetVelocity()) > Math.pow(this.minSpeed, 2)) {
			this.gainRatioHistory[this.interpFrames - 1] =
				this.sampleWeight * this.NaNCheck(lastTickStats.speedGain / lastTickStats.idealGain, 0);

			const ratio = this.displayMode > 1 ? 1 - lastTickStats.yawRatio : lastTickStats.yawRatio;
			this.yawRatioHistory[this.interpFrames - 1] = this.sampleWeight * this.NaNCheck(ratio, 0);
		}

		const gainRatio = this.getBufferedSum(this.gainRatioHistory);
		const yawRatio = this.getBufferedSum(this.yawRatioHistory);

		const colorTuple = this.colorByGainEnable
			? this.getColorPair(gainRatio, false) //strafeRight * yawRatio > 1)
			: Colors.NEUTRAL;
		const color = `gradient(linear, 0% 0%, 0% 100%, from(${colorTuple[0]}), to(${colorTuple[1]}))` as color;
		let flow;

		switch (this.displayMode) {
			case DisplayMode.HALF_WIDTH_THROTTLE:
				flow = direction * flip;
				this.panels.container.style.flowChildren = flow < 0 ? 'left' : 'right';
				this.panels.segments[0].style.backgroundColor = color;
				this.panels.segments[0].style.width = (yawRatio * 50).toFixed(3) + '%';
				break;
			case DisplayMode.FULL_WIDTH_THROTTLE: {
				const absRatio = Math.abs(gainRatio);
				flow = direction * (yawRatio > 1 ? -1 : 1) * flip;
				this.panels.container.style.flowChildren = flow < 0 ? 'left' : 'right';
				this.panels.segments[0].style.backgroundColor = color;
				this.panels.segments[0].style.width = (absRatio * 100).toFixed(3) + '%';
				break;
			}
			case DisplayMode.STRAFE_INDICATOR: {
				this.panels.container.style.flowChildren = flip < 0 ? 'left' : 'right';
				//const offset = Math.min(Math.max(0.5 - (0.5 * direction * syncDelta) / idealDelta, 0), 1);
				const offset = Math.min(Math.max(0.5 - 0.5 * direction * yawRatio, 0), 1);
				this.panels.segments[0].style.width = (offset * this.indicatorPercentage).toFixed(3) + '%';
				this.panels.segments[1].style.backgroundColor = color;
				break;
			}
			case DisplayMode.SYNCHRONIZER:
				this.panels.container.style.flowChildren = flip < 0 ? 'left' : 'right';
				this.firstPanelWidth += this.syncGain * direction * yawRatio * lastTickStats.idealGain;
				this.firstPanelWidth = this.wrapValueToRange(this.firstPanelWidth, 0, this.maxSegmentWidth, true);
				this.panels.segments[0].style.width =
					this.NaNCheck(this.firstPanelWidth.toFixed(3), this.maxSegmentWidth) + '%';
				for (const [i, segment] of this.panels.segments.entries()) {
					const index = i + (this.isFirstPanelColored ? 1 : 0);
					segment.style.backgroundColor = index % 2 ? color : this.altColor;
				}
				break;
		}
	}

	//Happens onJump and whenever any setting related to stats is changed
	updateStats() {
		const lastJumpStats = MomentumMovementAPI.GetLastJumpStats();
		const statsTopText = [];
		if (this.showJumpCount) {
			const colon = this.showTakeoffSpeed || this.showYawRatio ? ': ' : '';
			statsTopText.push(`${lastJumpStats.jumpCount}${colon}`);
		}

		if (this.showTakeoffSpeed) {
			const takeoffSpeed = `${lastJumpStats.takeoffSpeed.toFixed(0)}`;
			statsTopText.push(this.showJumpCount ? takeoffSpeed.padStart(5, ' ') : takeoffSpeed);
		}

		if (this.showYawRatio) {
			const yaw = `${(lastJumpStats.yawRatio * 100).toFixed(2)}%`;
			statsTopText.push(this.showTakeoffSpeed ? `(${yaw})`.padStart(10, ' ') : yaw);
		}

		this.panels.stats[0].text = statsTopText.join(' ');
		this.panels.stats[1].text = this.showGain ? (lastJumpStats.speedGain * 100).toFixed(2) : ' ';

		const colorPair = this.statColorEnable
			? this.getColorPair(lastJumpStats.speedGain, lastJumpStats.yawRatio > 0)
			: Colors.NEUTRAL;
		for (const stat of this.panels.stats) {
			stat.style.color = colorPair[1];
		}
	}

	getColorPair(ratio: number, overStrafing: boolean) {
		// cases where gain effectiveness is >90%
		if (ratio > 1.02) return Colors.EXTRA;
		else if (ratio > 0.99) return Colors.PERFECT;
		else if (ratio > 0.95) return Colors.GOOD;
		else if (ratio <= -5) return Colors.STOP;

		const lerpColorPairs = (c1: [color, color], c2: [color, color], alpha: number) => {
			return [rgbaStringLerp(c1[0], c2[0], +alpha.toFixed(3)), rgbaStringLerp(c1[1], c2[1], +alpha.toFixed(3))];
		};

		// cases where gain effectiveness is <90%
		if (!overStrafing) {
			if (ratio > 0.85) return lerpColorPairs(Colors.SLOW, Colors.GOOD, (ratio - 0.85) / 0.1);
			else if (ratio > 0.75) return Colors.SLOW;
			else if (ratio > 0.5) return lerpColorPairs(Colors.NEUTRAL, Colors.SLOW, (ratio - 0.5) / 0.25);
			else if (ratio > 0) return Colors.NEUTRAL;
			else if (ratio > -5) return lerpColorPairs(Colors.NEUTRAL, Colors.STOP, Math.abs(ratio) / 5);
		} else {
			if (ratio > 0.8) return lerpColorPairs(Colors.SLOW, Colors.GOOD, (ratio - 0.8) / 0.15);
			else if (ratio > 0) return lerpColorPairs(Colors.LOSS, Colors.SLOW, (ratio - 0.25) / 0.55);
			else if (ratio > -5) return lerpColorPairs(Colors.LOSS, Colors.STOP, Math.abs(ratio) / 5);
		}
	}

	wrapValueToRange(value: number, min: number, max: number, bShouldTrackWrap: boolean) {
		const range = max - min;
		while (value > max) {
			value -= range;
			if (bShouldTrackWrap) {
				this.isFirstPanelColored = !this.isFirstPanelColored; // less than clean way to track color flips
			}
		}
		while (value < min) {
			value += range;
			if (bShouldTrackWrap) {
				this.isFirstPanelColored = !this.isFirstPanelColored;
			}
		}
		return value;
	}

	findFastAngle(speed: number, maxSpeed: number, maxAccel: number) {
		const threshold = maxSpeed - maxAccel;
		return Math.acos(speed < threshold ? 1 : threshold / speed);
	}

	initializeBuffer(size: number): number[] {
		return Array.from({ length: size }).fill(0) as number[];
	}

	addToBuffer(buffer: number[], value: number) {
		buffer.push(value);
		buffer.shift();
	}

	getBufferedSum(history: number[]) {
		return history.reduce((sum, element) => sum + element, 0);
	}

	updateDisplayMode(newMode: DisplayMode) {
		this.displayMode = newMode;
		switch (this.displayMode) {
			case DisplayMode.HALF_WIDTH_THROTTLE:
				for (const segment of this.panels.segments) {
					segment.style.backgroundColor = this.altColor;
				}
				this.panels.needle.style.visibility = 'visible';
				break;
			case DisplayMode.FULL_WIDTH_THROTTLE:
				for (const segment of this.panels.segments) {
					segment.style.backgroundColor = this.altColor;
				}
				this.panels.needle.style.visibility = 'collapse';
				break;
			case DisplayMode.STRAFE_INDICATOR:
				this.panels.segments[1].style.width = 100 - this.indicatorPercentage + '%';
				this.panels.segments[2].style.width = 50 + '%';
				this.panels.segments[3].style.width = 50 + '%';
				for (const segment of this.panels.segments) {
					segment.style.backgroundColor = this.altColor;
				}
				this.panels.needle.style.visibility = 'visible';
				break;
			case DisplayMode.SYNCHRONIZER:
				for (const segment of this.panels.segments) {
					segment.style.width = this.maxSegmentWidth + '%';
				}
				this.panels.needle.style.visibility = 'collapse';
				break;
		}
	}

	updateBufferLength(newBufferLength: float) {
		this.interpFrames = newBufferLength ?? DEFAULT_BUFFER_LENGTH;
		this.sampleWeight = 1 / this.interpFrames;

		this.gainRatioHistory = this.initializeBuffer(this.interpFrames);
		this.yawRatioHistory = this.initializeBuffer(this.interpFrames);
	}

	NaNCheck(val: any, def: any) {
		return Number.isNaN(Number(val)) ? def : val;
	}
}
