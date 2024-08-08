class PowerupTimer {
panels = {
		damageBoost: {
			panel: $('#DamageBoostTimer')!,
			label: $<Label>('#DamageBoostLabel')!
		},
		haste: {
			panel: $('#HasteTimer')!,
			label: $<Label>('#HasteLabel')!
		},
		slick: {
			panel: $('#SlickTimer')!,
			label: $<Label>('#SlickLabel')!
		}
	};

onUpdate() {
		const { damageBoostTime, hasteTime, slickTime } = MomentumMovementAPI.GetLastMoveData();

		this.updatePanel(this.panels.damageBoost, damageBoostTime);
		this.updatePanel(this.panels.haste, hasteTime);
		this.updatePanel(this.panels.slick, slickTime);
	}

updatePanel({ panel, label }: { panel: GenericPanel; label: Label }, time: number) {
		if (!time) {
			panel.visible = false;
		} else {
			panel.visible = true;
			label.text = time < 0 ? '∞' : Math.ceil(time / 1000).toString();
		}
	}

constructor() {
		_.Util.RegisterHUDPanelForGamemode({
			gamemodes: _.Web.GamemodeCategories.get(_.Web.GamemodeCategory.DEFRAG),
			context: this,
			contextPanel: $.GetContextPanel(),
			handledEvents: [{ event: 'HudProcessInput', contextPanel: $.GetContextPanel(), callback: this.onUpdate }]
		});
	}
}
