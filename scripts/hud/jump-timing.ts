import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { RgbaTuple, rgbaTupleLerp, tupleToRgbaString } from 'util/colors';
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
		lateBarProgress: $<Panel>('#JumpLateBar_Left')
	};

	perfWindow: number;
	range: number;
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
		this.range = GameInterfaceAPI.GetSettingInt('mom_hud_jump_timing_range');
		this.perfWindow = GameInterfaceAPI.GetSettingInt('mom_mv_perfect_jump_window');
		this.bufferedJumpingEnabled = GameInterfaceAPI.GetSettingInt('mom_mv_autohop_mode') === 2;

		this.panels.earlyLabel.visible = this.bufferedJumpingEnabled;
		this.panels.earlyBar.visible = this.bufferedJumpingEnabled;
		this.panels.lateBar.style.width = this.bufferedJumpingEnabled ? '50%' : '100%';
	}

	onJumpTimingUpdate(jumpTiming: number) {
		jumpTiming = Math.max(Math.min(jumpTiming, this.range), -this.range);

		if (this.bufferedJumpingEnabled) {
			const earlyTimingRatio =
				jumpTiming < 0
					? Math.max(-jumpTiming - this.perfWindow, 0) / Math.max(this.range - this.perfWindow, 1)
					: 0;
			this.panels.earlyBar.value = earlyTimingRatio;
			this.panels.earlyLabel.text = jumpTiming < 0 ? -jumpTiming : 0;
		}

		const lateTimingRatio = jumpTiming > 0 ? jumpTiming / this.range : 0;
		this.panels.lateBar.value = lateTimingRatio;
		this.panels.lateLabel.text = jumpTiming > 0 ? jumpTiming : 0;
		const colorLerp = (Math.abs(jumpTiming) - 1) / (this.range - 1);
		const lateTimingColor = rgbaTupleLerp(Colors.ORANGE, Colors.RED, colorLerp);
		this.panels.lateBarProgress.style.backgroundColor = tupleToRgbaString(lateTimingColor);
	}
}
