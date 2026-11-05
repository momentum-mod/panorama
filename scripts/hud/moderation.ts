import { formatDuration } from 'util/strings';
import ChatBanType = MomentumAPI.ChatBanType;

// Toasts for the moderation systems. Lives on the HUD since both the chat/voice
// ban and the player report flows are only reachable in-game.

const shownBanToasts = new Set<ChatBanType>();

function onCommunicationBlocked(type: ChatBanType) {
	// Banned players can keep talking, so this would otherwise show on every message
	if (shownBanToasts.has(type)) return;
	shownBanToasts.add(type);

	const secondsRemaining = MomentumAPI.GetChatBanSecondsRemaining(type);
	const reason = MomentumAPI.GetChatBanReason(type);

	const title = $.Localize(type === ChatBanType.VOICE ? '#Ban_Voice_Title' : '#Ban_Chat_Title');

	// -1 means the ban never expires
	let message =
		secondsRemaining === -1
			? $.Localize('#Ban_Permanent')
			: $.Localize('#Ban_Expires').replace('%duration%', () => formatDuration(secondsRemaining));

	if (reason) {
		message += `\n${$.Localize('#Ban_Reason').replace('%reason%', () => reason)}`;
	}

	ToastAPI.CreateToast('', title, message, ToastAPI.ToastLocation.RIGHT, 10, '', ToastAPI.ToastStyle.ERROR);
}

function onPlayerReported(success: boolean) {
	ToastAPI.CreateToast(
		'',
		'',
		$.Localize(success ? '#Report_Player_Success' : '#Report_Player_Failure'),
		ToastAPI.ToastLocation.RIGHT,
		10,
		'',
		success ? ToastAPI.ToastStyle.SUCCESS : ToastAPI.ToastStyle.ERROR
	);
}

$.RegisterForUnhandledEvent('LevelInitPostEntity', () => shownBanToasts.clear());
$.RegisterForUnhandledEvent('MomAPI_CommunicationBlocked', (type) => onCommunicationBlocked(type));
$.RegisterForUnhandledEvent('MomAPI_PlayerReported', (success) => onPlayerReported(success));
