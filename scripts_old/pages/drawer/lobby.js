"use strict";
class Lobby {
    static lobbyCurrentData = {};
    static lobbyListData = {};
    static lobbyMemberData = {};
    static isRefreshHovered;
    static refreshCooldown = 10;
    static panels = {
        search: $('#LobbySearch'),
        searchClearButton: $('#LobbySearchClearButton'),
        refreshButton: $('#LobbyRefreshButton'),
        refreshIcon: $('#LobbyRefreshIcon'),
        list: $('#LobbyList'),
        listContainer: $('#LobbyListContainer'),
        details: $('#LobbyDetailsContainer'),
        detailsType: $('#LobbyDetailsType'),
        detailsTitle: $('#LobbyDetailsTitle'),
        detailsPlayerCount: $('#LobbyDetailsPlayerCount'),
        detailsSettingsButton: $('#LobbyDetailsSettingsButton'),
        detailsMemberList: $('#LobbyDetailsMemberList')
    };
    static {
        // Watch out: these callbacks work a bit different to Steamworks: We will only receive data for our own lobby automatically
        // And only the list update will give us anything else via OnListUpdated
        $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnListUpdated', (lobbyList) => this.onSteamLobbyListUpdated(lobbyList));
        $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnDataUpdated', (lobbyData) => this.onSteamLobbyDataUpdated(lobbyData));
        $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberDataUpdated', (memberData) => this.onSteamLobbyMemberDataUpdated(memberData));
        $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberStateChanged', (steamID, changeType) => this.onSteamLobbyMemberStateChanged(steamID, changeType));
        $.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnLobbyStateChanged', (newState) => this.onSteamLobbyStateChanged(newState));
        $.RegisterForUnhandledEvent('PanoramaComponent_Chat_OnPlayerMuted', (steamID) => this.onPlayerMuted(steamID));
        $.RegisterForUnhandledEvent('RefreshLobbyList', this.refreshLobbyList.bind(this));
        this.panels.search.SetPanelEvent('ontextentrychanged', this.recreateLobbyListChildren.bind(this));
    }
    /**
     * Join the lobby with the given id, warning the user if they're currently in a lobby
     * @param {number} steamID
     */
    static join(steamID) {
        const leaveAndJoinCheck = (message) => {
            UiToolkitAPI.ShowGenericPopupOkCancel($.Localize('#Lobby_Leave'), message, 'ok-cancel-popup', () => {
                SteamLobbyAPI.Leave();
                SteamLobbyAPI.Join(steamID);
            }, () => { });
        };
        if (this.isInLobby()) {
            if (this.isLobbyOwner() && this.getLobbyMemberCount() > 1) {
                leaveAndJoinCheck($.Localize('#Lobby_TransferWarning'));
            }
            else {
                leaveAndJoinCheck($.Localize('#Lobby_LeaveWarning'));
            }
        }
        else {
            SteamLobbyAPI.Join(steamID);
        }
    }
    /**
     * Leave the current lobby, warning the user if they're the owner
     */
    static leave() {
        if (this.isLobbyOwner() && this.getLobbyMemberCount() > 1) {
            UiToolkitAPI.ShowGenericPopupOkCancel($.Localize('#Lobby_Leave'), $.Localize('#Lobby_TransferWarning'), 'ok-cancel-popup', () => SteamLobbyAPI.Leave(), () => { });
        }
        else {
            SteamLobbyAPI.Leave();
        }
    }
    /**
     * Show the lobby creation popup
     */
    static create() {
        UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/modals/popups/lobby-create.xml', 'isinlobby=' + +this.isInLobby() + '&islobbyowner=' + +this.isLobbyOwner() // Cast to int to pass as attribute
        );
    }
    /**
     * Show the lobby settings popup
     */
    static showLobbySettings() {
        const lobbyData = Object.values(this.lobbyCurrentData)[0];
        UiToolkitAPI.ShowCustomLayoutPopupParameters('', 'file://{resources}/layout/modals/popups/lobby-settings.xml', 'type=' + lobbyData['type'] + '&maxplayers=' + lobbyData['members_limit']);
    }
    /**
     * Switch to the lobby details panel
     */
    static showLobbyDetails() {
        this.panels.details.RemoveClass('lobby__lobby-details--hidden');
        this.panels.listContainer.AddClass('lobby__lobby-list--hidden');
    }
    /**
     * Switch to the lobby list panel
     */
    static showLobbyList() {
        this.panels.listContainer.RemoveClass('lobby__lobby-list--hidden');
        this.panels.details.AddClass('lobby__lobby-details--hidden');
        this.recreateLobbyListChildren();
    }
    /**
     * Request a lobby refresh, then put the button on cooldown
     */
    static refreshLobbyList() {
        if (SteamLobbyAPI.RefreshList({})) {
            this.panels.refreshIcon.AddClass('spin-clockwise'); // Removed when onSteamLobbyListUpdated is called
            this.panels.refreshButton.enabled = false;
            $.Schedule(this.refreshCooldown, () => (this.panels.refreshButton.enabled = true));
            let cooldown = this.refreshCooldown;
            let isRefreshHovered;
            const cooldownMessage = () => UiToolkitAPI.ShowTextTooltip(this.panels.refreshButton.id, $.Localize('#Lobby_RefreshCooldown').replace('%cooldown%', cooldown.toString()));
            const cooldownTimer = () => {
                if (isRefreshHovered)
                    cooldownMessage();
                this.panels.refreshButton.SetPanelEvent('onmouseover', () => {
                    isRefreshHovered = true;
                    cooldownMessage();
                });
                this.panels.refreshButton.SetPanelEvent('onmouseout', () => {
                    isRefreshHovered = false;
                    UiToolkitAPI.HideTextTooltip();
                });
                cooldown -= 1;
                if (cooldown >= 0)
                    $.Schedule(1, () => cooldownTimer());
                else {
                    this.panels.refreshButton.ClearPanelEvent('onmouseover');
                    this.panels.refreshButton.ClearPanelEvent('onmouseout');
                    if (isRefreshHovered)
                        UiToolkitAPI.HideTextTooltip();
                }
            };
            cooldownTimer();
        }
    }
    /**
     * Nuke the lobby list and recreate it
     * This should probably be a DelayLoadList??
     */
    static recreateLobbyListChildren() {
        this.panels.searchClearButton.SetHasClass('search__clearicon--hidden', this.panels.search.text === '');
        // Clear the current list
        this.panels.list.RemoveAndDeleteChildren();
        const data = this.lobbyListData;
        const knownIDs = [];
        Object.entries([data.current, data.friends, data.global]).forEach(([origin, list]) => {
            Object.entries(list)
                .sort(([_, { members: a }], [__, { members: b }]) => b - a)
                .filter(([lobbySteamID, __]) => !knownIDs.includes(lobbySteamID))
                .forEach(([lobbySteamID, lobbyData]) => {
                knownIDs.push(lobbySteamID);
                const ownerSteamID = lobbyData.owner;
                const lobbyType = lobbyData.type;
                const lobbyName = $.Localize('#Lobby_Owner').replace('%owner%', FriendsAPI.GetNameForXUID(+ownerSteamID));
                // Only show items that match the search. Always true if search is empty
                if (!lobbyName.includes(this.panels.search.text)) {
                    return;
                }
                const newPanel = $.CreatePanel('Panel', this.panels.list, ''); // Create the new panel
                newPanel.LoadLayoutSnippet('lobby-list-entry');
                const joinCallback = () => origin === 'current' ? this.showLobbyDetails() : this.join(ownerSteamID);
                newPanel.SetPanelEvent('ondblclick', joinCallback);
                newPanel.FindChildTraverse('LobbyJoinButton').SetPanelEvent('onactivate', joinCallback);
                const typePanel = newPanel.FindChildTraverse('LobbyType');
                const typeProps = _.SteamLobby.LobbyProperties.get(+lobbyType);
                const typeIcon = `file://{images}/online/${typeProps.icon}.svg`;
                typePanel.SetImage(typeIcon);
                typePanel.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTitleImageTextTooltipStyled(typePanel.id, '', typeIcon, typeProps.name, 'tooltip--notitle'));
                const avatarPanel = newPanel.FindChildTraverse('LobbyPlayerAvatar');
                avatarPanel.steamid = ownerSteamID;
                avatarPanel.SetPanelEvent('oncontextmenu', () => UiToolkitAPI.ShowSimpleContextMenu('', '', [
                    {
                        label: $.Localize('#Action_ShowSteamProfile'),
                        icon: 'file://{images}/social/steam.svg',
                        style: 'icon-color-steam-online',
                        jsCallback: () => SteamOverlayAPI.OpenToProfileID(ownerSteamID)
                    }
                ]));
                newPanel.SetDialogVariable('lobbyTitle', lobbyName);
                newPanel.SetDialogVariable('lobbyPlayerCount', `${lobbyData['members']}/${lobbyData['members_limit']}`);
                newPanel.SetDialogVariable('lobbyJoinLabel', $.Localize(origin === 'current' ? '#Lobby_Details' : '#Lobby_Join'));
                const originPanel = newPanel.FindChildTraverse('LobbyOrigin');
                originPanel.AddClass(`lobby-lobbies__origin--${origin}`);
            });
        });
    }
    /**
     * Update the lobbies details view based on current lobby state
     */
    static updateCurrentLobbyDetails() {
        const lobbyData = Object.values(this.lobbyCurrentData)[0];
        const owner = +lobbyData['owner'];
        const type = +lobbyData['type'];
        this.panels.detailsType.SetImage(`file://{images}/online/${_.SteamLobby.LobbyProperties.get(type).icon}.svg`);
        // Only enable settings if you're lobby owner
        this.panels.detailsSettingsButton.enabled = UserAPI.GetXUID() === owner;
        $.GetContextPanel().SetDialogVariable('lobbyTitle', $.Localize('#Lobby_Owner').replace('%owner%', FriendsAPI.GetNameForXUID(owner)));
        $.GetContextPanel().SetDialogVariable('lobbyPlayerCount', `${lobbyData['members']}/${lobbyData['members_limit']}`);
    }
    /** Update the panel for a specific lobby member */
    static updateMemberListItem(memberSteamID) {
        const memberData = this.lobbyMemberData[memberSteamID];
        let panel = memberData['panel'];
        if (!panel) {
            panel = $.CreatePanel('Panel', this.panels.detailsMemberList, '');
            panel.LoadLayoutSnippet('lobby-member-entry');
            this.lobbyMemberData[memberSteamID]['panel'] = panel;
        }
        // Will be null until you mute or unmute them as it's not pass in with the rest of the data, we set it and track it in JS ¯\_(ツ)_/¯
        const isMuted = memberData.isMuted ?? false;
        panel.SetHasClass('lobby-members__entry--muted', isMuted);
        panel.FindChildTraverse('MemberAvatar').steamid = memberSteamID;
        panel.SetDialogVariable('memberName', isMuted ? $.Localize('#Lobby_MutedPlayer') : FriendsAPI.GetNameForXUID(+memberSteamID));
        const memberMap = memberData.map;
        const localSteamID = UserAPI.GetXUID();
        const localMap = this.lobbyMemberData[localSteamID]?.map;
        panel.SetDialogVariable('memberMap', isMuted ? '' : memberMap ?? $.Localize('#Lobby_InMainMenu'));
        const memberStatePanel = panel.FindChildTraverse('MemberState');
        const isSpectating = memberData['isSpectating'];
        const joinButton = panel.FindChildTraverse('MemberJoinButton');
        joinButton.AddClass('hide');
        memberStatePanel.AddClass('hide');
        if (+memberSteamID === localSteamID)
            return;
        panel.SetPanelEvent('oncontextmenu', () => UiToolkitAPI.ShowSimpleContextMenu(panel, '', [
            {
                label: $.Localize(isMuted ? '#Lobby_UnmutePlayer' : '#Lobby_MutePlayer'),
                icon: 'file://{images}/volume-' + (isMuted ? 'high' : 'mute') + '.svg',
                style: 'icon-color-' + (isMuted ? 'green' : 'red'),
                jsCallback: () => {
                    ChatAPI.ChangeMuteState(+memberSteamID, !isMuted);
                    if (isMuted) {
                        memberData.isMuted = false;
                    }
                    this.updateMemberListItem(memberSteamID);
                }
            },
            {
                label: $.Localize('#Action_ShowSteamProfile'),
                icon: 'file://{images}/social/steam.svg',
                style: 'icon-color-steam-online',
                jsCallback: () => SteamOverlayAPI.OpenToProfileID(memberSteamID.toString())
            }
        ]));
        if (!memberMap)
            return;
        if (isSpectating) {
            const specTargetName = FriendsAPI.GetNameForXUID(+memberData.specTargetID);
            memberStatePanel.SetImage('file://{images}/spectatingIcon.svg');
            memberStatePanel.RemoveClass('hide');
            memberStatePanel.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTitleImageTextTooltipStyled(memberStatePanel.id, '', 'file://{images}/spectatingIcon.svg', `Specating <b>${specTargetName}</b>`, 'tooltip--notitle'));
        }
        else {
            memberStatePanel.ClearPanelEvent('onmouseover');
            memberStatePanel.SetImage('file://{images}/play.svg');
            memberStatePanel.RemoveClass('hide');
            if (memberMap === localMap && memberMap) {
                joinButton.SetDialogVariable('memberJoinLabel', '#Lobby_Spectate');
                joinButton.RemoveClass('hide');
                const joinCallback = () => GameInterfaceAPI.ConsoleCommand('mom_spectate ' + memberSteamID);
                panel.SetPanelEvent('ondblclick', joinCallback);
                panel.FindChildTraverse('MemberJoinButton').SetPanelEvent('onactivate', joinCallback);
            }
            else {
                // if (MapCacheAPI.GetMapData ... needs web and C++ work
                // joinButton.SetDialogVariable('memberJoinLabel', 'Join Map');
                // joinButton.RemoveClass('hide');
                // const joinCallback = () => $.DispatchEvent('MapSelector_TryPlayMap', memberMap);
                // panel.SetPanelEvent('ondblclick', joinCallback);
                // panel.FindChildTraverse('MemberJoinButton').SetPanelEvent('onactivate', joinCallback);
            }
        }
    }
    static onSteamLobbyStateChanged(newState) {
        if (newState === _.SteamLobby.MemberStateChange.LEAVE) {
            this.lobbyMemberData = {};
            this.lobbyCurrentData = {};
            this.panels.detailsMemberList.RemoveAndDeleteChildren();
            delete this.lobbyListData['current'];
            $.DispatchEvent('Drawer_UpdateLobbyButton', 'file://{images}/lobby.svg', 0);
            this.showLobbyList();
        }
        else if (newState === _.SteamLobby.MemberStateChange.JOIN) {
            this.showLobbyDetails();
            $.DispatchEvent('ExtendDrawer');
        }
    }
    static onSteamLobbyListUpdated(data) {
        if (!data)
            return;
        // This is either friends or global
        const origin = Object.keys(data)[0];
        this.lobbyListData[origin] = data[origin];
        this.recreateLobbyListChildren();
        this.panels.refreshIcon.RemoveClass('spin-clockwise');
    }
    static onSteamLobbyDataUpdated(data) {
        if (data === this.lobbyCurrentData)
            return;
        const oldType = +Object.values(this.lobbyCurrentData)[0]?.type;
        const newType = +Object.values(data)[0].type;
        if (oldType !== newType) {
            $.DispatchEvent('Drawer_UpdateLobbyButton', `file://{images}/online/${_.SteamLobby.LobbyProperties.get(newType).icon}.svg`, Object.values(data)[0].members);
        }
        this.lobbyListData['current'] = data;
        this.lobbyCurrentData = data;
        this.updateCurrentLobbyDetails();
    }
    static onSteamLobbyMemberDataUpdated(data) {
        for (const memberSteamID of Object.keys(data)) {
            const localID = UserAPI.GetXUID();
            const oldMap = this.lobbyMemberData[localID]?.['map'];
            const newMap = data[memberSteamID]['map'];
            if (memberSteamID in this.lobbyMemberData) {
                for (const item of Object.keys(data[memberSteamID]))
                    this.lobbyMemberData[memberSteamID][item] = data[memberSteamID][item];
            }
            else {
                this.lobbyMemberData[memberSteamID] = data[memberSteamID];
            }
            // If local player has just joined a new map, update the join/spectate buttons for all other player panels
            if (+memberSteamID === localID && oldMap !== newMap) {
                for (const member of Object.keys(this.lobbyMemberData))
                    this.updateMemberListItem(member);
            }
            else {
                this.updateMemberListItem(memberSteamID);
            }
        }
    }
    static onSteamLobbyMemberStateChanged(memberSteamID, changeType) {
        if (changeType === 'leave') {
            this.lobbyMemberData[memberSteamID]['panel'].DeleteAsync(0);
            delete this.lobbyMemberData[memberSteamID];
        }
    }
    static onPlayerMuted(steamID) {
        if (steamID in this.lobbyMemberData) {
            this.lobbyMemberData[steamID].isMuted = true;
            this.updateMemberListItem(steamID);
        }
    }
    static isInLobby() {
        return 'current' in this.lobbyListData;
    }
    static isLobbyOwner() {
        return this.isInLobby() && +Object.values(this.lobbyListData.current)[0].owner === UserAPI.GetXUID();
    }
    static getLobbyMemberCount() {
        return Object.values(this.lobbyCurrentData)[0]?.['members'];
    }
}
