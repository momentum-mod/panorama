import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategories, GamemodeCategory } from 'common/web';

enum ColorClass {
	AIR = 'dfjump__press--air',
	GROUND = 'dfjump__press--ground'
}

const DEFAULT_DELAY = 360;

@PanelHandler()
class DFJumpHandler {
	readonly panels = {
		container: $<Panel>('#DFJumpContainer'),
		releaseBar: $<ProgressBar>('#JumpReleaseBar'),
		pressBar: $<ProgressBar>('#JumpPressBar'),
		releaseLabel: $<Label>('#JumpReleaseLabel'),
		pressLabel: $<Label>('#JumpPressLabel'),
		totalLabel: $<Label>('#JumpTotalLabel')
	};

	colorClass: ColorClass;
	inverseMaxDelay: float;

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			onLoad: () => this.onMapInit(),
			events: [
				{
					event: 'DFJumpDataUpdate',
					callback: (releaseDelay, pressDelay, totalDelay) =>
						this.onDFJumpUpdate(releaseDelay, pressDelay, totalDelay)
				},
				{
					event: 'DFJumpMaxDelayChanged',
					callback: (newDelay) => this.setMaxDelay(newDelay)
				}
			]
		});
	}

	onMapInit() {
		this.initializeSettings();
		this.colorClass = ColorClass.GROUND;
	}

	onDFJumpUpdate(releaseDelay: float, pressDelay: float, totalDelay: float) {
		const releaseRatio = releaseDelay * this.inverseMaxDelay;
		const pressRatio = Math.abs(pressDelay) * this.inverseMaxDelay;
		const newPressColorClass = pressDelay < 0 ? ColorClass.GROUND : ColorClass.AIR;

		this.panels.releaseBar.value = releaseRatio;
		this.panels.pressBar.value = pressRatio;
		this.panels.pressBar.RemoveClass(this.colorClass);
		this.panels.pressBar.AddClass(newPressColorClass);
		this.colorClass = newPressColorClass;

		this.panels.releaseLabel.text = releaseDelay.toFixed(0);
		this.panels.pressLabel.text = pressDelay.toFixed(0);
		this.panels.totalLabel.text = totalDelay.toFixed(0);
	}

	setMaxDelay(newDelay: float) {
		this.inverseMaxDelay = 1 / (newDelay ?? DEFAULT_DELAY);
	}

	initializeSettings() {
		this.setMaxDelay(GameInterfaceAPI.GetSettingInt('mom_df_hud_jump_max_delay'));
	}
}
