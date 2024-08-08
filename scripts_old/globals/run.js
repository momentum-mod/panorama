"use strict";
/** JS classes and enums for handling runs, comparisons, etc. */
var Run;
(function (Run_1) {
    let RunEntityType;
    (function (RunEntityType) {
        RunEntityType[RunEntityType["PLAYER"] = 0] = "PLAYER";
        RunEntityType[RunEntityType["GHOST"] = 1] = "GHOST";
        RunEntityType[RunEntityType["REPLAY"] = 2] = "REPLAY";
        RunEntityType[RunEntityType["ONLINE"] = 3] = "ONLINE";
    })(RunEntityType = Run_1.RunEntityType || (Run_1.RunEntityType = {}));
    /** Enum for why end of run is being shown */
    let EorShowReason;
    (function (EorShowReason) {
        EorShowReason[EorShowReason["PLAYER_FINISHED_RUN"] = 0] = "PLAYER_FINISHED_RUN";
        EorShowReason[EorShowReason["REPLAY_FINISHED_RUN"] = 1] = "REPLAY_FINISHED_RUN";
        EorShowReason[EorShowReason["MANUALLY_SHOWN"] = 2] = "MANUALLY_SHOWN";
    })(EorShowReason = Run_1.EorShowReason || (Run_1.EorShowReason = {}));
    /** Enum for different run submission states */
    let RunStatusStates;
    (function (RunStatusStates) {
        RunStatusStates[RunStatusStates["PROGRESS"] = 0] = "PROGRESS";
        RunStatusStates[RunStatusStates["SUCCESS"] = 1] = "SUCCESS";
        RunStatusStates[RunStatusStates["ERROR"] = 2] = "ERROR";
    })(RunStatusStates = Run_1.RunStatusStates || (Run_1.RunStatusStates = {}));
    /** Enum for types of submission status */
    let RunStatusTypes;
    (function (RunStatusTypes) {
        RunStatusTypes[RunStatusTypes["PROGRESS"] = 0] = "PROGRESS";
        RunStatusTypes[RunStatusTypes["UPLOAD"] = 1] = "UPLOAD";
        RunStatusTypes[RunStatusTypes["SAVE"] = 2] = "SAVE";
        RunStatusTypes[RunStatusTypes["ERROR"] = 3] = "ERROR";
    })(RunStatusTypes = Run_1.RunStatusTypes || (Run_1.RunStatusTypes = {}));
    /** Enum settings the icons for run statuses */
    let RunStatusIcons;
    (function (RunStatusIcons) {
        RunStatusIcons["PROGRESS"] = "refresh";
        RunStatusIcons["UPLOAD"] = "cloud-upload";
        RunStatusIcons["SAVE"] = "content-save-check";
        RunStatusIcons["ERROR"] = "alert-octagon";
    })(RunStatusIcons = Run_1.RunStatusIcons || (Run_1.RunStatusIcons = {}));
    /** Friendly JavaScript representation of a C++ Run object. */
    class Run {
        mapName;
        mapHash;
        playerName;
        steamID;
        date;
        tickInterval;
        time;
        startTick;
        endTime;
        runFlags;
        trackNum;
        zoneNum;
        numZones;
        stats;
        constructor(runObject) {
            this.mapName = runObject.mapName;
            this.mapHash = runObject.mapHash;
            this.playerName = runObject.playerName;
            this.steamID = runObject.steamID;
            this.date = runObject.date;
            this.tickInterval = runObject.tickInterval;
            this.time = runObject.runTime;
            this.startTick = runObject.startTick;
            this.endTime = runObject.endTime;
            this.runFlags = runObject.runFlags;
            this.trackNum = runObject.trackNum;
            this.zoneNum = runObject.zoneNum;
            this.numZones = runObject.stats.numZones;
            this.stats = new RunStats(runObject.stats, this.tickInterval);
        }
    }
    Run_1.Run = Run;
    class RunStats {
        zones;
        overallZone;
        /**
         * @param runStatsObj - Ugly JSO from C++. Could perhaps create this better in C++ in future to avoid this.
         * @param {number} tickInterval
         * @param {number} limit - Limit to number of zones to process. -1 for all.
         */
        constructor(runStatsObj, tickInterval, limit = -1) {
            this.zones = [];
            // Start at 1 to skip overall zones
            for (let i = 1; i <= (limit === -1 ? runStatsObj.numZones : limit); i++) {
                const time = runStatsObj.times.values[i] * tickInterval;
                this.zones.push({
                    name: i.toString(),
                    accumulateTime: (i > 1 ? this.zones[i - 2].accumulateTime : 0) + time, // Offset index by extra -1, i tracks times.values so is +1 ahead
                    time,
                    stats: runStatsObj.statsObjects.map((stat) => ({
                        name: stat.name,
                        value: stat.values[i],
                        unit: stat.unit
                    }))
                });
            }
            this.overallZone = {
                name: 'Overall',
                accumulateTime: runStatsObj.times.values[0] * tickInterval,
                time: runStatsObj.times.values[0] * tickInterval,
                stats: runStatsObj.statsObjects.map((stat) => ({
                    name: stat.name,
                    value: stat.values[0],
                    unit: stat.unit
                }))
            };
        }
    }
    Run_1.RunStats = RunStats;
    class Comparison {
        baseRun;
        comparisonRun;
        diff;
        basePlayerName;
        comparisonPlayerName;
        splits;
        overallSplit;
        constructor(baseRun, comparisonRun) {
            this.baseRun = baseRun;
            this.comparisonRun = comparisonRun;
            this.diff = this.baseRun.time - this.comparisonRun.time;
            this.basePlayerName = baseRun.playerName;
            this.comparisonPlayerName = comparisonRun.playerName;
            this.splits = Comparison.generateSplits(baseRun.stats, comparisonRun.stats);
            this.overallSplit = {
                // This gets used as a panel ID, so don't include the hash. $.Localize call works fine without it.
                name: 'Run_Comparison_Split_Overall',
                accumulateTime: baseRun.stats.overallZone.accumulateTime,
                time: baseRun.stats.overallZone.accumulateTime,
                diff: baseRun.stats.overallZone.accumulateTime - comparisonRun.stats.overallZone.accumulateTime,
                delta: baseRun.stats.overallZone.accumulateTime - comparisonRun.stats.overallZone.accumulateTime,
                statsComparisons: baseRun.stats.overallZone.stats.map((stat, j) => new RunStatsComparison(stat, comparisonRun.stats.overallZone.stats[j]))
            };
        }
        static generateSplits(baseRunStats, comparisonRunStats) {
            return baseRunStats.zones.map((baseZone, i) => {
                const compareZone = comparisonRunStats.zones[i];
                return {
                    name: (i + 1).toString(),
                    accumulateTime: baseZone.accumulateTime,
                    time: baseZone.time,
                    diff: baseZone.accumulateTime - compareZone.accumulateTime,
                    delta: baseZone.time - compareZone.time,
                    statsComparisons: baseZone.stats.map((stat, j) => new RunStatsComparison(stat, compareZone.stats[j]))
                };
            });
        }
    }
    Run_1.Comparison = Comparison;
    class RunStatsComparison {
        name;
        unit;
        baseValue;
        comparisonValue;
        diff;
        constructor(baseStat, comparisonStat) {
            this.name = baseStat.name;
            this.unit = baseStat.unit;
            this.baseValue = baseStat.value;
            this.comparisonValue = comparisonStat.value;
            this.diff = baseStat.value - comparisonStat.value;
        }
    }
    Run_1.RunStatsComparison = RunStatsComparison;
})(Run || (Run = {}));
