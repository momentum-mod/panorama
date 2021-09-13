class Chat {
	static arrMembersTyping = [];
	static typingLabel;

	static submitText() {
		$.GetContextPanel().SubmitText();
	}

	static onNewChatEntry(panel) {
		$.Schedule( .1, () => panel.ScrollParentToMakePanelFit( 0, false ) ) ; // IDK, ScrollToBottom always just scrolled to the second last msg
	}

	static onSteamLobbyMemberDataUpdated(data)
	{
		if (!Chat.typingLabel || !Chat.typingLabel.visible)
			return;

		Object.keys(data).forEach( member_steamid => {
			if (member_steamid === UserAPI.GetXUID()) {
				return;
			}

			const index = Chat.arrMembersTyping.indexOf(member_steamid);

			if (index === -1 && data[member_steamid]['isTyping'] === 'y') {
				Chat.arrMembersTyping.push(member_steamid);
			}
			else if (index !== -1) {
				Chat.arrMembersTyping.splice(index, 1);
			}
		})

		let strTyping = "";
		let typingLen = Chat.arrMembersTyping.length;

		// Just some simplified logic for the time being. TODO: do it properly
		if (typingLen > 0) {
			if (typingLen < 3) {
				Chat.arrMembersTyping.forEach(function(member_steamid, i) {
					if (i !== 0 && i !== typingLen - 1)
						strTyping += ", ";
					else if ( i!== 0 && i === typingLen - 1)
						strTyping += " and ";
					strTyping += FriendsAPI.GetNameForXUID(member_steamid);
				})
				strTyping += (typingLen === 1) ? " is typing" : " are typing";
			}
			else {
				strTyping += typingLen + " people are typing";
			}
		}
		else {
			strTyping += " ";
		}

		Chat.typingLabel.text = strTyping;
	}
}

(function() {
	$.RegisterEventHandler('OnNewChatEntry', $.GetContextPanel(), Chat.onNewChatEntry);
	$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberDataUpdated', Chat.onSteamLobbyMemberDataUpdated);

	Chat.typingLabel = $('#ChatMemberTypingLabel');
})();