import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

registerHUDCustomizerComponent($.GetContextPanel(), {
	resizeX: true,
	resizeY: true,
	dynamicStyles: {
		showTyping: {
			name: 'Show Users Typing',
			type: CustomizerPropertyType.CHECKBOX,
			callbackFunc: (panel, value) => {
				panel.SetHasClass('chat--disable-users-typing', !value);
			}
		},
		font: {
			name: 'Font',
			type: CustomizerPropertyType.FONT_PICKER,
			styleProperty: 'fontFamily',
			targetPanel: ['.chat-entry__message', '.chat__input', '.chat__send-text'],
			events: [
				{
					event: 'OnNewChatEntry',
					panel: $.GetContextPanel().FindChildInLayoutFile('RaisedChat')!,
					callback: (value: string, panel: GenericPanel) => {
						const text = panel.FindChild('Text')!;
						text.style.fontFamily = value;
						// TODO: Need a better approach than this. Why does this work?
						// If works because causes a repaint, why doesn't the repaint setting the font do it?
						// Currently the size is always wrong when changing or for new messages, until they're
						// mouseovered.
						// Looks like setrepaint(full) *is* getting called in afterstylesapplied... so we need to do
						// more than repaint to update styles? worth looking into comment on styles.cpp l952
						// @ts-expect-error asdhjaskfodsf
						panel.ApplyStyles(true);
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
			callbackFunc: (panel, value) => {
				for (let i = 10; i <= 24; i++) {
					panel.SetHasClass(`hud-chat--size-${i}`, i === value);
				}
			},
			settingProps: { min: 10, max: 24 }
		},
		innerGap: {
			name: 'Gap',
			type: CustomizerPropertyType.NUMBER_ENTRY,
			callbackFunc: (panel, value) => {
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
		},
		// TODO: Blurring blurs the entire panel, not the backbuffer. Adding #ChatInput to #HudBlur's blurrects has
		// same issue, no idea what's different about that panel from say, TabMenu/Spectator
		// blur: {
		// 	name: 'Background Blur',
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
