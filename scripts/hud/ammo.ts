import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { splitRgbFromAlpha } from 'util/colors';

@PanelHandler()
class MomHudAmmoHandler {
	readonly panels = {
		ammoLabel: $<Label>('#AmmoLabel')
	};

	testAmmoCount: string;

	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: true,
			resizeY: false,
			gamemode: [
				...GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
				...GamemodeCategoryToGamemode.get(GamemodeCategory.RJ),
				...GamemodeCategoryToGamemode.get(GamemodeCategory.SJ),
				...GamemodeCategoryToGamemode.get(GamemodeCategory.CONC)
			],
			unhandledEvents: [
				{ event: 'LevelInitPostEntity', callbackFn: () => this.restoreRealAmmo() },
				{ event: 'HudCustomizer_Opened', callbackFn: () => this.createDummyAmmo() },
				{ event: 'HudCustomizer_Closed', callbackFn: () => this.restoreRealAmmo() }
			],
			dynamicStyles: {
				testAmmoCount: {
					name: 'Test Ammo Count',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.testAmmoCount = String(value);
						this.createDummyAmmo();
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
					targetPanel: '.ammo__label',
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.ammo__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.ammo__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						panel.style.textShadowFast = this.getAdjustedTextShadow(value as rgbaColor);
					}
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.ammo__label',
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
					targetPanel: '.ammo',
					styleProperty: 'horizontalAlign'
				}
			}
		});
	}

	createDummyAmmo() {
		this.panels.ammoLabel.text = this.testAmmoCount;
	}

	restoreRealAmmo() {
		this.panels.ammoLabel.SetTextWithDialogVariables('{i:ammoCount}');
	}

	getAdjustedTextShadow(color: rgbaColor) {
		const splitRGBA = splitRgbFromAlpha(color);
		return `0px 1px 1.5px 1 rgba(0, 0, 0, ${splitRGBA.alpha})`;
	}
}
