class ConsoleNotify {
	static scheduleOpacity = -1;

	static onNewMessages() {
		if (this.scheduleOpacity !== -1) {
			$.CancelScheduled(ConsoleNotify.scheduleOpacity);
			this.scheduleOpacity = -1;
		} else {
			$.GetContextPanel().style.opacity = '1.0';
		}
		this.scheduleOpacity = $.Schedule(5, ConsoleNotify.scheduledHide);
	}

	static scheduledHide() {
		ConsoleNotify.scheduleOpacity = -1;
		$.GetContextPanel().style.opacity = '0.0';
	}

	static {
		$.RegisterEventHandler('NewConsoleMessages', 'NotifyMessageTarget', this.onNewMessages.bind(this));
	}
}
