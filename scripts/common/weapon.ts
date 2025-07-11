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
	CUBEMAP = 10
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
	[WeaponID.CUBEMAP, '#Weapon_Cubemap']
]);
