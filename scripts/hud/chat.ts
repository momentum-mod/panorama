import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

registerHUDCustomizerComponent($.GetContextPanel(), {
	name: $.Localize('#Customizer_Chat_Name'),
	resizeX: true,
	resizeY: true,
	dynamicStyles: {
		showTyping: {
			name: $.Localize('#Customizer_Chat_ShowTyping'),
			type: CustomizerPropertyType.CHECKBOX,
			callbackFunc: (panel, value) => {
				panel.SetHasClass('chat--disable-users-typing', !value);
			}
		},
		// TODO: Broken for now, requires c++ rework, changing fonts breaks styling
		// font: {
		// 	name: $.Localize('#Customizer_Font'),
		// 	type: CustomizerPropertyType.FONT_PICKER,
		// 	styleProperty: 'fontFamily',
		// 	targetPanel: ['.chat-entry__message', '.chat__input', '.chat__send-text'],
		// 	events: [
		// 		{
		// 			event: 'OnNewChatEntry',
		// 			panel: $.GetContextPanel().FindChildInLayoutFile('RaisedChat')!,
		// 			callback: (value: string, panel: GenericPanel) => {
		// 				const text = panel.FindChild('Text')!;
		// 				text.style.fontFamily = value;
		// 				panel.ApplyStyles(true);
		// 			}
		// 		}
		// 	]
		// },
		backgroundColor: {
			name: $.Localize('#Customizer_BackgroundColor'),
			type: CustomizerPropertyType.COLOR_PICKER,
			styleProperty: 'backgroundColor',
			targetPanel: '.chat__elem'
		},
		scale: {
			name: $.Localize('#Customizer_Chat_Scale'),
			type: CustomizerPropertyType.NUMBER_ENTRY,
			callbackFunc: (panel, value) => {
				for (let i = 10; i <= 24; i++) {
					panel.SetHasClass(`hud-chat--size-${i}`, i === value);
				}
			},
			settingProps: { min: 10, max: 24 }
		},
		innerGap: {
			name: $.Localize('#Customizer_Gap'),
			type: CustomizerPropertyType.NUMBER_ENTRY,
			callbackFunc: (panel, value) => {
				for (let i = 0; i <= 8; i++) {
					panel.SetHasClass(`hud-chat--gap-${i}`, i === value);
				}
			},
			settingProps: { min: 0, max: 8 }
		},
		borderRadius: {
			name: $.Localize('#Customizer_BorderRadius'),
			type: CustomizerPropertyType.NUMBER_ENTRY,
			styleProperty: 'borderRadius',
			targetPanel: '.chat__elem',
			valueFn: (value) => `${value}px`,
			settingProps: { min: 0, max: 20 }
		}
		// blur: {
		// 	name: $.Localize('#Customizer_Chat_Blur'),
		// 	type: CustomizerPropertyType.CHECKBOX,
		// 	targetPanel: '.chat__elem',
		// 	callbackFunc: (panel, value) => {
		// 		const blurTarget = $.GetContextPanel().GetParent()!.FindChild<HudBlurTarget>('HudBlur')!;
		// 		if (value) {
		// 			blurTarget.AddBlurPanel(panel);
		// 		} else {
		// 			blurTarget.RemoveBlurPanel(panel);
		// 		}
		// 	}
		// }
	}
});
