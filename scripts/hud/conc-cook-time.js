class ConcCook {
	/** @type {ProgressBar} @static */
	static cookMeter = $('#ConcCookMeter');
	/** @type {Label} @static */
	static cookLabel = $('#ConcCookTime');

	static onCookUpdate(time, percentage) {
		this.cookMeter.value = percentage;

		const labelEnabled = $.GetContextPanel().concTimerLabelEnabled;
		this.cookLabel.visible = labelEnabled;
		if (labelEnabled) this.cookLabel.text = `${time.toFixed(2)}${$.Localize('#Run_Stat_Unit_Second')}`;
	}

	static {
		$.RegisterEventHandler('OnCookUpdate', $('#ConcCooktimeContainer'), this.onCookUpdate.bind(this));
	}
}
