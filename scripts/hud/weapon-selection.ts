import { PanelHandler } from 'util/module-helpers';
import { WeaponID, WeaponNames, WeaponStateChangeMode } from 'common/weapon';
import { registerHUDCustomizerComponent, CustomizerPropertyType } from 'common/hud-customizer';
import { splitRgbFromAlpha } from 'util/colors';
import * as Enum from 'util/enum';

const FADEOUT_CLASS = 'weaponselection--fadeout';
const SHOW_CLASS = 'weaponselection--show';
const DEPLOYED_CLASS = 'weaponselection__wrapper--deployed';

const Config = {
	_isCustomizerOpened: false,
	fadeout: true,
	showKeybinds: true,
	showNotch: true,
	keybinds: {
		font: 'Bebas Neue Momentum',
		size: 24,
		color: 'rgba(213, 213, 213, 1)',
		activeColor: 'rgba(255, 255, 255, 1)'
	},
	weapon_name: {
		font: 'Bebas Neue Momentum',
		size: 24,
		color: 'rgba(255, 255, 255, 1)',
		activeColor: 'rgba(87, 200, 255, 1)'
	},
	notch: {
		width: 4,
		color: 'rgba(87, 200, 255, 1)'
	}
};

@PanelHandler()
class WeaponSelectionHandler {
	container = $('#WeaponSelection_Wrapper');
	weaponPanels: Map<WeaponID, Panel> = new Map();
	lastDeployed = WeaponID.NONE;

	constructor() {
		$.RegisterForUnhandledEvent('OnMomentumWeaponStateChange', (state, weaponID) =>
			this.onWeaponStateChange(state, weaponID)
		);
		$.RegisterForUnhandledEvent('OnAllMomentumWeaponsDropped', () => this.onAllWeaponsDropped());

		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => {
			Config._isCustomizerOpened = true;
			this.setFadeout();
		});
		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => {
			Config._isCustomizerOpened = false;
			this.setFadeout();
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			// TODO: Add switching sides for the notch, gotta figure out the css
			dynamicStyles: {
				fadeout: {
					name: 'Fadeout',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						Config.fadeout = value;
						this.setFadeout();
					}
				},
				showNotch: {
					name: 'Show Notch',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						Config.showNotch = value;
						this.updateStyles();
					}
				},
				showKeybinds: {
					name: 'Show Keybinds',
					type: CustomizerPropertyType.CHECKBOX,
					children: [{ styleID: 'keybindsStyling', showWhen: true }],
					callbackFunc: (_, value) => {
						Config.showKeybinds = value;
						this.updateStyles();
					}
				},
				keybindsStyling: {
					name: 'Keybinds Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'keybindsFont' },
						{ styleID: 'keybindsFontSize' },
						{ styleID: 'keybindsFontColor' },
						{ styleID: 'keybindsFontActiveColor' }
					]
				},
				keybindsFont: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => {
						Config.keybinds.font = value;
						this.updateStyles();
					}
				},
				keybindsFontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.keybinds.size = value;
						this.updateStyles();
					}
				},
				keybindsFontColor: {
					name: 'Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.keybinds.color = value;
						this.updateStyles();
					}
				},
				keybindsFontActiveColor: {
					name: 'Active Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.keybinds.activeColor = value;
						this.updateStyles();
					}
				},
				weaponNameStyling: {
					name: 'Weapon Name Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'weaponNameFont' },
						{ styleID: 'weaponNameFontSize' },
						{ styleID: 'weaponNameFontColor' },
						{ styleID: 'weaponNameFontActiveColor' }
					]
				},
				weaponNameFont: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => {
						Config.weapon_name.font = value;
						this.updateStyles();
					}
				},
				weaponNameFontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.weapon_name.size = value;
						this.updateStyles();
					}
				},
				weaponNameFontColor: {
					name: 'Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.weapon_name.color = value;
						this.updateStyles();
					}
				},
				weaponNameFontActiveColor: {
					name: 'Active Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.weapon_name.activeColor = value;
						this.updateStyles();
					}
				},
				notchStyling: {
					name: 'Notch Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'notchWidth' }, { styleID: 'notchColor' }]
				},
				notchWidth: {
					name: 'Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.notch.width = value;
						this.updateStyles();
					}
				},
				notchColor: {
					name: 'Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.notch.color = value;
						this.updateStyles();
					}
				}
			}
		});
	}

	onWeaponStateChange(mode: WeaponStateChangeMode, id: WeaponID) {
		switch (mode) {
			case WeaponStateChangeMode.SWITCH:
				if (this.lastDeployed !== WeaponID.NONE)
					this.weaponPanels.get(this.lastDeployed)?.RemoveClass(DEPLOYED_CLASS);

				this.lastDeployed = id;
				this.weaponPanels.get(id)?.AddClass(DEPLOYED_CLASS);
				this.updateStyles();
				break;
			case WeaponStateChangeMode.PICKUP:
				this.createWeaponPanel(id);
				this.container.SortChildrenOnAttribute('slot_index', false);
				break;
			case WeaponStateChangeMode.DROP:
				this.destroyWeaponPanel(id);
				break;
			default:
				$.Warning('Unknown weapon state change mode given to panorama weapon selection HUD!');
				break;
		}

		this.setFadeout();
	}

	onAllWeaponsDropped() {
		Enum.fastValuesNumeric(WeaponID).forEach((id) => this.destroyWeaponPanel(id));
	}

	createWeaponPanel(id: WeaponID) {
		if (this.weaponPanels.has(id)) return;

		// If weapon doesn't have a slot we have no way of switching to it so may as well not show
		const weaponSlot = MomentumWeaponAPI.GetWeaponSlot(id);
		if (weaponSlot === -1) {
			$.Warning(`Weapon ${id} does not have a valid slot, not creating panel!`);
			return;
		}

		const weaponPanel = $.CreatePanel('Panel', this.container, '');
		weaponPanel.SetDialogVariable('weapon', $.Localize(WeaponNames.get(id)));
		weaponPanel.LoadLayoutSnippet('Weapon');

		const keybindPanel = weaponPanel.FindChildTraverse<Label>('WeaponKeyBind');

		keybindPanel.SetTextWithDialogVariables(`{v:csgo_bind:e:bind_slot${weaponSlot + 1}}`);
		weaponPanel.SetAttributeInt('slot_index', weaponSlot);

		this.weaponPanels.set(id, weaponPanel);

		this.updateStyles();
	}

	setFadeout() {
		if (Config._isCustomizerOpened || !Config.fadeout) {
			this.container.AddClass(SHOW_CLASS);
		} else {
			this.container.RemoveClass(SHOW_CLASS);
			this.container.TriggerClass(FADEOUT_CLASS);
		}
	}

	updateStyles() {
		this.weaponPanels.forEach((panel) => {
			const notch = panel.GetChild(0);
			const keybind = panel.GetChild(1).GetFirstChild();
			const weaponName = panel.GetChild(2);

			notch.style.width = `${Config.notch.width}px`;
			notch.style.backgroundColor = Config.notch.color as color;

			if (panel.HasClass(DEPLOYED_CLASS)) {
				panel.style.transform = Config.showNotch ? 'translateX(0)' : `translateX(${Config.notch.width}px)`;
				keybind.style.color = Config.keybinds.activeColor;
				keybind.style.textShadow = this.getAdjustedTextShadow(Config.keybinds.activeColor as rgbaColor);
				weaponName.style.color = Config.weapon_name.activeColor;
				weaponName.style.textShadow = this.getAdjustedTextShadow(Config.weapon_name.activeColor as rgbaColor);
			} else {
				panel.style.transform = `translateX(${Config.notch.width}px)`;
				keybind.style.color = Config.keybinds.color;
				keybind.style.textShadow = this.getAdjustedTextShadow(Config.keybinds.color as rgbaColor);
				weaponName.style.color = Config.weapon_name.color;
				weaponName.style.textShadow = this.getAdjustedTextShadow(Config.weapon_name.color as rgbaColor);
			}

			keybind.style.visibility = Config.showKeybinds ? 'visible' : 'collapse';
			if (Config.showKeybinds) {
				keybind.style.fontFamily = Config.keybinds.font;
				keybind.style.fontSize = `${Config.keybinds.size}px`;
			}

			weaponName.style.fontFamily = Config.weapon_name.font;
			weaponName.style.fontSize = `${Config.weapon_name.size}px`;
		});
	}

	destroyWeaponPanel(id: WeaponID) {
		this.weaponPanels.get(id)?.DeleteAsync(0);
		this.weaponPanels.delete(id);
	}

	getAdjustedTextShadow(color: rgbaColor) {
		const splitRGBA = splitRgbFromAlpha(color);
		return `0px 1px 1.5px 1 rgba(0, 0, 0, ${splitRGBA.alpha})`;
	}
}
