'use strict';

const DEPLOYED_CLASS = 'weaponselection__wrapper--deployed';
const FADEOUT_CLASS = 'weaponselection--fadeout';

class WeaponSelection {
	static container = $('#WeaponSelection');
	static wepSnippets = [];
	static lastDeployed = WEAPON_ID.NONE;

	static onWeaponStateChange(mode, id) {
		switch (mode) {
			case WEAPON_STATE_CHANGE_MODE.SWITCH:
				if (this.lastDeployed !== WEAPON_ID.NONE)
					this.wepSnippets[this.lastDeployed - 1]?.RemoveClass(DEPLOYED_CLASS);
				this.lastDeployed = id;
				this.wepSnippets[id - 1]?.AddClass(DEPLOYED_CLASS);
				break;
			case WEAPON_STATE_CHANGE_MODE.PICKUP:
				this.createWeaponPanel(id);
				this.container.SortChildrenOnAttribute('slot_index', false);
				break;
			case WEAPON_STATE_CHANGE_MODE.DROP:
				this.destroyWeaponPanel(id);
				break;
			default:
				$.Warning('Unknown weapon state change mode given to panorama weapon selection HUD!');
				break;
		}

		this.container.TriggerClass(FADEOUT_CLASS);
	}

	static onAllWeaponsDropped() {
		for (let id = WEAPON_ID.FIRST; id < WEAPON_ID.MAX; id++) {
			this.destroyWeaponPanel(id);
		}
	}

	static createWeaponPanel(id) {
		if (this.wepSnippets[id - 1]) return;

		const weaponPanel = $.CreatePanel('Panel', this.container, ''); // Create the new panel
		weaponPanel.SetDialogVariable('weapon', $.Localize(WEAPON_NAMES[id - 1]));
		weaponPanel.LoadLayoutSnippet('Weapon');

		const weaponSlot = MomentumWeaponAPI.GetWeaponSlot(id) + 1;
		let keybindPanel = weaponPanel.FindChildTraverse('WeaponKeyBind');
		if (weaponSlot >= 0) keybindPanel.SetTextWithDialogVariables(`{v:csgo_bind:e:bind_slot${weaponSlot}}`);
		else keybindPanel.visible = false;

		weaponPanel.SetAttributeInt('slot_index', weaponSlot);

		this.wepSnippets[id - 1] = weaponPanel;
	}

	static destroyWeaponPanel(id) {
		this.wepSnippets[id - 1]?.DeleteAsync(0.0);
		delete this.wepSnippets[id - 1];
	}

	static {
		$.RegisterForUnhandledEvent('OnMomentumWeaponStateChange', this.onWeaponStateChange.bind(this));
		$.RegisterForUnhandledEvent('OnAllMomentumWeaponsDropped', this.onAllWeaponsDropped.bind(this));
	}
}
