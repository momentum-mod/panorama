"use strict";
var State;
(function (State) {
    let GameUIState;
    (function (GameUIState) {
        GameUIState[GameUIState["INVALID"] = 0] = "INVALID";
        GameUIState[GameUIState["LOADINGSCREEN"] = 1] = "LOADINGSCREEN";
        GameUIState[GameUIState["INGAME"] = 2] = "INGAME";
        GameUIState[GameUIState["MAINMENU"] = 3] = "MAINMENU";
        GameUIState[GameUIState["PAUSEMENU"] = 4] = "PAUSEMENU";
        GameUIState[GameUIState["INTROMOVIE"] = 5] = "INTROMOVIE";
    })(GameUIState = State.GameUIState || (State.GameUIState = {}));
    /**
     * Bitflags of different HUD types to associate with hiding this panel.
     * @example
     * panel.hiddenHUDBits = Globals.State.HideHud.TABMENU //  hide the panel when the tab menu is open.
     */
    let HideHud;
    (function (HideHud) {
        HideHud[HideHud["WEAPONSELECTION"] = 1] = "WEAPONSELECTION";
        HideHud[HideHud["FLASHLIGHT"] = 2] = "FLASHLIGHT";
        HideHud[HideHud["ALL"] = 4] = "ALL";
        HideHud[HideHud["HEALTH"] = 8] = "HEALTH";
        HideHud[HideHud["PLAYERDEAD"] = 16] = "PLAYERDEAD";
        HideHud[HideHud["NEEDSUIT"] = 32] = "NEEDSUIT";
        HideHud[HideHud["MISCSTATUS"] = 64] = "MISCSTATUS";
        HideHud[HideHud["CHAT"] = 128] = "CHAT";
        HideHud[HideHud["CROSSHAIR"] = 256] = "CROSSHAIR";
        HideHud[HideHud["VEHICLE_CROSSHAIR"] = 512] = "VEHICLE_CROSSHAIR";
        HideHud[HideHud["INVEHICLE"] = 1024] = "INVEHICLE";
        HideHud[HideHud["BONUS_PROGRESS"] = 2048] = "BONUS_PROGRESS";
        HideHud[HideHud["RADAR"] = 4096] = "RADAR";
        HideHud[HideHud["MINISCOREBOARD"] = 8192] = "MINISCOREBOARD";
        HideHud[HideHud["TABMENU"] = 16384] = "TABMENU"; // "Leaderboards" in some places, renaming for momenutm
    })(HideHud = State.HideHud || (State.HideHud = {}));
})(State || (State = {}));
