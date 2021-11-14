'use_strict';

class RangeColorDisplay {
    static colorDisplay = $('#ColorDisplay');
    static minEntry = $('#MinEntry');
    static maxEntry = $('#MaxEntry');

    // need to forward the colordisplay panelevent to parent
    static onColorChange() {
        $.GetContextPanel().color = RangeColorDisplay.colorDisplay.color;
        $.RegisterEventHandler('InputFocusLost', $.GetContextPanel(), RangeColorDisplay.onFocusLost);
    }

    // set bounds when focus is changed to be outside of the panel
    static onFocusLost(_panel) {
        if (RangeColorDisplay.minEntry.HasKeyFocus() || RangeColorDisplay.maxEntry.HasKeyFocus() || RangeColorDisplay.colorDisplay.HasKeyFocus()) return;
        $.GetContextPanel().SetBounds(parseFloat(RangeColorDisplay.minEntry.text), parseFloat(RangeColorDisplay.maxEntry.text));
    }
}
