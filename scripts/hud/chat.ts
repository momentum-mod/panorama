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
			targetPanel: ['.chat-entry__message', '.chat__input', '.chat__send-text'],
			eventListeners: [
				{
					event: 'OnNewChatEntry',
					panel: $.GetContextPanel().FindChildInLayoutFile('RaisedChat'),
					callback: (panel: Panel, value: string) => {
						const text = panel.FindChild('Text')!;
						text.style.fontFamily = value;
						// TODO: Need a better approach than this. Why does this work?
						// If works because causes a repaint, why doesn't the repaint setting the font do it?
						// Currently the size is always wrong when changing or for new messages, until they're
						// mouseovered.
						// Looks like setrepaint(full) *is* getting called in afterstylesapplied... so we need to do
						// more than repaint to update styles? worth looking into comment on styles.cpp l952
						// @ts-ignore
						panel.MarkStylesDirty(true);
					}
				}
			]
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
