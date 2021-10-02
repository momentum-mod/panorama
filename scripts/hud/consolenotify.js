class ConsoleNotify
{
	static scheduleOpacity = -1;
	static onNewMessages()
	{
		if (ConsoleNotify.scheduleOpacity !== -1) {
			$.CancelScheduled(ConsoleNotify.scheduleOpacity);
			ConsoleNotify.scheduleOpacity = -1;
		}
		else
		{
			$.GetContextPanel().style.opacity = '1.0';
		}
		ConsoleNotify.scheduleOpacity = $.Schedule(5.0, ConsoleNotify.scheduledHide);

	}

	static scheduledHide()
	{
		ConsoleNotify.scheduleOpacity = -1;
		$.GetContextPanel().style.opacity = '0.0';
	}
}

(function()
{
	$.RegisterEventHandler('NewConsoleMessages', 'NotifyMessageTarget', ConsoleNotify.onNewMessages);
})();
