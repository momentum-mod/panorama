import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

registerHUDCustomizerComponent($.GetContextPanel(), {
	resizeX: true,
	resizeY: true,
	marginSettings: true,
	paddingSettings: false,
	backgroundColorSettings: false,
	dynamicStyles: {
		showTyping: {
			name: 'Show Users Typing',
			type: CustomizerPropertyType.CHECKBOX,
			func: (panel, value) => {
				panel.SetHasClass('chat--disable-users-typing', !value);
			}
		},
		font: {
			name: 'Font',
			type: CustomizerPropertyType.FONT_PICKER,
			styleProperty: 'fontFamily',
			targetPanel: ['.chat__input', '.chat__history'],
			// TODO: not working!!!!
			eventListeners: [
				{
					event: 'OnNewChatEntry',
					panel: $.GetContextPanel().FindChildInLayoutFile('RaisedChat'),
					callback: (panel, value) => {
						panel.style.fontFamily = value;
					}
				}
			]
		},
		sendFont: {
			name: 'Send Button Font',
			type: CustomizerPropertyType.FONT_PICKER,
			styleProperty: 'fontFamily',
			targetPanel: '.chat__send'
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
			eventListeners: [
				{
					event: 'OnNewChatEntry',
					panel: $.GetContextPanel().FindChildInLayoutFile('RaisedChat'),
					callback: (panel, value) => {
						panel.style.fontFamily = value;
					}
				}
			],
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
