import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategories, GamemodeCategory } from 'common/web';
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

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.BHOP), // TODO: Add stamina bhop game mode
			handledEvents: [
				{
					event: 'JumpTimingDataUpdate',
					panel: this.panels.container,
					callback: (jumpTiming, maxTimingPenalty) => this.onJumpTimingUpdate(jumpTiming, maxTimingPenalty)
				}
			]
		});
	}

	onJumpTimingUpdate(jumpTiming: number, maxTimingPenalty: number) {
		// Blend between yellow and orange for early timing, and orange and red for late timing since you lose more speed on the ground from friction and stamina
		const earlyTimingRatio = jumpTiming < 0 ? -jumpTiming / maxTimingPenalty : 0;
		this.panels.earlyBar.value = earlyTimingRatio;
		this.panels.earlyLabel.text = jumpTiming < 0 ? -jumpTiming : 0;
		const colorLerp = (Math.abs(jumpTiming) - 1) / (maxTimingPenalty - 1);
		const earlyTimingColor = rgbaTupleLerp(Colors.YELLOW, Colors.ORANGE, colorLerp);
		this.panels.earlyBarProgress.style.backgroundColor = tupleToRgbaString(earlyTimingColor);

		const lateTimingRatio = jumpTiming > 0 ? jumpTiming / maxTimingPenalty : 0;
		this.panels.lateBar.value = lateTimingRatio;
		this.panels.lateLabel.text = jumpTiming > 0 ? jumpTiming : 0;
		const lateTimingColor = rgbaTupleLerp(Colors.ORANGE, Colors.RED, colorLerp);
		this.panels.lateBarProgress.style.backgroundColor = tupleToRgbaString(lateTimingColor);
	}
}
