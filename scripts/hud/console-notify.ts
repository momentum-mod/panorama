import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ConsoleNotifyHandler {
	cp = $.GetContextPanel();
	scheduleOpacity = -1;

	onNewMessages() {
		if (this.scheduleOpacity !== -1) {
			$.CancelScheduled(this.scheduleOpacity);
			this.scheduleOpacity = -1;
		} else {
			this.cp.style.opacity = '1.0';
		}
		this.scheduleOpacity = $.Schedule(5, () => this.scheduledHide());
	}

	scheduledHide() {
		this.scheduleOpacity = -1;
		this.cp.style.opacity = '0.0';
	}

	constructor() {
		$.RegisterEventHandler('NewConsoleMessages', 'NotifyMessageTarget', () => this.onNewMessages());
	}
}
