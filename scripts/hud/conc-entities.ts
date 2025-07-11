import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ConcEntitiesHandler {
	cp = $.GetContextPanel<MomHudConcEntities>();
	container = $('#ConcEntPanelsContainer');

	constructor() {
		$.RegisterEventHandler('OnConcEntityPanelThink', this.container, () => this.onEntPanelThink());
	}

	onEntPanelThink() {
		this.container
			.Children()
			.filter((entpanel): entpanel is MomConcEntityPanel => entpanel.HasClass('conc-ent'))
			.forEach((entpanel) => {
				const meterEnabled = this.cp.concEntPanelProgressBarEnabled;
				const meter = entpanel.FindChildTraverse<ProgressBar>('ConcTimeMeter');
				meter.visible = meterEnabled;
				if (meterEnabled) {
					meter.value = entpanel.concPrimedPercent;
				}

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
