"use strict";
var SteamLobby;
(function (SteamLobby) {
    let LobbyType;
    (function (LobbyType) {
        LobbyType[LobbyType["PRIVATE"] = 0] = "PRIVATE";
        LobbyType[LobbyType["FRIENDS"] = 1] = "FRIENDS";
        LobbyType[LobbyType["PUBLIC"] = 2] = "PUBLIC";
    })(LobbyType = SteamLobby.LobbyType || (SteamLobby.LobbyType = {}));
    // TODO: All of left/disconnected/kicked/banned are lumped into LEAVE here in C++, could distinguish.
    let MemberStateChange;
    (function (MemberStateChange) {
        MemberStateChange["JOIN"] = "join";
        MemberStateChange["LEAVE"] = "leave";
    })(MemberStateChange = SteamLobby.MemberStateChange || (SteamLobby.MemberStateChange = {}));
    // TODO: Localise `name`!
    SteamLobby.LobbyProperties = new Map([
        [LobbyType.PRIVATE, { name: 'Private Lobby', icon: 'privatelobby' }],
        [LobbyType.FRIENDS, { name: 'Friends Only Lobby', icon: 'friendslobby' }],
        [LobbyType.PUBLIC, { name: 'Public Lobby', icon: 'publiclobby' }]
    ]);
})(SteamLobby || (SteamLobby = {}));
