import { PanelHandler } from 'util/module-helpers';
import { MemberData } from 'common/online';

@PanelHandler()
class ChatHandler {
	membersTyping: string[] = [];
	typingLabel = $<Label>('#ChatMemberTypingLabel')!;
	history = $('#ChatHistory')!;

	lastLayoutHeight: number = 0;

	constructor() {
		$.RegisterEventHandler('OnNewChatEntry', $.GetContextPanel(), (panel) => this.onNewChatEntry(panel));

		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnMemberDataUpdated', (memberData: MemberData) =>
			this.onSteamLobbyMemberDataUpdated(memberData)
		);

		// Hacks to scroll to bottom when opening chat / joining/leaving a lobby.
		// Whether or not scrolling works seems to corresponding to IsReadyForDisplay(), but
		// I can't get RegisterForReadyEvents/ReadyForDisplay to fire at all.
		// This timing appears consistent in debug so *hopefully* fine for everyone,
		// but obviously an event-based approach would be preferred in the future.
		$.RegisterForUnhandledEvent('HudChat_Show', () => {
			$.Schedule(0.1, () => this.history.ScrollToBottom());
		});

		$.RegisterForUnhandledEvent('PanoramaComponent_SteamLobby_OnLobbyStateChanged', () =>
			$.Schedule(0.1, () => this.history.ScrollToBottom())
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

	onNewChatEntry(_panel: GenericPanel) {
		const scrollOffset = -this.history.scrolloffset_y; // scrolloffset_y is always negative
		const containerHeight = this.history.contentheight;
		const containerScreenHeight = this.history.actuallayoutheight;
		const proportionScrolled = scrollOffset / (containerHeight - containerScreenHeight);

		$.Msg({
			scrollOffset,
			containerHeight,
			containerScreenHeight,
			proportionScrolled
		});

		// $.Schedule(0.1, () => (this.lastLayoutHeight = this.history.actuallayoutheight));
		this.lastLayoutHeight = this.history.actuallayoutheight;

		this.history.ScrollToBottom();
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
