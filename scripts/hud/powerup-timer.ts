class PowerupTimer {
	static panels = {
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

	static onUpdate() {
		// @ts-expect-error - TODO: Types for this API!
		const { damageBoostTime, hasteTime, slickTime } = MomentumMovementAPI.GetLastMoveData();

		this.updatePanel(this.panels.damageBoost, damageBoostTime);
		this.updatePanel(this.panels.haste, hasteTime);
		this.updatePanel(this.panels.slick, slickTime);
	}

	static updatePanel({ panel, label }: { panel: Panel; label: Label }, time: number) {
		if (!time) {
			panel.visible = false;
		} else {
			panel.visible = true;
			label.text = time < 0 ? '∞' : Math.ceil(time / 1000).toString();
		}
	}

	static {
		RegisterEventForGamemodes([GameMode.DEFRAG], 'HudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));
	}
}
