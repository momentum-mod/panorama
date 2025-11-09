import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

registerHUDCustomizerComponent($.GetContextPanel(), {
	resizeX: true,
	resizeY: true,
	dynamicStyles: {
		showTyping: {
			name: 'Show Users Typing',
			type: CustomizerPropertyType.CHECKBOX,
			func: (panel, value) => {
				panel.SetHasClass('chat--disable-users-typing', !value);
			}
		},
		backgroundColor: {
			name: 'Background Color',
			type: CustomizerPropertyType.COLOR_PICKER,
			styleProperty: 'backgroundColor',
			targetPanel: '.chat__elem'
		},
		scale: {
			name: 'Scale',
			type: CustomizerPropertyType.NUMBER_ENTRY,
			func: (panel, value) => {
				for (let i = 10; i <= 24; i++) {
					panel.SetHasClass(`hud-chat--size-${i}`, i === value);
				}
			},
			settingProps: { min: 10, max: 24 }
		},
		innerGap: {
			name: 'Gap',
			type: CustomizerPropertyType.NUMBER_ENTRY,
			func: (panel, value) => {
				for (let i = 0; i <= 8; i++) {
					panel.SetHasClass(`hud-chat--gap-${i}`, i === value);
				}
			},
			settingProps: { min: 0, max: 8 }
		},
		borderRadius: {
			name: 'Border Radius',
			type: CustomizerPropertyType.NUMBER_ENTRY,
			styleProperty: 'borderRadius',
			targetPanel: '.chat__elem',
			valueFn: (value) => `${value}px`,
			settingProps: { min: 0, max: 20 }
		}
	}
});
