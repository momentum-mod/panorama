'use strict';

class Console
{
	static onMoveDragStart(source, callback)
	{
		callback.displayPanel = $.GetContextPanel();
		callback.removePositionBeforeDrop = false;
	}

	static toggle()
	{
		$.DispatchEvent('ToggleConsole');
	}

	static onNewMessages()
	{
		$('#ConsoleMessageTarget').ScrollToBottom();
	}
}

(function()
{
	$.RegisterEventHandler('DragStart', $('#MoveDragArea'), Console.onMoveDragStart);
	$.RegisterEventHandler('NewConsoleMessages', 'ConsoleMessageTarget', Console.onNewMessages);
})();
