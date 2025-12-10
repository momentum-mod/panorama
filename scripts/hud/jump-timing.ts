import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { RgbaTuple, tupleToRgbaString } from 'util/colors';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';

const Colors = {
	RED: [255, 0, 0, 255] as RgbaTuple,
	ORANGE: [255, 165, 0, 255] as RgbaTuple
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
		lateBarProgress: $<Panel>('#JumpLateBar_Left'),
		perfPercentLabel: $<Label>('#JumpPerfPercentLabel')
	};

	perfWindow: number;
	maxEarlyTiming: number;
	maxLateTiming: number;
	bufferedJumpingEnabled: boolean;
	displayTime: number;
	displayStartTime: number;

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.BHOP), // TODO: Add stamina bhop game mode
			onLoad: () => this.onMapInit(),
			events: [
				{
					event: 'JumpTimingSettingChanged',
					callback: () => this.updateSettings()
				},
				{
					event: 'HudThink',
					callback: () => this.updateVisibility()
				}
			],
			handledEvents: [
				{
					event: 'JumpTimingDataUpdate',
					panel: this.panels.container,
					callback: (jumpTiming, perfPercent) => this.onJumpTimingUpdate(jumpTiming, perfPercent)
				}
			]
		});

		this.panels.container.visible = false;
	}

	onMapInit() {
		this.updateSettings();
	}

	updateSettings() {
		this.maxEarlyTiming = GameInterfaceAPI.GetSettingInt('mom_mv_buffered_jump_near_perf_window') + 1;
		this.maxLateTiming = GameInterfaceAPI.GetSettingInt('mom_hud_late_jump_timing');
		this.perfWindow = GameInterfaceAPI.GetSettingInt('mom_mv_buffered_jump_perf_window');
		this.bufferedJumpingEnabled = GameInterfaceAPI.GetSettingInt('mom_mv_autohop_mode') === 2;
		this.displayTime = GameInterfaceAPI.GetSettingFloat('mom_hud_jump_timing_display_time');

		this.panels.earlyLabel.visible = this.bufferedJumpingEnabled;
		this.panels.earlyBar.visible = this.bufferedJumpingEnabled;
		this.panels.lateBar.style.width = this.bufferedJumpingEnabled ? '50%' : '100%';
	}

	updateVisibility() {
		if (MomentumMovementAPI.GetCurrentTime() - this.displayStartTime > this.displayTime) {
			this.panels.container.visible = false;
		}
	}

	onJumpTimingUpdate(jumpTiming: number, perfPercent: float) {
		this.panels.container.visible = true;
		this.displayStartTime = MomentumMovementAPI.GetCurrentTime();

		const clampedJumpTiming = Math.max(Math.min(jumpTiming, this.maxLateTiming), -this.maxEarlyTiming);

		if (this.bufferedJumpingEnabled) {
			const earlyTimingRatio =
				clampedJumpTiming < 0
					? Math.max(-clampedJumpTiming - this.perfWindow, 0) /
						Math.max(this.maxEarlyTiming - this.perfWindow, 1)
					: 0;
			this.panels.earlyBar.value = earlyTimingRatio;
			this.panels.earlyLabel.text = jumpTiming < 0 ? -jumpTiming : 0;

			const earlyTimingColor = jumpTiming <= -this.maxEarlyTiming ? Colors.RED : Colors.ORANGE;
			this.panels.earlyBarProgress.style.backgroundColor = tupleToRgbaString(earlyTimingColor);
		}

		const lateTimingRatio = clampedJumpTiming > 0 ? clampedJumpTiming / this.maxLateTiming : 0;
		this.panels.lateBar.value = lateTimingRatio;
		this.panels.lateLabel.text = jumpTiming > 0 ? jumpTiming : 0;

		const lateTimingColor = Colors.RED;
		this.panels.lateBarProgress.style.backgroundColor = tupleToRgbaString(lateTimingColor);

		// Display perfect jump percent
		if (perfPercent < 0) {
			this.panels.perfPercentLabel.visible = false;
		} else {
			this.panels.perfPercentLabel.visible = true;
			this.panels.perfPercentLabel.SetDialogVariable('perf_percent', Math.round(perfPercent * 100).toString());
		}
	}
}
