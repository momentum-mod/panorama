import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

const sizeMin = 10;
const sizeMax = 24;

registerHUDCustomizerComponent($.GetContextPanel(), {
	resizeX: true,
	resizeY: true,
	dynamicStyles: [
		{
			name: 'Scale',
			type: CustomizerPropertyType.NUMBER_ENTRY,
			func: (panel: GenericPanel, value: unknown) => {
				for (let i = sizeMin; i <= sizeMax; i++) {
					panel.SetHasClass(`hud-chat--size-${i}`, i === (value as number));
				}
			},
			settingProps: { min: sizeMin, max: sizeMax }
		},
		{
			name: 'Border Radius',
			type: CustomizerPropertyType.NUMBER_ENTRY,
			styleProperty: 'borderRadius',
			targetPanel: '.chat__elem',
			valueFn: (value: unknown) => `${value}px`,
			settingProps: { min: 0, max: 20 }
		}
	]
});
