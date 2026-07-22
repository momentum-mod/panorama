import { formatDuration } from 'util/strings';
import ChatBanType = MomentumAPI.ChatBanType;

// Toasts for the moderation systems. Lives on the HUD since both the chat/voice
// ban and the player report flows are only reachable in-game.

function onCommunicationBlocked(type: ChatBanType) {
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

	ToastAPI.CreateToast(
		// Reusing an ID per ban type so spamming the key doesn't stack toasts
		type === ChatBanType.VOICE ? 'voice-ban' : 'chat-ban',
		title,
		message,
		ToastAPI.ToastLocation.RIGHT,
		10,
		'',
		ToastAPI.ToastStyle.ERROR
	);
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

$.RegisterForUnhandledEvent('MomAPI_CommunicationBlocked', (type) => onCommunicationBlocked(type));
$.RegisterForUnhandledEvent('MomAPI_PlayerReported', (success) => onPlayerReported(success));
