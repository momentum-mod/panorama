import ChatBanType = MomentumAPI.ChatBanType;

// Toasts for the moderation systems. Lives on the HUD since both the chat/voice
// ban and the player report flows are only reachable in-game.

/** Turns seconds remaining into something like "2 days" or "35 minutes". */
function formatDuration(seconds: number): string {
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) {
		return `${minutes} ${$.Localize(minutes === 1 ? '#Time_Minute' : '#Time_Minutes')}`;
	}

	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours} ${$.Localize(hours === 1 ? '#Time_Hour' : '#Time_Hours')}`;
	}

	const days = Math.round(hours / 24);
	return `${days} ${$.Localize(days === 1 ? '#Time_Day' : '#Time_Days')}`;
}

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
