class WeaponSelection {
readonly DeployedClass = 'weaponselection__wrapper--deployed';
readonly FadeoutClass = 'weaponselection--fadeout';

container = $('#WeaponSelection');
weaponPanels: Map<Weapon.WeaponID, Panel> = new Map();
lastDeployed = _.Weapon.WeaponID.NONE;

onWeaponStateChange(mode: Weapon.WeaponStateChangeMode, id: Weapon.WeaponID) {
		switch (mode) {
			case _.Weapon.WeaponStateChangeMode.SWITCH:
				if (this.lastDeployed !== _.Weapon.WeaponID.NONE)
					this.weaponPanels.get(this.lastDeployed)?.RemoveClass(this.DeployedClass);
				this.lastDeployed = id;
				this.weaponPanels.get(id)?.AddClass(this.DeployedClass);
				break;
			case _.Weapon.WeaponStateChangeMode.PICKUP:
				this.createWeaponPanel(id);
				this.container.SortChildrenOnAttribute('slot_index', false);
				break;
			case _.Weapon.WeaponStateChangeMode.DROP:
				this.destroyWeaponPanel(id);
				break;
			default:
				$.Warning('Unknown weapon state change mode given to panorama weapon selection HUD!');
				break;
		}

		this.container.TriggerClass(FADEOUT_CLASS);
	}

onAllWeaponsDropped() {
		_.Util.Enum.values(_.Weapon.WeaponID).forEach((id) => this.destroyWeaponPanel(id));
	}

createWeaponPanel(id: Weapon.WeaponID) {
		if (this.weaponPanels.has(id)) return;

		const weaponPanel = $.CreatePanel('Panel', this.container, ''); // Create the new panel
		weaponPanel.SetDialogVariable('weapon', $.Localize(Weapon.WeaponNames.get(id)));
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

destroyWeaponPanel(id: Weapon.WeaponID) {
		this.weaponPanels.get(id)?.DeleteAsync(0);
		this.weaponPanels.delete(id);
	}

constructor() {
		$.RegisterForUnhandledEvent('OnMomentumWeaponStateChange', this.onWeaponStateChange.bind(this));
		$.RegisterForUnhandledEvent('OnAllMomentumWeaponsDropped', this.onAllWeaponsDropped.bind(this));
	}
}
