"use strict";
class Console {
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
        $.RegisterEventHandler('DragStart', $('#MoveDragArea'), this.onMoveDragStart.bind(this));
        $.RegisterEventHandler('NewConsoleMessages', 'ConsoleMessageTarget', Console.onNewMessages.bind(this));
    }
}
