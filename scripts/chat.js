"use strict";

class Chat {
	static arrMembersTyping = [];
	static typingLabel;

	static submitText() {
		$.GetContextPanel().SubmitText();
	}

	static createUsersTypingString(users) {
		let strTyping = "";
		let typingLen = users.length;

		// Just some simplified logic for the time being. TODO: do it properly
		if (typingLen > 0) {
			if (typingLen < 3) {
				Chat.arrMembersTyping.forEach(function (memberSteamID, i) {
					if (i !== 0 && i !== typingLen - 1) strTyping += ", ";
					else if (i !== 0 && i === typingLen - 1) strTyping += " and ";
					strTyping += FriendsAPI.GetNameForXUID(memberSteamID);
				});
				strTyping += typingLen === 1 ? " is typing" : " are typing";
			} else strTyping += typingLen + " people are typing";
		} else strTyping += " ";

		return strTyping;
	}

	static onNewChatEntry(panel) {
		$.Schedule(0.0, () => panel.ScrollParentToMakePanelFit(0, false)); // IDK, ScrollToBottom always just scrolled to the second last msg
		// TODO: Emote test for BLT to look into
		// let messageLabel = panel.GetChild(0);
		// let message = messageLabel.text;
		// message = message.replace(/dogathan/g, "<img src='file://{images}/emotes/dogathan.png' height='16' width='16'/>");
		// message = message.replace(/a/g, 'ä').replace(/o/g, 'ö').replace(/u/g, 'ü');
		// messageLabel.text = message;
	}

	static onSteamLobbyMemberDataUpdated(data) {
		if (!Chat.typingLabel || !Chat.typingLabel.visible) return;

		Object.keys(data).forEach((memberSteamID) => {
			if (memberSteamID === UserAPI.GetXUID()) {
				return;
			}

			const index = Chat.arrMembersTyping.indexOf(memberSteamID);

			if (index === -1 && data[memberSteamID]["isTyping"] === "y") {
				Chat.arrMembersTyping.push(memberSteamID);
			} else if (index !== -1) {
				Chat.arrMembersTyping.splice(index, 1);
			}
		});

		Chat.typingLabel.text = Chat.createUsersTypingString(Chat.arrMembersTyping);
	}
}

(function () {
	$.RegisterEventHandler("OnNewChatEntry", $.GetContextPanel(), Chat.onNewChatEntry);
	$.RegisterForUnhandledEvent("PanoramaComponent_SteamLobby_OnMemberDataUpdated", Chat.onSteamLobbyMemberDataUpdated);

	Chat.typingLabel = $.GetContextPanel().FindChildTraverse("ChatMemberTypingLabel");
})();
