"use strict";
class ConcCook {
    static cp = $.GetContextPanel();
    static cookMeter = $('#ConcCookMeter');
    static cookLabel = $('#ConcCookTime');
    static onCookUpdate(time, percentage) {
        this.cookMeter.value = percentage;
        const labelEnabled = this.cp.concTimerLabelEnabled;
        this.cookLabel.visible = labelEnabled;
        if (labelEnabled) {
            this.cookLabel.text = `${time.toFixed(2)}${$.Localize('#Run_Stat_Unit_Second')}`;
        }
    }
    static {
        $.RegisterEventHandler('OnCookUpdate', $('#ConcCooktimeContainer'), (time, percentage) => this.onCookUpdate(time, percentage));
    }
}
