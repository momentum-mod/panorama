class ConcEntities {
	static container = $('#ConcEntPanelsContainer');

	static onEntPanelThink() {
		for (const entpanel of this.container.Children().filter((entpanel) => entpanel.HasClass('conc-ent'))) {
			const meterEnabled = $.GetContextPanel().concEntPanelProgressBarEnabled;
			const meter = entpanel.FindChildTraverse('ConcTimeMeter');
			meter.visible = meterEnabled;
			if (meterEnabled) meter.value = entpanel.concPrimedPercent;

			const labelEnabled = $.GetContextPanel().concEntPanelTimerLabelEnabled;
			const label = entpanel.FindChildTraverse('ConcTimeLabel');
			label.visible = labelEnabled;
			if (labelEnabled) label.text = `${entpanel.concPrimedTime.toFixed(2)}s`;

			entpanel.style.opacity = entpanel.concDistanceFadeAlpha;
		}
	}

	static {
		$.RegisterEventHandler('OnConcEntityPanelThink', this.container, this.onEntPanelThink.bind(this));
	}
}
