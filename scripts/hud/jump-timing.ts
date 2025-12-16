import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { RgbaTuple, tupleToRgbaString } from 'util/colors';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';

const Colors = {
	RED: [255, 0, 0, 255] as RgbaTuple,
	GREEN: [0, 255, 0, 255] as RgbaTuple,
	DARK_RED: [80, 0, 0, 255] as RgbaTuple,
	DARK_GREEN: [0, 80, 0, 255] as RgbaTuple
};

@PanelHandler()
class JumpTimingHandler {
	readonly panels = {
		container: $<Panel>('#JumpTimingContainer'),
		earlyLabel: $<Label>('#JumpEarlyLabel'),
		lateLabel: $<Label>('#JumpLateLabel'),
		bufferedJumpZones: $<Panel>('#BufferedJumpZones'),
		scrollZones: $<Panel>('#ScrollZones'),
		earlyTimingZone: $<Panel>('#JumpEarlyZone'),
		perfectTimingZone: $<Panel>('#JumpPerfectZone'),
		lateTimingZone: $<Panel>('#JumpLateZone'),
		scrollLateZone1: $<Panel>('#ScrollLateZone1'),
		scrollLateZone2: $<Panel>('#ScrollLateZone2'),
		perfPercentLabel: $<Label>('#JumpPerfPercentLabel'),
		tickMarker: $<Panel>('#JumpTickMarker')
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
		this.panels.scrollLateZone1.style.backgroundColor = tupleToRgbaString(Colors.RED);
		this.panels.scrollLateZone2.style.backgroundColor = tupleToRgbaString(Colors.DARK_RED);
	}

	onMapInit() {
		this.updateSettings();
	}

	updateSettings() {
		this.maxEarlyTiming = GameInterfaceAPI.GetSettingInt('mom_hud_jump_timing_early_range');
		this.maxLateTiming = GameInterfaceAPI.GetSettingInt('mom_hud_jump_timing_late_range');
		this.perfWindow = GameInterfaceAPI.GetSettingInt('mom_mv_buffered_jump_perf_window');
		this.bufferedJumpingEnabled = GameInterfaceAPI.GetSettingInt('mom_mv_autohop_mode') === 2;
		this.displayTime = GameInterfaceAPI.GetSettingFloat('mom_hud_jump_timing_display_time');

		this.panels.earlyLabel.visible = this.bufferedJumpingEnabled;
		this.panels.bufferedJumpZones.visible = this.bufferedJumpingEnabled;
		this.panels.scrollZones.visible = !this.bufferedJumpingEnabled;

		if (this.bufferedJumpingEnabled) {
			const maxTimingWindow = this.maxEarlyTiming + this.maxLateTiming;
			if (maxTimingWindow > 0) {
				const earlyTimingZoneWidthPercent = ((this.maxEarlyTiming - this.perfWindow) / maxTimingWindow) * 100;
				this.panels.earlyTimingZone.style.width = `${earlyTimingZoneWidthPercent}%`;

				const perfZoneWidthPercent = (this.perfWindow / maxTimingWindow) * 100;
				this.panels.perfectTimingZone.style.width = `${perfZoneWidthPercent}%`;

				const lateTimingZoneWidthPercent = (this.maxLateTiming / maxTimingWindow) * 100;
				this.panels.lateTimingZone.style.width = `${lateTimingZoneWidthPercent}%`;
			}
		}
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

		// Position tick marker based on jump timing
		let tickPosition: number;
		if (this.bufferedJumpingEnabled) {
			const totalRange = this.maxEarlyTiming + this.maxLateTiming;
			tickPosition = ((clampedJumpTiming + this.maxEarlyTiming) / totalRange) * 100;
		} else {
			// Scroll
			tickPosition = (clampedJumpTiming / this.maxLateTiming) * 100;
		}

		if (tickPosition < 100) {
			this.panels.tickMarker.style.marginLeft = `${tickPosition}%`;
			this.panels.tickMarker.style.horizontalAlign = 'left';
		} else {
			// Note: This is needed to prevent the tick from going past the full width of the bar
			this.panels.tickMarker.style.marginLeft = '0%';
			this.panels.tickMarker.style.horizontalAlign = 'right';
		}

		this.panels.tickMarker.visible = true;

		// Update zones based on jump timing
		if (this.bufferedJumpingEnabled) {
			if (jumpTiming < -this.perfWindow) {
				this.panels.earlyTimingZone.style.backgroundColor = tupleToRgbaString(Colors.RED);
				this.panels.perfectTimingZone.style.backgroundColor = tupleToRgbaString(Colors.DARK_GREEN);
				this.panels.lateTimingZone.style.backgroundColor = tupleToRgbaString(Colors.DARK_RED);
			} else if (jumpTiming >= -this.perfWindow && jumpTiming <= 0) {
				this.panels.earlyTimingZone.style.backgroundColor = tupleToRgbaString(Colors.DARK_RED);
				this.panels.perfectTimingZone.style.backgroundColor = tupleToRgbaString(Colors.GREEN);
				this.panels.lateTimingZone.style.backgroundColor = tupleToRgbaString(Colors.DARK_RED);
			} else {
				this.panels.earlyTimingZone.style.backgroundColor = tupleToRgbaString(Colors.DARK_RED);
				this.panels.perfectTimingZone.style.backgroundColor = tupleToRgbaString(Colors.DARK_GREEN);
				this.panels.lateTimingZone.style.backgroundColor = tupleToRgbaString(Colors.RED);
			}
		} else {
			// Scroll
			this.panels.scrollLateZone1.style.width = `${tickPosition}%`;
			this.panels.scrollLateZone2.style.width = `${100 - tickPosition}%`;
		}

		// Update jump timing labels
		if (this.bufferedJumpingEnabled) {
			this.panels.earlyLabel.text = jumpTiming < 0 ? jumpTiming : 0;
		}

		this.panels.lateLabel.text = jumpTiming > 0 ? jumpTiming : 0;

		// Display perfect jump percent
		if (perfPercent < 0) {
			this.panels.perfPercentLabel.visible = false;
		} else {
			this.panels.perfPercentLabel.visible = true;
			this.panels.perfPercentLabel.SetDialogVariable('perf_percent', Math.round(perfPercent * 100).toString());
		}
	}
}
