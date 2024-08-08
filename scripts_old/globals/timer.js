"use strict";
var Timer;
(function (Timer) {
    let TimerEvent;
    (function (TimerEvent) {
        TimerEvent[TimerEvent["STARTED"] = 0] = "STARTED";
        TimerEvent[TimerEvent["FINISHED"] = 1] = "FINISHED";
        TimerEvent[TimerEvent["STOPPED"] = 2] = "STOPPED";
        TimerEvent[TimerEvent["FAILED"] = 3] = "FAILED";
    })(TimerEvent = Timer.TimerEvent || (Timer.TimerEvent = {}));
    let TimerState;
    (function (TimerState) {
        TimerState[TimerState["NOTRUNNING"] = 0] = "NOTRUNNING";
        TimerState[TimerState["RUNNING"] = 1] = "RUNNING";
        TimerState[TimerState["PRACTICE"] = 2] = "PRACTICE";
    })(TimerState = Timer.TimerState || (Timer.TimerState = {}));
})(Timer || (Timer = {}));
