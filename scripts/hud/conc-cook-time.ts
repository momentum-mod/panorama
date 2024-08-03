class ConcCook {
	static cp = $.GetContextPanel<MomHudConcCookTime>();
	static cookMeter = $<ProgressBar>('#ConcCookMeter');
	static cookLabel = $<Label>('#ConcCookTime');

	static onCookUpdate(time: float, percentage: float) {
		this.cookMeter.value = percentage;

		const labelEnabled = this.cp.concTimerLabelEnabled;
		this.cookLabel.visible = labelEnabled;
		if (labelEnabled) {
			this.cookLabel.text = `${time.toFixed(2)}${$.Localize('#Run_Stat_Unit_Second')}`;
		}
	}

	static {
		$.RegisterEventHandler('OnCookUpdate', $('#ConcCooktimeContainer'), this.onCookUpdate.bind(this));
	}
}
