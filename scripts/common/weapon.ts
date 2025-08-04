export enum WeaponStateChangeMode {
	SWITCH = 0,
	PICKUP = 1,
	DROP = 2
}

export enum WeaponID {
	NONE = 0,
	PISTOL = 1,
	SHOTGUN = 2,
	MACHINEGUN = 3,
	SNIPER = 4,
	GRENADE = 5,
	CONC = 6,
	KNIFE = 7,
	ROCKETLAUNCHER = 8,
	STICKYLAUNCHER = 9,
	DF_PLASMAGUN = 10,
	DF_ROCKETLAUNCHER = 11,
	DF_BFG = 12,
	DF_GRENADELAUNCHER = 13,
	DF_MACHINEGUN = 14,
	DF_RAILGUN = 15,
	DF_LIGHTNINGGUN = 16,
	DF_SHOTGUN = 17,
	DF_KNIFE = 18,
	CUBEMAP = 19
}

export const WeaponNames: ReadonlyMap<WeaponID, string> = new Map([
	[WeaponID.PISTOL, '#Weapon_Pistol'],
	[WeaponID.SHOTGUN, '#Weapon_Shotgun'],
	[WeaponID.MACHINEGUN, '#Weapon_MachineGun'],
	[WeaponID.SNIPER, '#Weapon_Sniper'],
	[WeaponID.GRENADE, '#Weapon_Grenade'],
	[WeaponID.CONC, '#Weapon_ConcGrenade'],
	[WeaponID.KNIFE, '#Weapon_Knife'],
	[WeaponID.ROCKETLAUNCHER, '#Weapon_RocketLauncher'],
	[WeaponID.STICKYLAUNCHER, '#Weapon_StickybombLauncher'],
	[WeaponID.DF_PLASMAGUN, '#Weapon_PlasmaGun'],
	[WeaponID.DF_ROCKETLAUNCHER, '#Weapon_RocketLauncher'],
	[WeaponID.DF_BFG, '#Weapon_BFG'],
	[WeaponID.DF_GRENADELAUNCHER, '#Weapon_GrenadeLauncher'],
	[WeaponID.DF_MACHINEGUN, '#Weapon_MachineGun'],
	[WeaponID.DF_RAILGUN, '#Weapon_Rail'],
	[WeaponID.DF_LIGHTNINGGUN, '#Weapon_LightningGun'],
	[WeaponID.DF_SHOTGUN, '#Weapon_Shotgun'],
	[WeaponID.DF_KNIFE, '#Weapon_Knife'],
	[WeaponID.CUBEMAP, '#Weapon_Cubemap']
]);
