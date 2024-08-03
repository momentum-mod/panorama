class ConsoleNotify {
	static cp = $.GetContextPanel();
	static scheduleOpacity = -1;

	static onNewMessages() {
		if (this.scheduleOpacity !== -1) {
			$.CancelScheduled(this.scheduleOpacity);
			this.scheduleOpacity = -1;
		} else {
			this.cp.style.opacity = '1.0';
		}
		this.scheduleOpacity = $.Schedule(5, () => this.scheduledHide());
	}

	static scheduledHide() {
		this.scheduleOpacity = -1;
		this.cp.style.opacity = '0.0';
	}

	static {
		$.RegisterEventHandler('NewConsoleMessages', 'NotifyMessageTarget', this.onNewMessages.bind(this));
	}
}
