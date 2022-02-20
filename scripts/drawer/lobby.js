'use strict';

const REFRESH_COOLDOWN = 10.0;

class Lobby {
	static lobbyTypes = {
		0: {
			name: 'Private Lobby',
			icon: 'privatelobby'
		},
		1: {
			name: 'Friends Only Lobby',
			icon: 'friendsonlylobby'
		},
		2: {
			name: 'Public Lobby',
			icon: 'publiclobby'
		}
	};

	static lobbyCurrentData = {};
	static lobbyListData = {};
	static lobbyMemberData = {};

	static isRefreshHovered;

	/** @type {TextEntry} @static */
	static lobbySearch = $('#LobbySearch');
	/** @type {Button} @static */
	static lobbySearchClearButton = $('#LobbySearchClearButton');
	/** @type {Panel} @static */
	static lobbyList = $('#LobbyList');
	/** @type {Panel} @static */
	static listContainer = $('#LobbyListContainer');
	/** @type {Panel} @static */
	static detailsContainer = $('#LobbyDetailsContainer');
	static lobbyDetailsType = $('#LobbyDetailsType');
	/** @type {Label} @static */
	static lobbyDetailsTitle = $('#LobbyDetailsTitle');
	/** @type {Label} @static */
	static lobbyDetailsPlayerCount = $('#LobbyDetailsPlayerCount');
	/** @type {Button} @static */
	static lobbyDetailsSettingsButton = $('#LobbyDetailsSettingsButton');
	/** @type {Panel} @static */
	static lobbyDetailsMemberList = $('#LobbyDetailsMemberList');

	static {
		// Watch out: these callbacks work a bit different to Steamworks: We will only receive data for our own lobby automatically
		// And only the list update will give us anything else via OnListUpdated
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnListUpdated', Lobby.onSteamLobbyListUpdated.bind(this));
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnDataUpdated', Lobby.onSteamLobbyDataUpdated.bind(this));
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberDataUpdated', Lobby.onSteamLobbyMemberDataUpdated.bind(this));
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberStateChanged', Lobby.onSteamLobbyMemberStateChanged.bind(this));
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnLobbyStateChanged', Lobby.onSteamLobbyStateChanged.bind(this));
		$.RegisterForUnhandledEvent('PanoramaComponent_Chat_OnPlayerMuted', Lobby.onPlayerMuted.bind(this));
		$.RegisterForUnhandledEvent('RefreshLobbyList', Lobby.refreshLobbyList.bind(this));

		this.lobbySearch.SetPanelEvent('ontextentrychanged', Lobby.recreateLobbyListChildren.bind(this));
	}

	/**
	 * Join the lobby with the given id, warning the user if they're currently in a lobby
	 * @param {number} steamid
	 */
	static join(steamid) {
		const leaveAndJoinCheck = (message) => {
			UiToolkitAPI.ShowGenericPopupOkCancel(
				'Leave current lobby?',
				message,
				'ok-cancel-popup',
				() => {
					SteamLobbyAPI.Leave();
					SteamLobbyAPI.Join(steamid);
				},
				() => {}
			);
		};

		if (this.isInLobby()) {
			if (this.isLobbyOwner() && this.getLobbyMemberCount() > 1) {
				leaveAndJoinCheck('You are currently the owner of a lobby, are you sure you want to leave and transfer its ownership?');
			} else {
				leaveAndJoinCheck('Are you sure you want to leave your current lobby?');
			}
		} else {
			SteamLobbyAPI.Join(steamid);
		}
	}

	/**
	 * Leave the current lobby, warning the user if they're the owner
	 */
	static leave() {
		if (this.isLobbyOwner() && this.getLobbyMemberCount() > 1) {
			UiToolkitAPI.ShowGenericPopupOkCancel(
				'Leave current lobby?',
				'You are currently owner of this lobby! Leaving will transfer ownership to another player. Are you sure you want to leave?',
				'ok-cancel-popup',
				() => SteamLobbyAPI.Leave(),
				() => {}
			);
		} else {
			SteamLobbyAPI.Leave();
		}
	}

	/**
	 * Show the lobby creation popup
	 */
	static create() {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/popups/popup_lobbycreate.xml',
			'isinlobby=' + +this.isInLobby() + '&islobbyowner=' + +this.isLobbyOwner() // Cast to int to pass as attribute
		);
	}

	/**
	 * Show the lobby settings popup
	 */
	static showLobbySettings() {
		const lobbyData = this.getFirstLobbyObj(this.lobbyCurrentData);

		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/popups/popup_lobbysettings.xml',
			'type=' + lobbyData['type'] + '&maxplayers=' + lobbyData['members_limit']
		);
	}

	/**
	 * Switch to the lobby details panel
	 */
	static showLobbyDetails() {
		this.detailsContainer.RemoveClass('drawer-lobby__lobby-details--hidden');
		this.listContainer.AddClass('drawer-lobby__lobby-list--hidden');
	}

	/**
	 * Switch to the lobby list panel
	 */
	static showLobbyList() {
		this.listContainer.RemoveClass('drawer-lobby__lobby-list--hidden');
		this.detailsContainer.AddClass('drawer-lobby__lobby-details--hidden');

		this.recreateLobbyListChildren();
	}

	/**
	 * Request a lobby refresh, then put the button on cooldown
	 */
	static refreshLobbyList() {
		const refreshButton = $.GetContextPanel().FindChildTraverse('LobbyRefreshButton');

		if (SteamLobbyAPI.RefreshList({ this_is_where_filters_will_go_in_the_future: 'true' })) {
			$.GetContextPanel().FindChildTraverse('LobbyRefreshIcon').AddClass('spin-clockwise'); // Removed when onSteamLobbyListUpdated is called

			refreshButton.enabled = false;

			$.Schedule(REFRESH_COOLDOWN, () => (refreshButton.enabled = true));

			let cooldown = REFRESH_COOLDOWN;
			let isRefreshHovered;

			const cooldownMessage = () => UiToolkitAPI.ShowTextTooltip(refreshButton.id, `Refresh is on cooldown, please wait ${cooldown} seconds.`);

			const cooldownTimer = function () {
				if (isRefreshHovered) cooldownMessage();

				refreshButton.SetPanelEvent('onmouseover', () => {
					isRefreshHovered = true;
					cooldownMessage();
				});

				refreshButton.SetPanelEvent('onmouseout', () => {
					isRefreshHovered = false;
					UiToolkitAPI.HideTextTooltip();
				});

				cooldown -= 1.0;

				if (cooldown >= 0) $.Schedule(1.0, () => cooldownTimer());
				else {
					refreshButton.ClearPanelEvent('onmouseover');
					refreshButton.ClearPanelEvent('onmouseout');
					if (isRefreshHovered) UiToolkitAPI.HideTextTooltip();
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
		this.lobbySearchClearButton.SetHasClass('search__clearicon--hidden', this.lobbySearch.text === '');

		// Clear the current list
		this.lobbyList.RemoveAndDeleteChildren();

		const data = this.lobbyListData;

		let known_ids = [];
		// The sort actually works out how we want it (current < friends < global)
		// TODO: Sort based on other orderings e.g. player count
		Object.keys(data)
			.sort()
			.forEach((origin) => {
				Object.keys(data[origin]).forEach((lobbySteamID) => {
					if (known_ids.includes(lobbySteamID)) return; // Prevent duplicate lobbies; we don't have duplicates for the same origin, but we might get the same lobby from 2 origins

					known_ids.push(lobbySteamID);
					const lobbyObj = data[origin][lobbySteamID];
					const ownerSteamID = lobbyObj['owner'];
					const lobbyType = lobbyObj['type'];
					const lobbyName = FriendsAPI.GetNameForXUID(ownerSteamID) + "'s Lobby";

					if (!lobbyName.includes($.GetContextPanel().FindChildTraverse('LobbySearch').text)) return; // Only show items that match the search. Always true if search is empty

					const newPanel = $.CreatePanel('Panel', $.GetContextPanel().FindChildTraverse('LobbyList'), ''); // Create the new panel

					newPanel.LoadLayoutSnippet('lobby-list-entry');

					const joinCallback = () => (origin === 'current' ? this.showLobbyDetails() : this.join(lobbySteamID));

					newPanel.SetPanelEvent('ondblclick', joinCallback);
					newPanel.FindChildTraverse('LobbyJoinButton').SetPanelEvent('onactivate', joinCallback);

					const typePanel = newPanel.FindChildTraverse('LobbyType');
					const typeIcon = 'file://{images}/online/' + this.lobbyTypes[lobbyType].icon + '.svg';
					typePanel.SetImage(typeIcon);
					typePanel.SetPanelEvent('onmouseover', () =>
						UiToolkitAPI.ShowTitleImageTextTooltipStyled(typePanel.id, '', typeIcon, this.lobbyTypes[lobbyType].name, 'tooltip--notitle')
					);

					const avatarPanel = newPanel.FindChildTraverse('LobbyPlayerAvatar');
					avatarPanel.steamid = ownerSteamID;

					avatarPanel.SetPanelEvent('oncontextmenu', () =>
						UiToolkitAPI.ShowSimpleContextMenu(avatarPanel, '', [
							{
								label: 'Steam Profile',
								icon: 'file://{images}/steam.svg',
								style: 'icon-color-steam-online',
								jsCallback: () => SteamOverlayAPI.OpenToProfileID(ownerSteamID)
							}
						])
					);

					newPanel.SetDialogVariable('lobbyTitle', lobbyName);
					newPanel.SetDialogVariable('lobbyPlayerCount', lobbyObj['members'] + '/' + lobbyObj['members_limit']);
					newPanel.SetDialogVariable('lobbyJoinLabel', origin === 'current' ? 'Details' : 'Join');

					const originPanel = newPanel.FindChildTraverse('LobbyOrigin');
					if (origin === 'global') {
						originPanel.AddClass('lobby-lobbies__origin--global');
					} else if (origin === 'friends') {
						originPanel.AddClass('lobby-lobbies__origin--friends');
					} else {
						originPanel.AddClass('lobby-lobbies__origin--current');
					}
				});
			});
	}

	static updateCurrentLobbyDetails() {
		const lobbyData = this.getFirstLobbyObj(this.lobbyCurrentData);
		const owner = lobbyData['owner'];
		const type = lobbyData['type'];

		this.lobbyDetailsType.SetImage('file://{images}/online/' + this.lobbyTypes[type].icon + '.svg');

		// Only enable settings if you're lobby owner
		this.lobbyDetailsSettingsButton.enabled = UserAPI.GetXUID() === owner;

		$.GetContextPanel().SetDialogVariable('lobbyTitle', FriendsAPI.GetNameForXUID(owner) + "'s Lobby");

		$.GetContextPanel().SetDialogVariable('lobbyPlayerCount', lobbyData['members'] + '/' + lobbyData['members_limit']);
	}

	static updateMemberListItem(memberSteamID) {
		let memberData = this.lobbyMemberData[memberSteamID];
		let panel = memberData['panel'];

		if (panel === undefined) {
			panel = $.CreatePanel('Panel', $.GetContextPanel().FindChildTraverse('LobbyDetailsMemberList'), '');
			panel.LoadLayoutSnippet('lobby-member-entry');
			this.lobbyMemberData[memberSteamID]['panel'] = panel;
		}

		// Will be null until you mute or unmute them as it's not pass in with the rest of the data, we set it and track it in JS ¯\_(ツ)_/¯
		const isMuted = memberData['isMuted'] ?? false;

		panel.SetHasClass('lobby-members__entry--muted', isMuted);

		panel.FindChildTraverse('MemberAvatar').steamid = memberSteamID;

		panel.SetDialogVariable('memberName', isMuted ? 'Muted Player' : FriendsAPI.GetNameForXUID(memberSteamID));

		const memberMap = memberData['map'];
		const localSteamID = UserAPI.GetXUID();
		const localMap = this.lobbyMemberData[localSteamID]?.['map'];

		panel.SetDialogVariable('memberMap', isMuted ? 'Muted Map' : memberMap ? memberMap : 'In main menu');

		const memberStatePanel = panel.FindChildTraverse('MemberState');
		const isSpectating = memberData['isSpectating'];

		const joinButton = panel.FindChildTraverse('MemberJoinButton');

		joinButton.AddClass('hide');
		memberStatePanel.AddClass('hide');

		if (memberSteamID !== localSteamID) {
			panel.SetPanelEvent('oncontextmenu', () =>
				UiToolkitAPI.ShowSimpleContextMenu(panel, '', [
					{
						label: isMuted ? 'Unmute Player' : 'Mute Player',
						icon: 'file://{images}/volume-' + (isMuted ? 'high' : 'mute') + '.svg',
						style: 'icon-color-' + (isMuted ? 'green' : 'red'),
						jsCallback: () => {
							ChatAPI.ChangeMuteState(memberSteamID, !isMuted);
							if (isMuted) {
								memberData['isMuted'] = false;
							}
							this.updateMemberListItem(memberSteamID);
						}
					},
					{
						label: 'Steam Profile',
						icon: 'file://{images}/steam.svg',
						style: 'icon-color-steam-online',
						jsCallback: () => SteamOverlayAPI.OpenToProfileID(memberSteamID)
					}
				])
			);

			if (!memberMap) return;

			if (isSpectating) {
				const specTargetName = FriendsAPI.GetNameForXUID(memberData['specTargetID']);

				memberStatePanel.SetImage('file://{images}/chat/spectatingIcon.svg');

				memberStatePanel.RemoveClass('hide');

				memberStatePanel.SetPanelEvent('onmouseover', () =>
					UiToolkitAPI.ShowTitleImageTextTooltipStyled(
						memberStatePanel.id,
						'',
						'file://{images}/chat/spectatingIcon.svg',
						`Specating <b>${specTargetName}</b>`,
						'tooltip--notitle'
					)
				);
			} else {
				memberStatePanel.ClearPanelEvent('onmouseover');
				memberStatePanel.SetImage('file://{images}/topnav/play.svg');

				memberStatePanel.RemoveClass('hide');

				if (memberMap === localMap && memberMap && localMap) {
					joinButton.SetDialogVariable('memberJoinLabel', 'Spectate');
					joinButton.RemoveClass('hide');

					const joinCallback = () => GameInterfaceAPI.ConsoleCommand('mom_spectate ' + memberSteamID);

					panel.SetPanelEvent('ondblclick', joinCallback);
					panel.FindChildTraverse('MemberJoinButton').SetPanelEvent('onactivate', joinCallback);
				} else {
					// if (MapCacheAPI.GetMapData ... needs web and C++ work
					// joinButton.SetDialogVariable('memberJoinLabel', 'Join Map');
					// joinButton.RemoveClass('hide');
					// const joinCallback = () => $.DispatchEvent('MapSelector_TryPlayMap', memberMap);
					// panel.SetPanelEvent('ondblclick', joinCallback);
					// panel.FindChildTraverse('MemberJoinButton').SetPanelEvent('onactivate', joinCallback);
				}
			}
		}
	}

	static onSteamLobbyStateChanged(newState) {
		if (newState === 'leave') {
			this.lobbyMemberData = {};
			this.lobbyCurrentData = {};

			this.lobbyDetailsMemberList.RemoveAndDeleteChildren();

			delete this.lobbyListData['current'];

			$.DispatchEvent('Drawer_UpdateLobbyButton', 'file://{images}/sidepanel/lobby.svg', 0);

			this.showLobbyList();
		} else if (newState === 'join') {
			this.showLobbyDetails();
		}
	}

	static onSteamLobbyListUpdated(data) {
		if (data === undefined) return;

		// This is either friends or global
		const origin = Object.keys(data)[0];
		this.lobbyListData[origin] = data[origin];

		this.recreateLobbyListChildren();
		$.GetContextPanel().FindChildTraverse('LobbyRefreshIcon').RemoveClass('spin-clockwise');
	}

	static onSteamLobbyDataUpdated(data) {
		if (data !== this.lobbyCurrentData) {
			const oldType = this.getFirstLobbyObj(this.lobbyCurrentData)?.['type'];
			const newType = this.getFirstLobbyObj(data)['type'];

			if (oldType !== newType) {
				$.DispatchEvent('Drawer_UpdateLobbyButton', 'file://{images}/online/' + this.lobbyTypes[newType].icon + '.svg', this.getFirstLobbyObj(data)['members']);
			}

			this.lobbyListData['current'] = data;
			this.lobbyCurrentData = data;

			this.updateCurrentLobbyDetails();
		}
	}

	static onSteamLobbyMemberDataUpdated(data) {
		Object.keys(data).forEach((memberSteamID) => {
			const localID = UserAPI.GetXUID();

			const oldMap = this.lobbyMemberData[localID]?.['map'];
			const newMap = data[memberSteamID]['map'];

			if (memberSteamID in this.lobbyMemberData) {
				Object.keys(data[memberSteamID]).forEach((item) => (this.lobbyMemberData[memberSteamID][item] = data[memberSteamID][item]));
			} else {
				this.lobbyMemberData[memberSteamID] = data[memberSteamID];
			}

			// If local player has just joined a new map, update the join/spectate buttons for all other player panels
			if (memberSteamID === localID && oldMap !== newMap) {
				Object.keys(this.lobbyMemberData).forEach((member) => this.updateMemberListItem(member));
			} else {
				this.updateMemberListItem(memberSteamID);
			}
		});
	}

	static onSteamLobbyMemberStateChanged(memberSteamID, changeType) {
		if (changeType === 'leave') {
			this.lobbyMemberData[memberSteamID]['panel'].DeleteAsync(0.0);
			delete this.lobbyMemberData[memberSteamID];
		}
	}

	static onPlayerMuted(steamID) {
		if (steamID in this.lobbyMemberData) {
			this.lobbyMemberData[steamID]['isMuted'] = true;
			this.updateMemberListItem(steamID);
		}
	}

	static isInLobby() {
		return 'current' in this.lobbyListData;
	}

	static isLobbyOwner() {
		return this.isInLobby() ? this.getFirstLobbyObj(this.lobbyListData['current'])['owner'] == UserAPI.GetXUID() : false;
	}

	static getLobbyMemberCount() {
		return this.getFirstLobbyObj(this.lobbyCurrentData)?.['members'];
	}

	static getFirstLobbyObj(data) {
		return data[Object.keys(data)[0]];
	}
}
