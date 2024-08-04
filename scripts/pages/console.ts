class Console {
	static messageTarget = $<StaticConsoleMessageTarget>('#ConsoleMessageTarget');

	static onMoveDragStart(_source: unknown, callback: DragEventInfo) {
		callback.displayPanel = $.GetContextPanel();
		callback.removePositionBeforeDrop = false;
	}

	static toggle() {
		$.DispatchEvent('ToggleConsole');
	}

	static onNewMessages() {
		this.messageTarget.ScrollToBottom();
	}

	static {
		$.RegisterEventHandler('DragStart', $('#MoveDragArea'), this.onMoveDragStart.bind(this));
		$.RegisterEventHandler('NewConsoleMessages', 'ConsoleMessageTarget', Console.onNewMessages.bind(this));
	}
}
