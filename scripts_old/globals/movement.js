"use strict";
var Movement;
(function (Movement) {
    let PlayerMoveStatus;
    (function (PlayerMoveStatus) {
        PlayerMoveStatus[PlayerMoveStatus["AIR"] = 0] = "AIR";
        PlayerMoveStatus[PlayerMoveStatus["WALK"] = 1] = "WALK";
        PlayerMoveStatus[PlayerMoveStatus["WATER"] = 2] = "WATER";
        PlayerMoveStatus[PlayerMoveStatus["WATERJUMP"] = 3] = "WATERJUMP";
    })(PlayerMoveStatus = Movement.PlayerMoveStatus || (Movement.PlayerMoveStatus = {}));
    let MoveType;
    (function (MoveType) {
        MoveType[MoveType["NONE"] = 0] = "NONE";
        MoveType[MoveType["ISOMETRIC"] = 1] = "ISOMETRIC";
        MoveType[MoveType["WALK"] = 2] = "WALK";
        MoveType[MoveType["STEP"] = 3] = "STEP";
        MoveType[MoveType["FLY"] = 4] = "FLY";
        MoveType[MoveType["FLYGRAVITY"] = 5] = "FLYGRAVITY";
        MoveType[MoveType["VPHYSICS"] = 6] = "VPHYSICS";
        MoveType[MoveType["PUSH"] = 7] = "PUSH";
        MoveType[MoveType["NOCLIP"] = 8] = "NOCLIP";
        MoveType[MoveType["LADDER"] = 9] = "LADDER";
        MoveType[MoveType["OBSERVER"] = 10] = "OBSERVER";
        MoveType[MoveType["CUSTOM"] = 11] = "CUSTOM";
    })(MoveType = Movement.MoveType || (Movement.MoveType = {}));
    let DefragPhysics;
    (function (DefragPhysics) {
        DefragPhysics[DefragPhysics["VQ3"] = 0] = "VQ3";
        DefragPhysics[DefragPhysics["CPM"] = 1] = "CPM";
        DefragPhysics[DefragPhysics["VTG"] = 2] = "VTG";
    })(DefragPhysics = Movement.DefragPhysics || (Movement.DefragPhysics = {}));
})(Movement || (Movement = {}));
