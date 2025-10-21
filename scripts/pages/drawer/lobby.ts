import { PanelHandler } from 'util/module-helpers';
import {
	LobbyProperties,
	LobbyMemberStateChange,
	LobbyMember,
	LobbyList,
	GroupedLobbyLists,
	MemberData,
	LobbyType
} from 'common/online';

type LobbyListItem = LobbyMember & { panel?: Panel };

const REFRESH_COOLDOWN = 10;

@PanelHandler()
class LobbyHandler {
	lobbyCurrentData: LobbyList = {};
	lobbyListData: GroupedLobbyLists = {};
	lobbyMemberData: Record<steamID, LobbyListItem> = {};

	readonly panels = {
		search: $<TextEntry>('#LobbySearch'),
		searchClearButton: $<Button>('#LobbySearchClearButton'),
		refreshButton: $<Button>('#LobbyRefreshButton'),
		refreshIcon: $<Image>('#LobbyRefreshIcon'),
		list: $<Panel>('#LobbyList'),
		listContainer: $<Panel>('#LobbyListContainer'),
		details: $<Panel>('#LobbyDetailsContainer'),
		detailsType: $<Image>('#LobbyDetailsType'),
		detailsTitle: $<Label>('#LobbyDetailsTitle'),
		detailsPlayerCount: $<Label>('#LobbyDetailsPlayerCount'),
		detailsSettingsButton: $<Button>('#LobbyDetailsSettingsButton'),
		detailsMemberList: $<Panel>('#LobbyDetailsMemberList')
	};

	constructor() {
		// Watch out: these callbacks work a bit different to Steamworks: We will only receive data for our own lobby automatically
		// And only the list update will give us anything else via OnListUpdated
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnListUpdated', (lobbyList) =>
			this.onGroupedLobbyListUpdated(lobbyList)
		);
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnDataUpdated', (lobbyData) =>
			this.onLobbyListUpdated(lobbyData)
		);
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberDataUpdated', (memberData) =>
			this.onLobbyMemberDataUpdated(memberData)
		);
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberStateChanged', (steamID, changeType) =>
			this.onLobbyMemberStateChanged(steamID, changeType)
		);
		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnLobbyStateChanged', (newState) =>
			this.onLobbyStateChanged(newState)
		);
		$.RegisterForUnhandledEvent('PanoramaComponent_Chat_OnPlayerMuted', (steamID) => this.onPlayerMuted(steamID));
		$.RegisterForUnhandledEvent('RefreshLobbyList', () => this.refreshLobbyList());

		this.panels.search.SetPanelEvent('ontextentrychanged', () => this.recreateLobbyListChildren());
	}

	/** Join the lobby with the given id, warning the user if they're currently in a lobby */
	join(steamID: steamID) {
		const leaveAndJoinCheck = (message: string) => {
			UiToolkitAPI.ShowGenericPopupOkCancel(
				$.Localize('#Lobby_Leave'),
				message,
				'ok-cancel-popup',
				() => {
					SteamLobbyAPI.Leave();
					SteamLobbyAPI.Join(steamID);
				},
				() => {}
			);
		};

		if (this.isInLobby()) {
			if (this.isLobbyOwner() && this.getLobbyMemberCount() > 1) {
				leaveAndJoinCheck($.Localize('#Lobby_TransferWarning'));
			} else {
				leaveAndJoinCheck($.Localize('#Lobby_LeaveWarning'));
			}
		} else {
			SteamLobbyAPI.Join(steamID);
		}
	}

	/** Leave the current lobby, warning the user if they're the owner */
	leave() {
		if (this.isLobbyOwner() && this.getLobbyMemberCount() > 1) {
			UiToolkitAPI.ShowGenericPopupOkCancel(
				$.Localize('#Lobby_Leave'),
				$.Localize('#Lobby_TransferWarning'),
				'ok-cancel-popup',
				() => SteamLobbyAPI.Leave(),
				() => {}
			);
		} else {
			SteamLobbyAPI.Leave();
		}
	}

	/** Show the lobby creation popup */
	create() {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/lobby-create.xml',
			'isinlobby=' + +this.isInLobby() + '&islobbyowner=' + +this.isLobbyOwner() // Cast to int to pass as attribute
		);
	}

	/** Show the lobby settings popup */
	showLobbySettings() {
		const lobbyData = Object.values(this.lobbyCurrentData)[0];

		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'',
			'file://{resources}/layout/modals/popups/lobby-settings.xml',
			'type=' + lobbyData['type'] + '&maxplayers=' + lobbyData['members_limit']
		);
	}

	/** Switch to the lobby details panel */
	showLobbyDetails() {
		this.panels.details.RemoveClass('lobby__lobby-details--hidden');
		this.panels.listContainer.AddClass('lobby__lobby-list--hidden');
	}

	/** Switch to the lobby list panel */
	showLobbyList() {
		this.panels.listContainer.RemoveClass('lobby__lobby-list--hidden');
		this.panels.details.AddClass('lobby__lobby-details--hidden');

		this.recreateLobbyListChildren();
	}

	/** Request a lobby refresh, then put the button on cooldown */
	refreshLobbyList() {
		if (SteamLobbyAPI.RefreshList({})) {
			this.panels.refreshIcon.AddClass('spin-clockwise'); // Removed when onSteamLobbyListUpdated is called

			this.panels.refreshButton.enabled = false;

			$.Schedule(REFRESH_COOLDOWN, () => (this.panels.refreshButton.enabled = true));

			let cooldown = REFRESH_COOLDOWN;
			let isRefreshHovered: boolean;

			const cooldownMessage = () =>
				UiToolkitAPI.ShowTextTooltip(
					this.panels.refreshButton.id,
					$.Localize('#Lobby_RefreshCooldown').replace('%cooldown%', cooldown.toString())
				);

			const cooldownTimer = () => {
				if (isRefreshHovered) cooldownMessage();

				this.panels.refreshButton.SetPanelEvent('onmouseover', () => {
					isRefreshHovered = true;
					cooldownMessage();
				});

				this.panels.refreshButton.SetPanelEvent('onmouseout', () => {
					isRefreshHovered = false;
					UiToolkitAPI.HideTextTooltip();
				});

				cooldown -= 1;

				if (cooldown >= 0) $.Schedule(1, () => cooldownTimer());
				else {
					this.panels.refreshButton.ClearPanelEvent('onmouseover');
					this.panels.refreshButton.ClearPanelEvent('onmouseout');
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
	recreateLobbyListChildren() {
		this.panels.searchClearButton.SetHasClass('search__clearicon--hidden', this.panels.search.text === '');

		// Clear the current list
		this.panels.list.RemoveAndDeleteChildren();

		const knownIDs: string[] = [];
		for (const origin of ['current', 'friends', 'global'] as const) {
			const lobbyListEntries = Object.entries(this.lobbyListData[origin] ?? {});

			// Sort each list by player count
			lobbyListEntries.sort(([, { members: a }], [, { members: b }]) => b - a);

			for (const [lobbyID, lobbyData] of lobbyListEntries) {
				if (knownIDs.includes(lobbyID)) {
					continue;
				} else {
					knownIDs.push(lobbyID);
				}

				const ownerSteamID = lobbyData.owner;
				const lobbyType = lobbyData.type;
				const isMapLobby = lobbyData.is_map_lobby === 1;
				const lobbyName = this.getLobbyName(ownerSteamID, isMapLobby);

				// Only show items that match the search. Always true if search is empty
				if (!lobbyName.includes(this.panels.search.text)) {
					return;
				}

				const newPanel = $.CreatePanel('Panel', this.panels.list, ''); // Create the new panel

				newPanel.LoadLayoutSnippet('lobby-list-entry');

				const joinCallback = () => (origin === 'current' ? this.showLobbyDetails() : this.join(lobbyID));

				newPanel.SetPanelEvent('ondblclick', joinCallback);
				newPanel.FindChildTraverse('LobbyJoinButton').SetPanelEvent('onactivate', joinCallback);

				if (lobbyType >= LobbyType.PRIVATE && lobbyType <= LobbyType.INVISIBLE) {
					// Suppress annoying JS error until we refactor lobby system to C++
					const typePanel = newPanel.FindChildTraverse<Image>('LobbyType');
					const typeProps = LobbyProperties.get(lobbyType);
					const typeIcon = `file://{images}/online/${typeProps.icon}.svg`;
					typePanel.SetImage(typeIcon);
					typePanel.SetPanelEvent('onmouseover', () =>
						UiToolkitAPI.ShowTitleImageTextTooltipStyled(
							typePanel.id,
							'',
							typeIcon,
							typeProps.name,
							'tooltip--notitle'
						)
					);
				}

				const avatarPanel = newPanel.FindChildTraverse<AvatarImage>('LobbyPlayerAvatar');
				if (isMapLobby) {
					avatarPanel.AddClass('lobby-lobbies__avatar--maplobby');
					avatarPanel.steamid = '0';
					avatarPanel.ClearPanelEvent('oncontextmenu');
				} else {
					avatarPanel.RemoveClass('lobby-lobbies__avatar--maplobby');
					avatarPanel.steamid = ownerSteamID;
					avatarPanel.SetPanelEvent('oncontextmenu', () =>
						UiToolkitAPI.ShowSimpleContextMenu('', '', [
							{
								label: $.Localize('#Action_ShowSteamProfile'),
								icon: 'file://{images}/social/steam.svg',
								style: 'icon-color-steam-online',
								jsCallback: () => SteamOverlayAPI.OpenToProfileID(ownerSteamID)
							}
						])
					);
				}

				const hackId = $.RegisterEventHandler('PanelLoaded', avatarPanel, () => {
					$.Schedule(2.5, () => {
						if (newPanel.IsValid()) {
							newPanel.SetDialogVariable('lobbyTitle', this.getLobbyName(ownerSteamID, isMapLobby));
							$.UnregisterEventHandler('PanelLoaded', avatarPanel, hackId);
						}
					});
				});

				newPanel.SetDialogVariable('lobbyTitle', lobbyName);
				newPanel.SetDialogVariable('lobbyPlayerCount', `${lobbyData['members']}/${lobbyData['members_limit']}`);
				newPanel.SetDialogVariable(
					'lobbyJoinLabel',
					$.Localize(origin === 'current' ? '#Lobby_Details' : '#Lobby_Join')
				);

				const originPanel = newPanel.FindChildTraverse('LobbyOrigin');
				originPanel.AddClass(`lobby-lobbies__origin--${origin}`);
			}
		}
	}

	/** Update the lobbies details view based on current lobby state */
	updateCurrentLobbyDetails() {
		const { owner, type, members, members_limit, is_map_lobby } = Object.values(this.lobbyCurrentData)[0];

		this.panels.detailsType.SetImage(`file://{images}/online/${LobbyProperties.get(type).icon}.svg`);

		// Only enable settings if you're lobby owner
		this.panels.detailsSettingsButton.enabled = UserAPI.GetXUID() === owner && !is_map_lobby;

		$.GetContextPanel().SetDialogVariable('lobbyTitle', this.getLobbyName(owner, is_map_lobby === 1));
		$.GetContextPanel().SetDialogVariable('lobbyPlayerCount', `${members}/${members_limit}`);
	}

	/** Update the panel for a specific lobby member */
	updateMemberListItem(memberSteamID: steamID) {
		const memberData = this.lobbyMemberData[memberSteamID];
		if (!memberData) return;

		let panel = memberData.panel;

		if (!panel) {
			panel = $.CreatePanel('Panel', this.panels.detailsMemberList, '');
			panel.LoadLayoutSnippet('lobby-member-entry');
			this.lobbyMemberData[memberSteamID]['panel'] = panel;
		}

		// Will be null until you mute or unmute them as it's not pass in with the rest of the data, we set it and track it in JS ¯\_(ツ)_/¯
		const isMuted = memberData.isMuted ?? false;

		panel.SetHasClass('lobby-members__entry--muted', isMuted);

		panel.FindChildTraverse<AvatarImage>('MemberAvatar').steamid = memberSteamID;

		panel.SetDialogVariable(
			'memberName',
			isMuted ? $.Localize('#Lobby_MutedPlayer') : FriendsAPI.GetNameForXUID(memberSteamID)
		);

		const memberMap = memberData.map_name;
		const localSteamID = UserAPI.GetXUID();
		const localMap = this.lobbyMemberData[localSteamID]?.map_name;

		panel.SetDialogVariable('memberMap', isMuted ? '' : (memberMap ?? $.Localize('#Lobby_InMainMenu')));

		const memberStatePanel = panel.FindChildTraverse<Image>('MemberState');

		const joinButton = panel.FindChildTraverse('MemberJoinButton');

		joinButton.AddClass('hide');
		memberStatePanel.AddClass('hide');

		if (memberSteamID === localSteamID) return;

		panel.SetPanelEvent('oncontextmenu', () =>
			UiToolkitAPI.ShowSimpleContextMenu(panel.id, '', [
				{
					label: $.Localize(isMuted ? '#Lobby_UnmutePlayer' : '#Lobby_MutePlayer'),
					icon: 'file://{images}/volume-' + (isMuted ? 'high' : 'mute') + '.svg',
					style: 'icon-color-' + (isMuted ? 'green' : 'red'),
					jsCallback: () => {
						ChatAPI.ChangeMuteState(memberSteamID, !isMuted);
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
			])
		);

		if (!memberMap) return;

		if (memberData.isSpectating === '1') {
			const specTargetName = FriendsAPI.GetNameForXUID(memberData.specTargetID);

			memberStatePanel.SetImage('file://{images}/eye.svg');

			memberStatePanel.RemoveClass('hide');

			memberStatePanel.SetPanelEvent('onmouseover', () =>
				UiToolkitAPI.ShowTitleImageTextTooltipStyled(
					memberStatePanel.id,
					'',
					'file://{images}/eye.svg',
					$.Localize('#Spectate_Status_Spectating_Player').replace('%user%', `<b>${specTargetName}</b>`),
					'tooltip--notitle'
				)
			);
		} else {
			memberStatePanel.ClearPanelEvent('onmouseover');
			memberStatePanel.SetImage('file://{images}/play.svg');

			memberStatePanel.RemoveClass('hide');

			if (memberMap === localMap && memberMap) {
				joinButton.SetDialogVariable('memberJoinLabel', $.Localize('#Lobby_Spectate'));
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

	onLobbyStateChanged(newState: LobbyMemberStateChange) {
		if (newState === LobbyMemberStateChange.LEAVE) {
			this.lobbyMemberData = {};
			this.lobbyCurrentData = {};

			this.panels.detailsMemberList.RemoveAndDeleteChildren();

			delete this.lobbyListData['current'];

			$.DispatchEvent('Drawer_UpdateLobbyButton', 'file://{images}/lobby.svg', 0);

			this.showLobbyList();
		} else if (newState === LobbyMemberStateChange.JOIN) {
			this.showLobbyDetails();

			$.DispatchEvent('ExtendDrawer');
		}
	}

	onGroupedLobbyListUpdated(lobbyList: GroupedLobbyLists) {
		if (!lobbyList) return;

		// This is either friends or global
		const origin = Object.keys(lobbyList)[0] as 'friends' | 'global';
		this.lobbyListData[origin] = lobbyList[origin];

		this.recreateLobbyListChildren();
		this.panels.refreshIcon.RemoveClass('spin-clockwise');
	}

	onLobbyListUpdated(lobbyData: LobbyList) {
		if (lobbyData === this.lobbyCurrentData) return;

		const oldLobby = Object.values(this.lobbyCurrentData)[0];
		const newLobby = Object.values(lobbyData)[0];

		if (oldLobby?.type !== newLobby.type) {
			$.DispatchEvent(
				'Drawer_UpdateLobbyButton',
				`file://{images}/online/${LobbyProperties.get(newLobby.type).icon}.svg`,
				newLobby.members
			);
		}

		this.lobbyListData.current = lobbyData;
		this.lobbyCurrentData = lobbyData;

		this.updateCurrentLobbyDetails();
	}

	onLobbyMemberDataUpdated(memberData: MemberData) {
		for (const [memberSteamID, member] of Object.entries(memberData)) {
			const localID = UserAPI.GetXUID();
			const oldMap = this.lobbyMemberData[localID]?.map_name;
			const newMap = member.map_name;

			if (memberSteamID in this.lobbyMemberData) {
				Object.assign(this.lobbyMemberData[memberSteamID], member);
			} else {
				this.lobbyMemberData[memberSteamID] = member;
			}

			// If local player has just joined a new map, update the join/spectate buttons for all other player panels
			if (memberSteamID === localID && oldMap !== newMap) {
				for (const member of Object.keys(this.lobbyMemberData)) {
					this.updateMemberListItem(member);
				}
			} else {
				this.updateMemberListItem(memberSteamID);
			}
		}
	}

	onLobbyMemberStateChanged(memberSteamID: steamID, changeType: LobbyMemberStateChange) {
		if (changeType === 'leave' && memberSteamID in this.lobbyMemberData) {
			this.lobbyMemberData[memberSteamID].panel?.DeleteAsync(0);
			delete this.lobbyMemberData[memberSteamID];
		}
	}

	onPlayerMuted(steamID: steamID) {
		if (steamID in this.lobbyMemberData) {
			this.lobbyMemberData[steamID].isMuted = true;
			this.updateMemberListItem(steamID);
		}
	}

	isInLobby() {
		return 'current' in this.lobbyListData;
	}

	isLobbyOwner() {
		return this.isInLobby() && Object.values(this.lobbyListData.current)[0].owner === UserAPI.GetXUID();
	}

	getLobbyMemberCount() {
		return Object.values(this.lobbyCurrentData)[0]?.members;
	}

	getLobbyName(ownerSteamID: steamID, isMapLobby: boolean) {
		return isMapLobby
			? `${$.Localize('#Lobby_MapLobby')} (${MapCacheAPI.GetMapName()})`
			: $.Localize('#Lobby_Owner').replace('%owner%', FriendsAPI.GetNameForXUID(ownerSteamID));
	}
}
