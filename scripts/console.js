'use strict';

class Console {
	/** @type {StaticConsoleMessageTarget} @static */
	static messageTarget = $('#ConsoleMessageTarget');

	static onMoveDragStart(_source, callback) {
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
		$.RegisterEventHandler('DragStart', $('#MoveDragArea'), Console.onMoveDragStart);
		$.RegisterEventHandler('NewConsoleMessages', 'ConsoleMessageTarget', Console.onNewMessages.bind(this));
	}
}
