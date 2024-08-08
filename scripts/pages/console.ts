class Console {
messageTarget = $<StaticConsoleMessageTarget>('#ConsoleMessageTarget');

onMoveDragStart(_source: unknown, callback: DragEventInfo) {
		callback.displayPanel = $.GetContextPanel();
		callback.removePositionBeforeDrop = false;
	}

toggle() {
		$.DispatchEvent('ToggleConsole');
	}

onNewMessages() {
		this.messageTarget.ScrollToBottom();
	}

constructor() {
		$.RegisterEventHandler('DragStart', $('#MoveDragArea'), this.onMoveDragStart.bind(this));
		$.RegisterEventHandler('NewConsoleMessages', 'ConsoleMessageTarget', Console.onNewMessages.bind(this));
	}
}
