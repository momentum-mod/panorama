'use strict';

class ConcCook {
	static cookMeter = $('#ConcCookMeter');
	static cookLabel = $('#ConcCookTime');

	static onCookUpdate(time, percentage) {
		this.cookMeter.value = percentage;

		const labelEnabled = $.GetContextPanel().concTimerLabelEnabled;
		this.cookLabel.visible = labelEnabled;
		if ( labelEnabled )
			this.cookLabel.text = `${time.toFixed(2)}s`;
	}

	static {
		$.RegisterEventHandler('OnCookUpdate', $('#ConcCooktimeContainer'), this.onCookUpdate.bind(this));
	}
}
