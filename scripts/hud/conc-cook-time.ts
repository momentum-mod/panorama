import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class ConcCookHandler {
	cp = $.GetContextPanel<MomHudConcCookTime>();
	cookMeter = $<ProgressBar>('#ConcCookMeter');
	cookLabel = $<Label>('#ConcCookTime');
	secondStr = $.Localize('#Run_Stat_Unit_Second');

	onCookUpdate(time: float, percentage: float) {
		this.cookMeter.value = percentage;

		const labelEnabled = this.cp.concTimerLabelEnabled;
		this.cookLabel.visible = labelEnabled;
		if (labelEnabled) {
			this.cookLabel.text = `${time.toFixed(2)}${this.secondStr}`;
		}
	}

	constructor() {
		$.RegisterEventHandler('OnCookUpdate', $('#ConcCooktimeContainer'), (time: float, percentage: float) =>
			this.onCookUpdate(time, percentage)
		);
	}
}
