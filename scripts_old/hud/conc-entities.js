"use strict";
class ConcEntities {
    static cp = $.GetContextPanel();
    static container = $('#ConcEntPanelsContainer');
    static onEntPanelThink() {
        this.container
            .Children()
            .filter((entpanel) => entpanel.HasClass('conc-ent'))
            .forEach((entpanel) => {
            const meterEnabled = this.cp.concEntPanelProgressBarEnabled;
            const meter = entpanel.FindChildTraverse('ConcTimeMeter');
            meter.visible = meterEnabled;
            if (meterEnabled)
                meter.value = entpanel.concPrimedPercent;
            const labelEnabled = this.cp.concEntPanelTimerLabelEnabled;
            const label = entpanel.FindChildTraverse('ConcTimeLabel');
            label.visible = labelEnabled;
            if (labelEnabled) {
                label.text = `${entpanel.concPrimedTime.toFixed(2)}s`;
            }
            entpanel.style.opacity = entpanel.concDistanceFadeAlpha;
        });
    }
    static {
        $.RegisterEventHandler('OnConcEntityPanelThink', this.container, this.onEntPanelThink.bind(this));
    }
}
