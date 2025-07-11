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

	readonly strs = {
		oneUser: $.Localize('#Chat_Typing_1User'),
		twoUsers: $.Localize('#Chat_Typing_2Users'),
		many: $.Localize('#Chat_Typing_Many')
	};

	createUsersTypingString(): string {
		const numTyping = this.membersTyping.length;

		// 0  => ''
		// 1  => %user% is typing...
		// 2  => %user1% and %user2% are typing...
		// 3+ => %amount% users are typing...

		switch (numTyping) {
			case 0:
				return '';
			case 1: {
				const user1 = FriendsAPI.GetNameForXUID(this.membersTyping[0]);
				return this.strs.oneUser.replace('%user1%', user1);
			}
			case 2: {
				const user1 = FriendsAPI.GetNameForXUID(this.membersTyping[0]);
				const user2 = FriendsAPI.GetNameForXUID(this.membersTyping[1]);
				return this.strs.twoUsers.replace('%user1%', user1).replace('%user2%', user2);
			}
			default:
				return this.strs.many.replace('%amount%', numTyping.toString());
		}
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
