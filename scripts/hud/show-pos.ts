import { PanelHandler } from 'util/module-helpers';
import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { getTextShadowFast } from 'common/hud-customizer';

@PanelHandler()
class HudShowPosHandler {
	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: 'Position / Angle',
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
						panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9);
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
}
