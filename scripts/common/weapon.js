'use strict';

const WEAPON_STATE_CHANGE_MODE = {
	SWITCH: 0,
	PICKUP: 1,
	DROP: 2
};

const WEAPON_ID = {
	NONE: 0,

	PISTOL: 1,
	SHOTGUN: 2,
	MACHINEGUN: 3,
	SNIPER: 4,
	GRENADE: 5,
	CONC: 6,
	KNIFE: 7,
	ROCKETLAUNCHER: 8,
	STICKYLAUNCHER: 9,
	CUBEMAP: 10,

	MAX: 11,
	FIRST: 1
};

const WEAPON_NAMES = [
	'#Weapon_Pistol',
	'#Weapon_Shotgun',
	'#Weapon_MachineGun',
	'#Weapon_Sniper',
	'#Weapon_Grenade',
	'#Weapon_ConcGrenade',
	'#Weapon_Knife',
	'#Weapon_RocketLauncher',
	'#Weapon_StickybombLauncher',
	'#Weapon_Cubemap'
];
