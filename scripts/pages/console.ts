import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ConsoleHandler {
	messageTarget = $<StaticConsoleMessageTarget>('#ConsoleMessageTarget');

	constructor() {
		$.RegisterEventHandler('DragStart', $('#MoveDragArea'), (panelID, source) =>
			this.onMoveDragStart(panelID, source)
		);
		$.RegisterEventHandler('NewConsoleMessages', 'ConsoleMessageTarget', () => this.onNewMessages());
	}

	onMoveDragStart(_panelID: string, callback: DragEventInfo) {
		callback.displayPanel = $.GetContextPanel();
		callback.removePositionBeforeDrop = false;
	}

	toggle() {
		$.DispatchEvent('ToggleConsole');
	}

	onNewMessages() {
		this.messageTarget.ScrollToBottom();
	}
}
