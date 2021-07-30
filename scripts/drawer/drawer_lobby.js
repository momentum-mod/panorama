"use strict";


class DrawerPanel_Lobby
{
    static lobbyListData = {};

    static lobbyMemberPanels = {};
    static lobbyData = {};

    static recreateListChildren()
    {
        const data = DrawerPanel_Lobby.lobbyListData;

        // We're only doing this every couple of secs max so we can afford to nuke everything
        $('#LobbyList').RemoveAndDeleteChildren();


        let known_ids = [];
        // The sort actually works out how we want it (c < f < g)
        Object.keys(data).sort().forEach( origin =>
        {
            Object.keys(data[origin]).forEach( lobby_steamid =>
            {
                // Prevent duplicate lobbies; we don't have duplicates for the same origin, but we might get the same lobby from 2 origins
                // UNDONE: Handle when a lobby moves from one type to the other (i.e. delete the old entry,
                // not a big deal though as we should normally get all the updates in quick succession
                if (known_ids.includes(lobby_steamid))
                    return;

                known_ids.push(lobby_steamid);
                const lobby_obj = data[origin][lobby_steamid];
                const owner_steamid = lobby_obj['owner'];
                const lobby_type = lobby_obj['type'];


                const newPanel = $.CreatePanel('Panel', $('#LobbyList'), '');
                newPanel.LoadLayoutSnippet('lobby-list-entry');
                newPanel.AddClass('lobby-list-entry-type-' + lobby_type);

                newPanel.FindChildTraverse('LobbyJoinButton').SetPanelEvent('onactivate', function()
                {
                    origin === 'current' ? DrawerPanel_Lobby.showLobbyDetails() : DrawerPanel_Lobby.join(lobby_steamid)
                });

                newPanel.FindChildTraverse('LobbyType').SetImage("file://{images}/lobby/lobbytype" + lobby_type + ".svg");
                newPanel.FindChildTraverse('LobbyPlayerAvatar').steamid = owner_steamid;
                newPanel.SetDialogVariable('owner_steamid', owner_steamid);
                newPanel.SetDialogVariable('lobby_type', lobby_type);
                newPanel.SetDialogVariable('lobby_title', FriendsAPI.GetNameForXUID(owner_steamid) + "'s Lobby");
                newPanel.SetDialogVariable('lobby_playercount', lobby_obj['members'] + "/" + lobby_obj['members_limit']);
                newPanel.SetDialogVariable('lobby_joinlabel', origin === 'current' ? "DETAILS" : "JOIN");
            })
        })
    }

    static onSteamLobbyListUpdated(data)
    {
        $.Msg(data);
        if (data === undefined)
            return;

        // friends or global
        const origin = Object.keys(data)[0];

        DrawerPanel_Lobby.lobbyListData[origin] = data[origin];

        DrawerPanel_Lobby.recreateListChildren();
    }

    static onSteamLobbyDataUpdated(data)
    {
        if ( data !== DrawerPanel_Lobby.lobbyData)
        {
            const oldtype = Object.keys(DrawerPanel_Lobby.lobbyData).length !== 0 ? DrawerPanel_Lobby.lobbyData[Object.keys(DrawerPanel_Lobby.lobbyData)[0]]['type'] : undefined;
            const newtype = data[Object.keys(data)[0]]['type'];
            if (oldtype !== newtype)
                $.DispatchEvent('OnLobbyButtonImageChange', "file://{images}/lobby/lobbytype" + newtype + ".svg");
        }
        DrawerPanel_Lobby.lobbyListData['current'] = data;
        DrawerPanel_Lobby.lobbyData = data;
        $.Msg("Lobby:");
        $.Msg(data);
        $.Msg("Lobby:");
    }

    static onSteamLobbyMemberDataUpdated(data)
    {
        $.Msg("Member:");
        $.Msg(data);
        $.Msg("End Member:");

        Object.keys(data).forEach( member_steamid => {
            let panel;
            panel = DrawerPanel_Lobby.lobbyMemberPanels[member_steamid];

            if(panel === undefined) {
                $.Msg('New Panel!!!!');
                panel = $.CreatePanel('Panel', $('#LobbyDetailsMemberList'), '');
                panel.LoadLayoutSnippet('lobby-member-entry');
                DrawerPanel_Lobby.lobbyMemberPanels[member_steamid] = panel;
            }

            panel.FindChildTraverse('MemberAvatar').steamid = member_steamid;

            panel.SetDialogVariable('member_name', FriendsAPI.GetNameForXUID(member_steamid));
            const member_map = data[member_steamid]['map'];
            panel.SetDialogVariable('member_map', member_map ? member_map : "In main menu");
            // UNDONE: Setup button properly (for now something like: if map == our map -> show join, otherwise hide

            const local_player_steamid = UserAPI.GetXUID();
            const local_map_data = MapCacheAPI.GetCurrentMapData();

            if (member_steamid !== local_player_steamid)
            {
                /* Currently I don't there's a reliable way to do this
                if (member_map && ( !local_map_data || member_map !== local_map_data['name'])) // Are they on a map and we are either not on one or a different one?
                {
                    panel.SetDialogVariable('member_joinlabel', "JOIN MAP");
                    panel.FindChildTraverse('MemberJoinButton').SetPanelEvent('onactivate', function()
                    {
                        // UNDONE: Map cache support
                        GameInterfaceAPI.ConsoleCommand("map " + member_map);
                    });
                }
                else if (member_map && member_map === local_map_data['name'])
                 */
                {
                    panel.SetDialogVariable('member_joinlabel', "SPECTATE");
                    panel.FindChildTraverse('MemberJoinButton').SetPanelEvent('onactivate', function()
                    {
                        // UNDONE: Map cache support
                        GameInterfaceAPI.ConsoleCommand("mom_spectate " + member_steamid);
                    });
                }
            }
            else
            {
                panel.FindChildTraverse('MemberJoinButton').AddClass('hidden');
            }
        })


    }

    static onSteamLobbyMemberStateChanged(member_steamid, changetype)
    {
        $.Msg("State:");
        $.Msg(member_steamid + " " + changetype);
        $.Msg("End State:");

        if (changetype === "leave")
        {
            delete DrawerPanel_Lobby.lobbyMemberPanels[member_steamid];
        }
    }

    static showLobbyDetails()
    {
        $('#LobbyListContainer').AddClass('hidden');
        $('#LobbyDetailsContainer').RemoveClass('hidden');
    }

    static showLobbyList()
    {
        DrawerPanel_Lobby.recreateListChildren();
        $('#LobbyListContainer').RemoveClass('hidden');
        $('#LobbyDetailsContainer').AddClass('hidden');
    }

    static join(steamid)
    {
        if (DrawerPanel_Lobby.lobbyListData['current'])
            SteamLobbyAPI.Leave();
        SteamLobbyAPI.Join(steamid);
    }

    static create()
    {
        if (DrawerPanel_Lobby.lobbyListData['current'])
            SteamLobbyAPI.Leave();
        SteamLobbyAPI.Create(0); // UNDONE: specify type
    }

    static onSteamLobbyStateChanged(newState)
    {
        $.Msg('newState');
        if (newState === "leave")
        {
            DrawerPanel_Lobby.lobbyMemberPanels = {};
            $('#LobbyDetailsMemberList').RemoveAndDeleteChildren();
            delete DrawerPanel_Lobby.lobbyListData['current'];
            DrawerPanel_Lobby.lobbyData = {};
        }
        DrawerPanel_Lobby.recreateListChildren();

        if (newState === "join")
        {
            DrawerPanel_Lobby.showLobbyDetails();
        }
        else if(newState === "leave")
        {
            DrawerPanel_Lobby.showLobbyList();
            $.DispatchEvent('OnLobbyButtonImageChange', "file://{images}/sidepanel/lobbyIcon.svg");
        }

    }

}

(function() {
    // Watch out: these callbacks work a bit different to Steamworks: We will only receive data for our own lobby automatically
    // And only the list update will give us anything else via OnListUpdated
    $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnListUpdated', DrawerPanel_Lobby.onSteamLobbyListUpdated);
    $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnDataUpdated', DrawerPanel_Lobby.onSteamLobbyDataUpdated);
    $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberDataUpdated', DrawerPanel_Lobby.onSteamLobbyMemberDataUpdated);
    $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberStateChanged', DrawerPanel_Lobby.onSteamLobbyMemberStateChanged);
    $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnLobbyStateChanged', DrawerPanel_Lobby.onSteamLobbyStateChanged);
    $.DefineEvent('OnLobbyButtonImageChange', 1);
})();