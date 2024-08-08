"use strict";
function getMainTrack(mapData, gamemode) {
    return mapData.leaderboards.find((leaderboard) => leaderboard.gamemode === gamemode &&
        leaderboard.trackType === Globals.Web.TrackType.MAIN &&
        leaderboard.style === 0);
}
function getNumZones(mapData) {
    return mapData.leaderboards.filter((leaderboard) => leaderboard.trackType === Globals.Web.TrackType.STAGE).length;
}
