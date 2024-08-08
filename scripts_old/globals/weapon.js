"use strict";
var Weapon;
(function (Weapon) {
    let WeaponStateChangeMode;
    (function (WeaponStateChangeMode) {
        WeaponStateChangeMode[WeaponStateChangeMode["SWITCH"] = 0] = "SWITCH";
        WeaponStateChangeMode[WeaponStateChangeMode["PICKUP"] = 1] = "PICKUP";
        WeaponStateChangeMode[WeaponStateChangeMode["DROP"] = 2] = "DROP";
    })(WeaponStateChangeMode = Weapon.WeaponStateChangeMode || (Weapon.WeaponStateChangeMode = {}));
    let WeaponID;
    (function (WeaponID) {
        WeaponID[WeaponID["NONE"] = 0] = "NONE";
        WeaponID[WeaponID["PISTOL"] = 1] = "PISTOL";
        WeaponID[WeaponID["SHOTGUN"] = 2] = "SHOTGUN";
        WeaponID[WeaponID["MACHINEGUN"] = 3] = "MACHINEGUN";
        WeaponID[WeaponID["SNIPER"] = 4] = "SNIPER";
        WeaponID[WeaponID["GRENADE"] = 5] = "GRENADE";
        WeaponID[WeaponID["CONC"] = 6] = "CONC";
        WeaponID[WeaponID["KNIFE"] = 7] = "KNIFE";
        WeaponID[WeaponID["ROCKETLAUNCHER"] = 8] = "ROCKETLAUNCHER";
        WeaponID[WeaponID["STICKYLAUNCHER"] = 9] = "STICKYLAUNCHER";
        WeaponID[WeaponID["CUBEMAP"] = 10] = "CUBEMAP";
    })(WeaponID = Weapon.WeaponID || (Weapon.WeaponID = {}));
    Weapon.WeaponNames = new Map([
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
})(Weapon || (Weapon = {}));
