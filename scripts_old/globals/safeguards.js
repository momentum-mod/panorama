"use strict";
var Safeguards;
(function (Safeguards) {
    let RunSafeguardType;
    (function (RunSafeguardType) {
        RunSafeguardType[RunSafeguardType["PRACTICEMODE"] = 0] = "PRACTICEMODE";
        RunSafeguardType[RunSafeguardType["RESTART"] = 1] = "RESTART";
        RunSafeguardType[RunSafeguardType["RESTART_STAGE"] = 2] = "RESTART_STAGE";
        RunSafeguardType[RunSafeguardType["SAVELOC_TELE"] = 3] = "SAVELOC_TELE";
        RunSafeguardType[RunSafeguardType["CHAT_OPEN"] = 4] = "CHAT_OPEN";
        RunSafeguardType[RunSafeguardType["MAP_CHANGE"] = 5] = "MAP_CHANGE";
        RunSafeguardType[RunSafeguardType["QUIT_TO_MENU"] = 6] = "QUIT_TO_MENU";
        RunSafeguardType[RunSafeguardType["QUIT_GAME"] = 7] = "QUIT_GAME";
    })(RunSafeguardType = Safeguards.RunSafeguardType || (Safeguards.RunSafeguardType = {}));
})(Safeguards || (Safeguards = {}));
