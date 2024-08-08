import { Component } from 'util/component';

@Component
class ConcEntitiesComponent {
	cp = $.GetContextPanel<MomHudConcEntities>();
	container = $('#ConcEntPanelsContainer');

	constructor() {
		$.RegisterEventHandler('OnConcEntityPanelThink', this.container, this.onEntPanelThink.bind(this));
	}

	onEntPanelThink() {
		this.container
			.Children()
			.filter((entpanel) => entpanel.HasClass('conc-ent'))
			.forEach((entpanel: MomConcEntityPanel) => {
				const meterEnabled = this.cp.concEntPanelProgressBarEnabled;
				const meter = entpanel.FindChildTraverse<ProgressBar>('ConcTimeMeter');
				meter.visible = meterEnabled;
				if (meterEnabled) meter.value = entpanel.concPrimedPercent;

				const labelEnabled = this.cp.concEntPanelTimerLabelEnabled;
				const label = entpanel.FindChildTraverse<Label>('ConcTimeLabel');
				label.visible = labelEnabled;
				if (labelEnabled) {
					label.text = `${entpanel.concPrimedTime.toFixed(2)}s`;
				}

				entpanel.style.opacity = entpanel.concDistanceFadeAlpha;
			});
	}
}
