const STICKY_CHARGE_UNITS_TYPE = {
	NONE: 0,
	UPS: 1,
	PERCENT: 2
};

class StickyCharge {
	/** @type {ProgressBar} @static */
	static chargeMeter = $('#StickyChargeMeter');
	/** @type {Label} @static */
	static chargeSpeed = $('#StickyChargeSpeed');
	/** @type {Panel} @static */
	static container = $('#StickyChargeContainer');

	static OnChargeUpdate(speed, percentage) {
		const chargeUnitType = $.GetContextPanel().stickyChargeUnitType;

		let speedText;
		switch (chargeUnitType) {
			case STICKY_CHARGE_UNITS_TYPE.UPS:
				speedText = `${Math.floor(speed)}u/s`;
				break;
			case STICKY_CHARGE_UNITS_TYPE.PERCENT:
				speedText = `${Math.floor(percentage * 100)}%`;
				break;
			default:
				speedText = '';
		}
		this.chargeSpeed.text = speedText;
		this.chargeMeter.value = percentage;
	}

	static OnChargeToggled(enabled) {
		if (this.chargeMeter.enabled !== enabled) this.chargeMeter.enabled = enabled;
	}

	static {
		$.RegisterEventHandler('OnChargeUpdate', this.container, this.OnChargeUpdate.bind(this));
		$.RegisterEventHandler('OnChargeToggled', this.container, this.OnChargeToggled.bind(this));
	}
}
