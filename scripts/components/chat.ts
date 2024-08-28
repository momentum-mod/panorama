import { PanelHandler } from 'util/module-helpers';
import { MemberData } from 'common/online';

@PanelHandler()
class ChatHandler {
	membersTyping: string[] = [];
	typingLabel = $<Label>('#ChatMemberTypingLabel');

	constructor() {
		$.RegisterEventHandler('OnNewChatEntry', $.GetContextPanel(), (panel) => this.onNewChatEntry(panel));

		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberDataUpdated', (memberData: MemberData) =>
			this.onSteamLobbyMemberDataUpdated(memberData)
		);
	}

	submitText() {
		$.GetContextPanel<MomentumChat>().SubmitText();
	}

	createUsersTypingString() {
		let strTyping = '';
		const typingLen = this.membersTyping.length;

		// TODO: We may run into issues with this in localisation, this seems like it may be specific to English
		if (typingLen > 0) {
			if (typingLen < 3) {
				for (const [i, memberSteamID] of this.membersTyping.entries()) {
					if (i !== 0 && i !== typingLen - 1) {
						strTyping += ', ';
					} else if (i !== 0 && i === typingLen - 1) {
						strTyping += ` ${$.Localize('#Chat_Typing_Conjugate')} `;
					}
					strTyping += FriendsAPI.GetNameForXUID(memberSteamID);
				}
				strTyping +=
					typingLen === 1
						? ' ' + $.Localize('#Chat_Typing_Specific')
						: ' ' + $.Localize('#Chat_Typing_Multiple');
			} else {
				strTyping += typingLen + ' ' + $.Localize('#Chat_Typing_Many');
			}
		} else {
			strTyping += ' ';
		}

		return strTyping;
	}

	onNewChatEntry(panel: GenericPanel) {
		$.Schedule(0, () => panel.ScrollParentToMakePanelFit(0, false)); // IDK, ScrollToBottom always just scrolled to the second last msg
		// Emote test for BLT to look into
		// let messageLabel = panel.GetChild(0);
		// let message = messageLabel.text;
		// message = message.replace(/dogathan/g, "<img src='file://{images}/emotes/dogathan.png' height='16' width='16'/>");
		// message = message.replace(/a/g, 'ä').replace(/o/g, 'ö').replace(/u/g, 'ü');
		// messageLabel.text = message;

		// TODO: Would be good to let you mute players from the specific chat message esp in large lobbies
		// where it's hard to find them in the lobby list, but we need the steam id passed in somewhere

		// panel.SetPanelEvent('oncontextmenu', () => {
		// 	UiToolkitAPI.ShowSimpleContextMenu(panel, '', [
		// 		{
		// 			label: 'Mute Player',
		// 			icon: 'file://{images}/volume-mute.svg',
		// 			style: 'icon-color-red',
		// 			jsCallback: () => ChatAPI.ChangeMuteState(needs steam id!!!, true)
		// 		}
		// 	]);
		// });
	}

	onSteamLobbyMemberDataUpdated(memberData: MemberData) {
		if (!this.typingLabel || !this.typingLabel.visible) return;

		for (const memberSteamID of Object.keys(memberData)) {
			if (memberSteamID === UserAPI.GetXUID()) return;

			const index = this.membersTyping.indexOf(memberSteamID);

			if (index === -1 && memberData[memberSteamID].isTyping === 'y') {
				this.membersTyping.push(memberSteamID);
			} else if (index !== -1) {
				this.membersTyping.splice(index, 1);
			}
		}

		this.typingLabel.text = this.createUsersTypingString();
	}
}
