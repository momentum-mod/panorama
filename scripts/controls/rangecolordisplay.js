'use strict';

class RangeColorDisplay {
    static colorDisplay = $('#ColorDisplay');
    static minEntry = $('#MinEntry');
    static maxEntry = $('#MaxEntry');

    // need to forward the colordisplay panelevent to parent
    static onColorChange() {
        $.GetContextPanel().color = this.colorDisplay.color;
        $.RegisterEventHandler('InputFocusLost', $.GetContextPanel(), this.onFocusLost.bind(this));
    }

    // set bounds when focus is changed to be outside of the panel
    static onFocusLost(_panel) {
        if (this.minEntry.HasKeyFocus() || this.maxEntry.HasKeyFocus() || this.colorDisplay.HasKeyFocus()) return;
        
        $.GetContextPanel().SetBounds(parseFloat(this.minEntry.text), parseFloat(this.maxEntry.text));
    }
}
