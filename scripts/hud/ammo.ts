import { PanelHandler } from 'util/module-helpers';
import { Gamemode, GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

@PanelHandler()
class MomHudAmmoHandler {
	readonly panels = {
		ammoLabel: $<Label>('#AmmoLabel')
	};

	testAmmoCount: string;

	constructor() {
		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => this.restoreRealAmmo());

		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => this.createDummyAmmo());
		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => this.restoreRealAmmo());

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: true,
			resizeY: false,
			gamemode: [
				Gamemode.RJ,
				Gamemode.SJ,
				Gamemode.CONC,
				...GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG)
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
				alignText: {
					name: 'Align Text',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.ammo',
					styleProperty: 'horizontalAlign',
					valueFn: (value) => {
						switch (value) {
							case 0:
								return 'left';
							case 1:
								return 'center';
							case 2:
								return 'right';
						}
					},
					settingProps: { min: 0, max: 2 }
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.ammo__label',
					styleProperty: 'fontFamily'
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.ammo__label',
					styleProperty: 'color'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.ammo__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.ammo__label',
					styleProperty: 'backgroundColor'
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
}
