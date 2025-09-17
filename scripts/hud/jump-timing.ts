import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategories, GamemodeCategory } from 'common/web_dontmodifyme';
import { RgbaTuple, rgbaTupleLerp, tupleToRgbaString } from 'util/colors';

const Colors = {
	RED: [255, 0, 0, 255] as RgbaTuple,
	ORANGE: [255, 165, 0, 255] as RgbaTuple,
	YELLOW: [255, 255, 0, 255] as RgbaTuple
};

@PanelHandler()
class JumpTimingHandler {
	readonly panels = {
		container: $<Panel>('#JumpTimingContainer'),
		earlyBar: $<ProgressBar>('#JumpEarlyBar'),
		lateBar: $<ProgressBar>('#JumpLateBar'),
		earlyLabel: $<Label>('#JumpEarlyLabel'),
		lateLabel: $<Label>('#JumpLateLabel'),
		earlyBarProgress: $<Panel>('#JumpEarlyBar_Left'),
		lateBarProgress: $<Panel>('#JumpLateBar_Left')
	};

	perfWindow: number;
	maxEarlyTiming: number;
	maxLateTiming: number;
	bufferedJumpingEnabled: boolean;

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.BHOP), // TODO: Add stamina bhop game mode
			onLoad: () => this.onMapInit(),
			events: [
				{
					event: 'JumpTimingSettingChanged',
					callback: () => this.updateSettings()
				}
			],
			handledEvents: [
				{
					event: 'JumpTimingDataUpdate',
					panel: this.panels.container,
					callback: (jumpTiming) => this.onJumpTimingUpdate(jumpTiming)
				}
			]
		});

		this.panels.earlyBarProgress.style.backgroundColor = tupleToRgbaString(Colors.ORANGE);
	}

	onMapInit() {
		this.updateSettings();
	}

	updateSettings() {
		this.maxEarlyTiming = GameInterfaceAPI.GetSettingInt('mom_mv_early_jump_timing_window');
		this.maxLateTiming = GameInterfaceAPI.GetSettingInt('mom_hud_late_jump_timing');
		this.perfWindow = GameInterfaceAPI.GetSettingInt('mom_mv_early_jump_timing_perf_window');
		this.bufferedJumpingEnabled = GameInterfaceAPI.GetSettingInt('mom_mv_autohop_mode') === 2;

		this.panels.earlyLabel.visible = this.bufferedJumpingEnabled;
		this.panels.earlyBar.visible = this.bufferedJumpingEnabled;
		this.panels.lateBar.style.width = this.bufferedJumpingEnabled ? '50%' : '100%';
	}

	onJumpTimingUpdate(jumpTiming: number) {
		jumpTiming = Math.max(Math.min(jumpTiming, this.maxLateTiming), -this.maxEarlyTiming);

		if (this.bufferedJumpingEnabled) {
			const earlyTimingRatio =
				jumpTiming < 0
					? Math.max(-jumpTiming - this.perfWindow, 0) / Math.max(this.maxEarlyTiming - this.perfWindow, 1)
					: 0;
			this.panels.earlyBar.value = earlyTimingRatio;
			this.panels.earlyLabel.text = jumpTiming < 0 ? -jumpTiming : 0;

			const earlyColorLerp =
				jumpTiming < 0 ? (-jumpTiming - this.perfWindow - 1) / (this.maxEarlyTiming - this.perfWindow - 1) : 0;
			const earlyTimingColor = rgbaTupleLerp(Colors.YELLOW, Colors.ORANGE, earlyColorLerp);
			this.panels.earlyBarProgress.style.backgroundColor = tupleToRgbaString(earlyTimingColor);
		}

		const lateTimingRatio = jumpTiming > 0 ? jumpTiming / this.maxLateTiming : 0;
		this.panels.lateBar.value = lateTimingRatio;
		this.panels.lateLabel.text = jumpTiming > 0 ? jumpTiming : 0;

		const lateColorLerp = jumpTiming > 0 ? (jumpTiming - 1) / (this.maxLateTiming - 1) : 0;
		const lateTimingColor = rgbaTupleLerp(Colors.ORANGE, Colors.RED, lateColorLerp);
		this.panels.lateBarProgress.style.backgroundColor = tupleToRgbaString(lateTimingColor);
	}
}
