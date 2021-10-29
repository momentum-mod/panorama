"use strict";

class Lobby {
	static lobbyTypes = {
		0: {
			name: "Private Lobby",
			icon: "privatelobby"
		},
		1: {
			name: "Friends Only Lobby",
			icon: "friendsonlylobby"
		},
		2: {
			name: "Public Lobby",
			icon: "publiclobby"
		}
	};

	static lobbyCurrentData = {};
	static lobbyListData = {};
	static lobbyMemberData = {};

	static refreshCooldown = 10.0;
	static isRefreshHovered;
	static updatecalls = 0;

	static join(steamid) {
		const leaveAndJoinCheck = (message) => {
			UiToolkitAPI.ShowGenericPopupOkCancel(
				"Leave current lobby?",
				message,
				"ok-cancel-popup",
				() => {
					SteamLobbyAPI.Leave();
					SteamLobbyAPI.Join(steamid);
				},
				() => {}
			);
		};

		if (this.isInLobby()) {
			if (this.isLobbyOwner() && this.getLobbyMemberCount() > 1) {
				leaveAndJoinCheck("You are currently the owner of a lobby, are you sure you want to leave and transfer its ownership?");
			} else leaveAndJoinCheck("Are you sure you want to leave your current lobby?");
		} else {
			SteamLobbyAPI.Join(steamid);
		}
	}

	static leave() {
		if (this.isLobbyOwner() && this.getLobbyMemberCount() > 1) {
			UiToolkitAPI.ShowGenericPopupOkCancel(
				"Leave current lobby?",
				"You are currently owner of this lobby! Leaving will transfer ownership to another player. Are you sure you want to leave?",
				"ok-cancel-popup",
				() => SteamLobbyAPI.Leave(),
				() => {}
			);
		} else {
			SteamLobbyAPI.Leave();
		}
	}

	static create() {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			"",
			"file://{resources}/layout/popups/popup_lobbycreate.xml",
			"isinlobby=" + +this.isInLobby() + "&islobbyowner=" + +this.isLobbyOwner() // Cast to int to pass as attribute
		);
	}

	static showLobbySettings() {
		const lobbyData = this.getFirstLobbyObj(Lobby.lobbyCurrentData);

		UiToolkitAPI.ShowCustomLayoutPopupParameters("", "file://{resources}/layout/popups/popup_lobbysettings.xml", "type=" + lobbyData["type"] + "&maxplayers=" + lobbyData["members_limit"]);
	}

	static showLobbyDetails() {
		$.GetContextPanel().FindChildTraverse("LobbyDetailsContainer").RemoveClass("drawer-lobby__lobby-details--hidden");
		$.GetContextPanel().FindChildTraverse("LobbyListContainer").AddClass("drawer-lobby__lobby-list--hidden");
	}

	static showLobbyList() {
		$.GetContextPanel().FindChildTraverse("LobbyListContainer").RemoveClass("drawer-lobby__lobby-list--hidden");
		$.GetContextPanel().FindChildTraverse("LobbyDetailsContainer").AddClass("drawer-lobby__lobby-details--hidden");

		Lobby.recreateLobbyListChildren();
	}

	static refreshLobbyList() {
		const refreshButton = $.GetContextPanel().FindChildTraverse("LobbyRefreshButton");

		if (SteamLobbyAPI.RefreshList({ this_is_where_filters_will_go_in_the_future: "true" })) {
			$.GetContextPanel().FindChildTraverse("LobbyRefreshIcon").AddClass("spin-clockwise"); // Removed when onSteamLobbyListUpdated is called

			refreshButton.enabled = false;
			$.Schedule(Lobby.refreshCooldown, () => (refreshButton.enabled = true));

			let cooldown = Lobby.refreshCooldown;
			let isRefreshHovered;
			const cooldownMessage = () => UiToolkitAPI.ShowTextTooltip(refreshButton.id, `Refresh is on cooldown, please wait ${cooldown} seconds.`);
			const cooldownTimer = function () {
				if (isRefreshHovered) cooldownMessage();

				refreshButton.SetPanelEvent("onmouseover", () => {
					isRefreshHovered = true;
					cooldownMessage();
				});

				refreshButton.SetPanelEvent("onmouseout", () => {
					isRefreshHovered = false;
					UiToolkitAPI.HideTextTooltip();
				});

				cooldown -= 1.0;

				if (cooldown >= 0) $.Schedule(1.0, () => cooldownTimer());
				else {
					refreshButton.ClearPanelEvent("onmouseover");
					refreshButton.ClearPanelEvent("onmouseout");
					if (isRefreshHovered) UiToolkitAPI.HideTextTooltip();
				}
			};
			cooldownTimer();
		}
	}

	static recreateLobbyListChildren() {
		$.GetContextPanel().FindChildTraverse("LobbyList").RemoveAndDeleteChildren(); // Clear the current list

		const data = Lobby.lobbyListData;

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
					const ownerSteamID = lobbyObj["owner"];
					const lobbyType = lobbyObj["type"];
					const lobbyName = FriendsAPI.GetNameForXUID(ownerSteamID) + "'s Lobby";

					if (!lobbyName.includes($.GetContextPanel().FindChildTraverse("LobbySearch").text)) return; // Only show items that match the search. Always true if search is empty

					const newPanel = $.CreatePanel("Panel", $.GetContextPanel().FindChildTraverse("LobbyList"), ""); // Create the new panel

					newPanel.LoadLayoutSnippet("lobby-list-entry");

					const joinCallback = () => (origin === "current" ? Lobby.showLobbyDetails() : Lobby.join(lobbySteamID));
					newPanel.SetPanelEvent("ondblclick", joinCallback);
					newPanel.FindChildTraverse("LobbyJoinButton").SetPanelEvent("onactivate", joinCallback);

					const typePanel = newPanel.FindChildTraverse("LobbyType");
					const typeIcon = "file://{images}/online/" + this.lobbyTypes[lobbyType].icon + ".svg";
					typePanel.SetImage(typeIcon);
					typePanel.SetPanelEvent("onmouseover", () => UiToolkitAPI.ShowTitleImageTextTooltipStyled(typePanel.id, "", typeIcon, this.lobbyTypes[lobbyType].name, "tooltip--notitle"));

					const avatarPanel = newPanel.FindChildTraverse("LobbyPlayerAvatar");
					avatarPanel.steamid = ownerSteamID;
					Lobby.setUserContextMenu(avatarPanel, ownerSteamID);

					newPanel.SetDialogVariable("lobbyTitle", lobbyName);
					newPanel.SetDialogVariable("lobbyPlayerCount", lobbyObj["members"] + "/" + lobbyObj["members_limit"]);
					newPanel.SetDialogVariable("lobbyJoinLabel", origin === "current" ? "Details" : "Join");

					const originPanel = newPanel.FindChildTraverse("LobbyOrigin");
					if (origin === "global") originPanel.AddClass("lobby-lobbies__origin--global");
					else if (origin === "friends") originPanel.AddClass("lobby-lobbies__origin--friends");
					else originPanel.AddClass("lobby-lobbies__origin--current");
				});
			});
	}

	static updateCurrentLobbyDetails() {
		const lobbyData = Lobby.getFirstLobbyObj(Lobby.lobbyCurrentData);
		const owner = lobbyData["owner"];
		const type = lobbyData["type"];

		$.GetContextPanel()
			.FindChildTraverse("LobbyDetailsType")
			.SetImage("file://{images}/online/" + Lobby.lobbyTypes[type].icon + ".svg");
		$.GetContextPanel().FindChildTraverse("LobbyDetailsSettingsButton").enabled = UserAPI.GetXUID() == owner; // Only enable settings if you're lobby owner
		$.GetContextPanel()
			.FindChildTraverse("LobbyDetailsTitle")
			.SetDialogVariable("lobbyTitle", FriendsAPI.GetNameForXUID(owner) + "'s Lobby");
		$.GetContextPanel()
			.FindChildTraverse("LobbyDetailsPlayerCount")
			.SetDialogVariable("lobbyPlayerCount", lobbyData["members"] + "/" + lobbyData["members_limit"]);
	}

	static updateMemberListItem(memberSteamID) {
		let memberData = Lobby.lobbyMemberData[memberSteamID];
		let panel = memberData["panel"];

		if (typeof panel === typeof undefined) {
			panel = $.CreatePanel("Panel", $.GetContextPanel().FindChildTraverse("LobbyDetailsMemberList"), "");
			panel.LoadLayoutSnippet("lobby-member-entry");
			Lobby.lobbyMemberData[memberSteamID]["panel"] = panel;
		}

		panel.FindChildTraverse("MemberAvatar").steamid = memberSteamID;
		panel.SetDialogVariable("memberName", FriendsAPI.GetNameForXUID(memberSteamID));

		const memberMap = memberData["map"];
		const localSteamID = UserAPI.GetXUID();
		const localMap = typeof Lobby.lobbyMemberData[localSteamID] !== typeof undefined ? Lobby.lobbyMemberData[localSteamID]["map"] : undefined;

		panel.SetDialogVariable("memberMap", memberMap ? memberMap : "In main menu");

		const memberStatePanel = panel.FindChildTraverse("MemberState");
		const isSpectating = memberData["isSpectating"];

		const joinButton = panel.FindChildTraverse("MemberJoinButton");
		joinButton.AddClass("hide");
		memberStatePanel.AddClass("hide");

		if (memberSteamID !== localSteamID) {
			/* Currently I don't there's a reliable way to do this
			if (memberMap && ( !local_map_data || memberMap !== local_map_data['name'])) // Are they on a map and we are either not on one or a different one?
			{
				panel.SetDialogVariable('member_joinlabel', "JOIN MAP");
				panel.FindChildTraverse('MemberJoinButton').SetPanelEvent('onactivate', function()
				{
					// UNDONE: Map cache support
					GameInterfaceAPI.ConsoleCommand("map " + memberMap);
				});
			}
			else if (memberMap && memberMap === local_map_data['name'])
			*/

			// Hide the spectate button if we're not on the same map. In future add map joining using above code

			Lobby.setUserContextMenu(panel, memberSteamID);

			if (isSpectating) {
				const specTargetName = FriendsAPI.GetNameForXUID(memberData["specTargetID"]);
				memberStatePanel.SetImage("file://{images}/chat/spectatingIcon.svg");
				memberStatePanel.RemoveClass("hide");
				memberStatePanel.SetPanelEvent("onmouseover", () =>
					UiToolkitAPI.ShowTitleImageTextTooltipStyled(memberStatePanel.id, "", "file://{images}/chat/spectatingIcon.svg", `Specating <b>${specTargetName}</b>`, "tooltip--notitle")
				);
			} else {
				memberStatePanel.ClearPanelEvent("onmouseover");
				if (memberMap) {
					memberStatePanel.SetImage("file://{images}/topnav/play.svg");
					memberStatePanel.RemoveClass("hide");
					if (memberMap === localMap && memberMap && localMap) {
						joinButton.SetDialogVariable("memberJoinLabel", "Spectate");
						joinButton.RemoveClass("hide");

						const joinCallback = () => GameInterfaceAPI.ConsoleCommand("mom_spectate " + memberSteamID);

						panel.SetPanelEvent("ondblclick", joinCallback);
						panel.FindChildTraverse("MemberJoinButton").SetPanelEvent("onactivate", joinCallback);
					}
				}
			}
		}
	}

	static onSteamLobbyStateChanged(newState) {
		if (newState === "leave") {
			Lobby.lobbyMemberData = {};
			Lobby.lobbyCurrentData = {};

			$.GetContextPanel().FindChildTraverse("LobbyDetailsMemberList").RemoveAndDeleteChildren();

			delete Lobby.lobbyListData["current"];

			$.DispatchEvent("OnLobbyButtonImageChange", "file://{images}/sidepanel/lobby.svg");

			Lobby.showLobbyList();
		} else if (newState === "join") {
			Lobby.showLobbyDetails();
		}
	}

	static onSteamLobbyListUpdated(data) {
		if (data === undefined) return;

		// This is either friends or global
		const origin = Object.keys(data)[0];
		Lobby.lobbyListData[origin] = data[origin];

		Lobby.recreateLobbyListChildren();
		$.GetContextPanel().FindChildTraverse("LobbyRefreshIcon").RemoveClass("spin-clockwise");
	}

	static onSteamLobbyDataUpdated(data) {
		if (data !== Lobby.lobbyCurrentData) {
			const oldType = Object.keys(Lobby.lobbyCurrentData).length > 0 ? Lobby.getFirstLobbyObj(Lobby.lobbyCurrentData)["type"] : undefined;
			const newType = Lobby.getFirstLobbyObj(data)["type"];

			if (oldType !== newType) $.DispatchEvent("OnLobbyButtonImageChange", "file://{images}/online/" + Lobby.lobbyTypes[newType].icon + ".svg");

			Lobby.lobbyListData["current"] = data;
			Lobby.lobbyCurrentData = data;

			Lobby.updateCurrentLobbyDetails();
		}
	}

	static onSteamLobbyMemberDataUpdated(data) {
		Object.keys(data).forEach((memberSteamID) => {
			const localID = UserAPI.GetXUID();
			const oldMap = typeof Lobby.lobbyMemberData[localID] !== typeof undefined ? Lobby.lobbyMemberData[localID]["map"] : undefined;
			const newMap = data[memberSteamID]["map"];

			if (memberSteamID in Lobby.lobbyMemberData) Object.keys(data[memberSteamID]).forEach((item) => (Lobby.lobbyMemberData[memberSteamID][item] = data[memberSteamID][item]));
			else Lobby.lobbyMemberData[memberSteamID] = data[memberSteamID];

			// If local player has just joined a new map, update the join/spectate buttons for all other player panels
			if (memberSteamID === localID && oldMap !== newMap) Object.keys(Lobby.lobbyMemberData).forEach((member) => Lobby.updateMemberListItem(member));
			else Lobby.updateMemberListItem(memberSteamID);
		});
	}

	static onSteamLobbyMemberStateChanged(memberSteamID, changeType) {
		if (changeType === "leave") {
			Lobby.lobbyMemberData[memberSteamID]["panel"].DeleteAsync(0.0);
			delete Lobby.lobbyMemberData[memberSteamID];
		}
	}

	static setUserContextMenu(panel, steamID) {
		panel.SetPanelEvent("oncontextmenu", () =>
			UiToolkitAPI.ShowSimpleContextMenu(panel, "", [{ label: "Show Steam Profile", jsCallback: () => SteamOverlayAPI.OpenToProfileID( steamID ) }])
		);
	}

	static isInLobby() {
		return "current" in this.lobbyListData;
	}

	static isLobbyOwner() {
		return this.isInLobby() ? this.getFirstLobbyObj(this.lobbyListData["current"])["owner"] == UserAPI.GetXUID() : false;
	}

	static getLobbyMemberCount() {
		return Lobby.getFirstLobbyObj(Lobby.lobbyCurrentData)["members"];
	}

	static getFirstLobbyObj(data) {
		return data[Object.keys(data)[0]];
	}
}

(function () {
	// Watch out: these callbacks work a bit different to Steamworks: We will only receive data for our own lobby automatically
	// And only the list update will give us anything else via OnListUpdated
	$.RegisterForUnhandledEvent("PanoramaComponent_SteamLobby_OnListUpdated", Lobby.onSteamLobbyListUpdated);
	$.RegisterForUnhandledEvent("PanoramaComponent_SteamLobby_OnDataUpdated", Lobby.onSteamLobbyDataUpdated);
	$.RegisterForUnhandledEvent("PanoramaComponent_SteamLobby_OnMemberDataUpdated", Lobby.onSteamLobbyMemberDataUpdated);
	$.RegisterForUnhandledEvent("PanoramaComponent_SteamLobby_OnMemberStateChanged", Lobby.onSteamLobbyMemberStateChanged);
	$.RegisterForUnhandledEvent("PanoramaComponent_SteamLobby_OnLobbyStateChanged", Lobby.onSteamLobbyStateChanged);
	$.RegisterForUnhandledEvent("RefreshLobbyList", Lobby.refreshLobbyList);
})();
