import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { splitRgbFromAlpha } from 'util/colors';

// This gets overridden on map load. Set defaults in cfg/hud_default.kv3
const Colors = {
	AIR: 'gradient(linear, 30% 0%, 100% 0%, from(rgba(24, 150, 211, 1)), to(rgba(63, 74, 202, 1)))',
	GROUND: 'gradient(linear, 30% 0%, 100% 0%, from(rgba(122, 238, 122, 1)), to(rgba(21, 152, 86, 1)))'
};

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
		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			events: {
				event: 'DFJumpDataUpdate',
				panel: this.panels.container,
				callbackFn: (releaseDelay, pressDelay, totalDelay) =>
					this.onDFJumpUpdate(releaseDelay, pressDelay, totalDelay)
			},
			dynamicStyles: {
				maxDelay: {
					name: 'Jump Max Delay',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.setMaxDelay(value);
					},
					settingProps: { min: 1, max: 360 }
				},
				showLabels: {
					name: 'Show Labels',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.dfjump__text-wrapper',
					styleProperty: 'visibility',
					children: [{ styleID: 'fontStyling', showWhen: true }],
					valueFn: (value) => {
						if (value) return 'visible';
						else return 'collapse';
					}
				},
				fontStyling: {
					name: 'Font Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
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
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						panel.style.textShadowFast = this.getAdjustedTextShadow(value as rgbaColor);
					}
				},
				borderStyling: {
					name: 'Border Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'borderWidth' }, { styleID: 'borderColor' }, { styleID: 'borderRadius' }]
				},
				borderWidth: {
					name: 'Border Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.dfjump__bar-wrapper',
					styleProperty: 'borderWidth',
					valueFn: (value) => `${value}px`
				},
				borderColor: {
					name: 'Border Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.dfjump__bar-wrapper',
					styleProperty: 'borderColor'
				},
				borderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.dfjump__bar-wrapper',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}px`
				},
				colors: {
					name: 'Colors',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'backgroundGradient' },
						{ styleID: 'airGradient' },
						{ styleID: 'releaseGradient' },
						{ styleID: 'groundGradient' }
					]
				},
				backgroundGradient: {
					name: 'Background',
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

	setMaxDelay(newDelay: number) {
		this.inverseMaxDelay = 1 / newDelay;
	}

	getAdjustedTextShadow(color: rgbaColor) {
		const splitRGBA = splitRgbFromAlpha(color);
		return `0px 1px 1.5px 1 rgba(0, 0, 0, ${splitRGBA.alpha})`;
	}
}
