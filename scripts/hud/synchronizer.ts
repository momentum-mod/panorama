import { PanelHandler } from 'util/module-helpers';
import * as MomMath from 'util/math';
import { rgbaStringLerp } from 'util/colors';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';
import { Gamemode } from '../common/web';

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
	DISABLED,
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
class Synchronizer {
	readonly panels = {
		wrapper: $('#BarWrapper'),
		segments: [$('#Segment0'), $('#Segment1'), $('#Segment2'), $('#Segment3'), $('#Segment4')],
		container: $('#Container'),
		needle: $('#Needle'),
		stats: [$<Label>('#StatsUpper'), $<Label>('#StatsLower')]
	};

	indicatorPercentage = 90; // this value shows ~90% gain or better when strafe indicator touches needle
	isFirstPanelColored = true; // gets toggled in wrapValueToRange()
	maxSegmentWidth = 25; // percentage of total element width
	firstPanelWidth = this.maxSegmentWidth;
	syncGain = 10; // scale how fast the bars move
	altColor = 'rgba(0, 0, 0, 0.0)';
	statMode: StatMode;
	displayMode: DisplayMode;
	colorEnable: boolean;
	dynamicEnable: boolean;
	statColorEnable: boolean;
	flipEnable: boolean;
	interpFrames: number;
	minSpeed: number;
	sampleWeight: number;
	gainRatioHistory: number[];
	yawRatioHistory: number[];

	initializeSettings() {
		this.setDisplayMode(GameInterfaceAPI.GetSettingInt('mom_hud_synchro_mode') as DisplayMode);
		this.setColorMode(GameInterfaceAPI.GetSettingBool('mom_hud_synchro_color_enable'));
		this.setDynamicMode(GameInterfaceAPI.GetSettingBool('mom_hud_synchro_dynamic_enable'));
		this.setDirection(GameInterfaceAPI.GetSettingBool('mom_hud_synchro_flip_enable'));
		this.setBufferLength(GameInterfaceAPI.GetSettingFloat('mom_hud_synchro_buffer_size'));
		this.setMinSpeed(GameInterfaceAPI.GetSettingFloat('mom_hud_synchro_min_speed'));
		this.setStatMode(GameInterfaceAPI.GetSettingInt('mom_hud_synchro_stat_mode'));
		this.setStatColorMode(GameInterfaceAPI.GetSettingBool('mom_hud_synchro_stat_color_enable'));
	}

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: [Gamemode.BHOP, Gamemode.SURF, Gamemode.CLIMB_KZT, Gamemode.CLIMB_MOM],
			onLoad: () => this.onLoad(),
			events: [
				{ event: 'HudProcessInput', callback: () => this.onUpdate() },
				{ event: 'OnJumpStarted', callback: () => this.onJump() },
				{ event: 'OnSynchroModeChanged', callback: (cvarValue) => this.setDisplayMode(cvarValue) },
				{ event: 'OnSynchroColorModeChanged', callback: (cvarValue) => this.setColorMode(cvarValue === 1) },
				{ event: 'OnSynchroDynamicModeChanged', callback: (cvarValue) => this.setDynamicMode(cvarValue === 1) },
				{ event: 'OnSynchroDirectionChanged', callback: (cvarValue) => this.setDirection(cvarValue === 1) },
				{ event: 'OnSynchroBufferChanged', callback: (cvarValue) => this.setBufferLength(cvarValue) },
				{ event: 'OnSynchroMinSpeedChanged', callback: (cvarValue) => this.setMinSpeed(cvarValue) },
				{ event: 'OnSynchroStatModeChanged', callback: (cvarValue) => this.setStatMode(cvarValue) },
				{
					event: 'OnSynchroStatColorModeChanged',
					callback: (cvarValue) => this.setStatColorMode(cvarValue === 1)
				}
			]
		});
	}

	onLoad() {
		this.initializeSettings();

		if (this.statMode) this.onJump(); // show stats if enabled
	}

	onUpdate() {
		const lastMoveData = MomentumMovementAPI.GetLastMoveData();
		const lastTickStats = MomentumMovementAPI.GetLastTickStats();

		//zero buffers
		this.addToBuffer(this.gainRatioHistory, 0);
		this.addToBuffer(this.yawRatioHistory, 0);

		const bValidWishMove = MomMath.magnitude2D(lastMoveData.wishdir) > 0.1;
		const strafeRight = (bValidWishMove ? 1 : 0) * lastTickStats.strafeRight;
		const direction = this.dynamicEnable ? strafeRight : 1;
		const flip = this.flipEnable ? -1 : 1;

		if (bValidWishMove && MomMath.sumOfSquares2D(MomentumPlayerAPI.GetVelocity()) > Math.pow(this.minSpeed, 2)) {
			this.gainRatioHistory[this.interpFrames - 1] =
				this.sampleWeight * this.NaNCheck(lastTickStats.speedGain / lastTickStats.idealGain, 0);

			const ratio = this.displayMode > 2 ? 1 - lastTickStats.yawRatio : lastTickStats.yawRatio;
			this.yawRatioHistory[this.interpFrames - 1] = this.sampleWeight * this.NaNCheck(ratio, 0);
		}

		const gainRatio = this.getBufferedSum(this.gainRatioHistory);
		const yawRatio = this.getBufferedSum(this.yawRatioHistory);

		const colorTuple = this.colorEnable
			? this.getColorPair(gainRatio, false) //strafeRight * yawRatio > 1)
			: Colors.NEUTRAL;
		const color = `gradient(linear, 0% 0%, 0% 100%, from(${colorTuple[0]}), to(${colorTuple[1]}))`;
		let flow;

		switch (this.displayMode) {
			case 1: // "Half-width throttle"
				flow = direction * flip;
				this.panels.container.style.flowChildren = flow < 0 ? 'left' : 'right';
				this.panels.segments[0].style.backgroundColor = color;
				this.panels.segments[0].style.width = (yawRatio * 50).toFixed(3) + '%';
				break;
			case 2: {
				// "Full-width throttle"
				const absRatio = Math.abs(gainRatio);
				flow = direction * (yawRatio > 1 ? -1 : 1) * flip;
				this.panels.container.style.flowChildren = flow < 0 ? 'left' : 'right';
				this.panels.segments[0].style.backgroundColor = color;
				this.panels.segments[0].style.width = (absRatio * 100).toFixed(3) + '%';
				break;
			}
			case 3: {
				// "Strafe indicator"
				this.panels.container.style.flowChildren = flip < 0 ? 'left' : 'right';
				//const offset = Math.min(Math.max(0.5 - (0.5 * direction * syncDelta) / idealDelta, 0), 1);
				const offset = Math.min(Math.max(0.5 - 0.5 * direction * yawRatio, 0), 1);
				this.panels.segments[0].style.width = (offset * this.indicatorPercentage).toFixed(3) + '%';
				this.panels.segments[1].style.backgroundColor = color;
				break;
			}
			case 4: // "Synchronizer"
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

	onJump() {
		const lastJumpStats = MomentumMovementAPI.GetLastJumpStats();
		this.panels.stats[0].text =
			`${lastJumpStats.jumpCount}: `.padStart(6, ' ') +
			`${lastJumpStats.takeoffSpeed.toFixed(0)} `.padStart(6, ' ') +
			`(${(lastJumpStats.yawRatio * 100).toFixed(2)}%)`.padStart(10, ' ');
		this.panels.stats[1].text = (lastJumpStats.speedGain * 100).toFixed(2);

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

	setDisplayMode(newMode: DisplayMode) {
		this.displayMode = newMode ?? DisplayMode.DISABLED;
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

	setColorMode(newColorMode: boolean) {
		this.colorEnable = newColorMode ?? false;
	}

	setDynamicMode(newDynamicMode: boolean) {
		this.dynamicEnable = newDynamicMode ?? false;
	}

	setDirection(newDirection: boolean) {
		this.flipEnable = newDirection ?? false;
	}

	setBufferLength(newBufferLength: float) {
		this.interpFrames = newBufferLength ?? DEFAULT_BUFFER_LENGTH;
		this.sampleWeight = 1 / this.interpFrames;

		this.gainRatioHistory = this.initializeBuffer(this.interpFrames);
		this.yawRatioHistory = this.initializeBuffer(this.interpFrames);
	}

	setMinSpeed(newMinSpeed: number) {
		this.minSpeed = newMinSpeed ?? DEFAULT_MIN_SPEED;
	}

	setStatMode(newStatMode: StatMode) {
		this.statMode = newStatMode ?? StatMode.OFF;
		this.panels.wrapper.style.visibility = newStatMode === StatMode.HIDE_BAR ? 'collapse' : 'visible';
	}

	setStatColorMode(newColorMode: boolean) {
		this.statColorEnable = newColorMode ?? false;
	}

	NaNCheck(val: any, def: any) {
		return Number.isNaN(Number(val)) ? def : val;
	}
}
