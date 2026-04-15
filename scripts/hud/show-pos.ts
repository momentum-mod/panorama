import { PanelHandler } from 'util/module-helpers';
import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { splitRgbFromAlpha } from 'util/colors';

@PanelHandler()
class HudShowPosHandler {
	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: true,
			resizeY: false,
			dynamicStyles: {
				fontStyling: {
					name: 'Font Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.showpos-entry__label',
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.showpos-entry__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.showpos-entry__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						panel.style.textShadowFast = this.getAdjustedTextShadow(value as rgbaColor);
					}
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.showpos-entry',
					styleProperty: 'backgroundColor'
				},
				alignText: {
					name: 'Align Text',
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'Left', value: 'left' },
						{ label: 'Center', value: 'center' },
						{ label: 'Right', value: 'right' }
					],
					targetPanel: ['.showpos-entry', '.showpos-entry__label'],
					styleProperty: 'horizontalAlign'
				}
			}
		});
	}

	getAdjustedTextShadow(color: rgbaColor) {
		const splitRGBA = splitRgbFromAlpha(color);
		return `0px 1px rgba(0, 0, 0, ${splitRGBA.alpha * 0.9})`;
	}
}
