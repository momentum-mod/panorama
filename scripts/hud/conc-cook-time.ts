import { Component } from 'util/component';

@Component
class ConcCookComponent {
	cp = $.GetContextPanel<MomHudConcCookTime>();
	cookMeter = $<ProgressBar>('#ConcCookMeter');
	cookLabel = $<Label>('#ConcCookTime');

	onCookUpdate(time: float, percentage: float) {
		this.cookMeter.value = percentage;

		const labelEnabled = this.cp.concTimerLabelEnabled;
		this.cookLabel.visible = labelEnabled;
		if (labelEnabled) {
			this.cookLabel.text = `${time.toFixed(2)}${$.Localize('#Run_Stat_Unit_Second')}`;
		}
	}

	constructor() {
		$.RegisterEventHandler('OnCookUpdate', $('#ConcCooktimeContainer'), (time: float, percentage: float) =>
			this.onCookUpdate(time, percentage)
		);
	}
}
