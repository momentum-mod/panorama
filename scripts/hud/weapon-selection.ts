import { PanelHandler } from 'util/module-helpers';
import { WeaponID, WeaponNames, WeaponStateChangeMode } from 'common/weapon';
import * as Enum from 'util/enum';

const FADEOUT_CLASS = 'weaponselection--fadeout';
const DEPLOYED_CLASS = 'weaponselection__wrapper--deployed';

@PanelHandler()
class WeaponSelectionHandler {
	container = $('#WeaponSelection');
	weaponPanels: Map<WeaponID, Panel> = new Map();
	lastDeployed = WeaponID.NONE;

	constructor() {
		$.RegisterForUnhandledEvent('OnMomentumWeaponStateChange', (state, weaponID) =>
			this.onWeaponStateChange(state, weaponID)
		);
		$.RegisterForUnhandledEvent('OnAllMomentumWeaponsDropped', () => this.onAllWeaponsDropped());
	}

	onWeaponStateChange(mode: WeaponStateChangeMode, id: WeaponID) {
		switch (mode) {
			case WeaponStateChangeMode.SWITCH:
				if (this.lastDeployed !== WeaponID.NONE)
					this.weaponPanels.get(this.lastDeployed)?.RemoveClass(DEPLOYED_CLASS);
				this.lastDeployed = id;
				this.weaponPanels.get(id)?.AddClass(DEPLOYED_CLASS);
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

		this.container.TriggerClass(FADEOUT_CLASS);
	}

	onAllWeaponsDropped() {
		Enum.fastValuesNumeric(WeaponID).forEach((id) => this.destroyWeaponPanel(id));
	}

	createWeaponPanel(id: WeaponID) {
		if (this.weaponPanels.has(id)) return;

		const weaponPanel = $.CreatePanel('Panel', this.container, ''); // Create the new panel
		weaponPanel.SetDialogVariable('weapon', $.Localize(WeaponNames.get(id)));
		weaponPanel.LoadLayoutSnippet('Weapon');

		const weaponSlot = MomentumWeaponAPI.GetWeaponSlot(id) + 1;
		const keybindPanel = weaponPanel.FindChildTraverse<Label>('WeaponKeyBind');
		if (weaponSlot >= 0) {
			keybindPanel.SetTextWithDialogVariables(`{v:csgo_bind:e:bind_slot${weaponSlot}}`);
		} else {
			keybindPanel.visible = false;
		}

		weaponPanel.SetAttributeInt('slot_index', weaponSlot);

		this.weaponPanels.set(id, weaponPanel);
	}

	destroyWeaponPanel(id: WeaponID) {
		this.weaponPanels.get(id)?.DeleteAsync(0);
		this.weaponPanels.delete(id);
	}
}
