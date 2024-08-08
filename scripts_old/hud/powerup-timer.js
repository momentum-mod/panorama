"use strict";
class PowerupTimer {
    static panels = {
        damageBoost: {
            panel: $('#DamageBoostTimer'),
            label: $('#DamageBoostLabel')
        },
        haste: {
            panel: $('#HasteTimer'),
            label: $('#HasteLabel')
        },
        slick: {
            panel: $('#SlickTimer'),
            label: $('#SlickLabel')
        }
    };
    static onUpdate() {
        const { damageBoostTime, hasteTime, slickTime } = MomentumMovementAPI.GetLastMoveData();
        this.updatePanel(this.panels.damageBoost, damageBoostTime);
        this.updatePanel(this.panels.haste, hasteTime);
        this.updatePanel(this.panels.slick, slickTime);
    }
    static updatePanel({ panel, label }, time) {
        if (!time) {
            panel.visible = false;
        }
        else {
            panel.visible = true;
            label.text = time < 0 ? '∞' : Math.ceil(time / 1000).toString();
        }
    }
    static {
        _.Util.RegisterHUDPanelForGamemode({
            gamemodes: _.Web.GamemodeCategories.get(_.Web.GamemodeCategory.DEFRAG),
            context: this,
            contextPanel: $.GetContextPanel(),
            handledEvents: [{ event: 'HudProcessInput', contextPanel: $.GetContextPanel(), callback: this.onUpdate }]
        });
    }
}
