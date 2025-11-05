import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

const sizeMin = 10;
const sizeMax = 24;

registerHUDCustomizerComponent($.GetContextPanel(), {
	resizeX: true,
	resizeY: true,
	dynamicStyles: {
		scale: {
			name: 'Scale',
			type: CustomizerPropertyType.NUMBER_ENTRY,
			func: (panel, value) => {
				for (let i = sizeMin; i <= sizeMax; i++) {
					panel.SetHasClass(`hud-chat--size-${i}`, i === value);
				}
			},
			settingProps: { min: sizeMin, max: sizeMax }
		},
		showTyping: {
			name: 'Show Users Typing',
			type: CustomizerPropertyType.CHECKBOX,
			func: (panel, value) => {
				panel.SetHasClass('chat--disable-users-typing', !value);
			}
		},
		borderRadius: {
			name: 'Border Radius',
			type: CustomizerPropertyType.NUMBER_ENTRY,
			styleProperty: 'borderRadius',
			targetPanel: '.chat__elem',
			valueFn: (value) => `${value}px`,
			settingProps: { min: 0, max: 20 }
		},
		backgroundColor: {
			name: 'Background Color',
			type: CustomizerPropertyType.COLOR_PICKER,
			styleProperty: 'backgroundColor',
			targetPanel: '.chat__elem'
		}
	}
});
