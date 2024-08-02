class WeaponSelection {
	static readonly DeployedClass = 'weaponselection__wrapper--deployed';
	static readonly FadeoutClass = 'weaponselection--fadeout';

	static container = $('#WeaponSelection');
	static weaponPanels: Map<Weapon.WeaponID, Panel> = new Map();
	static lastDeployed = Globals.Weapon.WeaponID.NONE;

	static onWeaponStateChange(mode: Weapon.WeaponStateChangeMode, id: Weapon.WeaponID) {
		switch (mode) {
			case Globals.Weapon.WeaponStateChangeMode.SWITCH:
				if (this.lastDeployed !== Globals.Weapon.WeaponID.NONE)
					this.weaponPanels.get(this.lastDeployed)?.RemoveClass(this.DeployedClass);
				this.lastDeployed = id;
				this.weaponPanels.get(id)?.AddClass(this.DeployedClass);
				break;
			case Globals.Weapon.WeaponStateChangeMode.PICKUP:
				this.createWeaponPanel(id);
				this.container.SortChildrenOnAttribute('slot_index', false);
				break;
			case Globals.Weapon.WeaponStateChangeMode.DROP:
				this.destroyWeaponPanel(id);
				break;
			default:
				$.Warning('Unknown weapon state change mode given to panorama weapon selection HUD!');
				break;
		}

		this.container.TriggerClass(FADEOUT_CLASS);
	}

	static onAllWeaponsDropped() {
		Globals.Util.Enum.values(Globals.Weapon.WeaponID).forEach((id) => this.destroyWeaponPanel(id));
	}

	static createWeaponPanel(id: Weapon.WeaponID) {
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

	static destroyWeaponPanel(id: Weapon.WeaponID) {
		this.weaponPanels.get(id)?.DeleteAsync(0);
		this.weaponPanels.delete(id);
	}

	static {
		$.RegisterForUnhandledEvent('OnMomentumWeaponStateChange', this.onWeaponStateChange.bind(this));
		$.RegisterForUnhandledEvent('OnAllMomentumWeaponsDropped', this.onAllWeaponsDropped.bind(this));
	}
}
