"use strict";
var Buttons;
(function (Buttons) {
    let Button;
    (function (Button) {
        Button[Button["ATTACK"] = 1] = "ATTACK";
        Button[Button["JUMP"] = 2] = "JUMP";
        Button[Button["DUCK"] = 4] = "DUCK";
        Button[Button["FORWARD"] = 8] = "FORWARD";
        Button[Button["BACK"] = 16] = "BACK";
        Button[Button["USE"] = 32] = "USE";
        Button[Button["CANCEL"] = 64] = "CANCEL";
        Button[Button["LEFT"] = 128] = "LEFT";
        Button[Button["RIGHT"] = 256] = "RIGHT";
        Button[Button["MOVELEFT"] = 512] = "MOVELEFT";
        Button[Button["MOVERIGHT"] = 1024] = "MOVERIGHT";
        Button[Button["ATTACK2"] = 2048] = "ATTACK2";
        Button[Button["SCORE"] = 65536] = "SCORE";
        Button[Button["SPEED"] = 131072] = "SPEED";
        Button[Button["WALK"] = 262144] = "WALK";
        Button[Button["ZOOM"] = 524288] = "ZOOM";
        Button[Button["LOOKSPIN"] = 33554432] = "LOOKSPIN";
        Button[Button["BHOPDISABLED"] = 536870912] = "BHOPDISABLED";
        Button[Button["PAINT"] = 1073741824] = "PAINT";
        Button[Button["STRAFE"] = -2147483648] = "STRAFE";
    })(Button = Buttons.Button || (Buttons.Button = {}));
})(Buttons || (Buttons = {}));
