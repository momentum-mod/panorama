import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

//This gets overridden on map load. Set defaults in cfg/hud_default.kv3
const Colors = {
	AIR: 'gradient(linear, 30% 0%, 100% 0%, from(rgba(24, 150, 211, 1)), to(rgba(63, 74, 202, 1)))',
	GROUND: 'gradient(linear, 30% 0%, 100% 0%, from(rgba(122, 238, 122, 1)), to(rgba(21, 152, 86, 1)))'
};

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

	inverseMaxDelay: float;

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			onLoad: () => this.onMapInit(),
			events: [
				{
					event: 'DFJumpMaxDelayChanged',
					callback: (newDelay) => this.setMaxDelay(newDelay)
				}
			],
			handledEvents: [
				{
					event: 'DFJumpDataUpdate',
					panel: this.panels.container,
					callback: (releaseDelay, pressDelay, totalDelay) =>
						this.onDFJumpUpdate(releaseDelay, pressDelay, totalDelay)
				}
			]
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			//TODO: Add border styles
			dynamicStyles: {
				showLabels: {
					name: 'Show Labes',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.dfjump__text-wrapper',
					styleProperty: 'visibility',
					valueFn: (value) => {
						if (value) return 'visible';
						else return 'collapse';
					}
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: [
						'.dfjump__text-wrapper--release',
						'.dfjump__text-wrapper--total',
						'.dfjump__text-wrapper--press'
					],
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: [
						'.dfjump__text-wrapper--release',
						'.dfjump__text-wrapper--total',
						'.dfjump__text-wrapper--press'
					],
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: [
						'.dfjump__text-wrapper--release',
						'.dfjump__text-wrapper--total',
						'.dfjump__text-wrapper--press'
					],
					styleProperty: 'color'
				},
				backgroundGradient: {
					name: 'Background Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					targetPanel: ['.dfjump__release', '.dfjump__press'],
					callbackFunc: (panel, value) => {
						panel.GetLastChild().style.backgroundColor =
							`gradient(linear, 0% 0%, 100% 0%, from(${value[0]}), to(${value[1]}))` as color;
					}
				},
				airGradient: {
					name: 'Air Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						Colors.AIR = `gradient(linear, 30% 0%, 100% 0%, from(${value[0]}), to(${value[1]}))`;
						this.onDFJumpUpdate(0, 0, 0);
					}
				},
				releaseGradient: {
					name: 'Release Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					targetPanel: '.dfjump__release',
					callbackFunc: (panel, value) => {
						panel.GetFirstChild().style.backgroundColor =
							`gradient(linear, 30% 0%, 100% 0%, from(${value[0]}), to(${value[1]}))` as color;
					}
				},
				groundGradient: {
					name: 'Ground Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						Colors.GROUND = `gradient(linear, 30% 0%, 100% 0%, from(${value[0]}), to(${value[1]}))`;
						this.onDFJumpUpdate(0, 0, 0);
					}
				}
			}
		});
	}

	onMapInit() {
		this.initializeSettings();
	}

	onDFJumpUpdate(releaseDelay: float, pressDelay: float, totalDelay: float) {
		const releaseRatio = releaseDelay * this.inverseMaxDelay;
		const pressRatio = Math.abs(pressDelay) * this.inverseMaxDelay;
		const newPressColor = pressDelay < 0 ? Colors.GROUND : Colors.AIR;

		this.panels.releaseBar.value = releaseRatio;
		this.panels.pressBar.value = pressRatio;
		this.panels.pressBar.GetFirstChild().style.backgroundColor = newPressColor as color;

		this.panels.releaseLabel.text = releaseDelay.toFixed(0);
		this.panels.pressLabel.text = pressDelay.toFixed(0);
		this.panels.totalLabel.text = totalDelay.toFixed(0);
	}

	setMaxDelay(newDelay: float) {
		this.inverseMaxDelay = 1 / (newDelay ?? DEFAULT_DELAY);
	}

	initializeSettings() {
		this.setMaxDelay(GameInterfaceAPI.GetSettingInt('mom_hud_df_jump_max_delay'));
	}
}
